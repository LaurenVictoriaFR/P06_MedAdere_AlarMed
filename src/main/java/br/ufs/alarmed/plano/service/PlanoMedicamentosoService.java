package br.ufs.alarmed.plano.service;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException;
import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import br.ufs.alarmed.dose.repository.DoseRepository;
import br.ufs.alarmed.dose.service.GeradorDoses;
import br.ufs.alarmed.plano.dto.ItemDoPlanoRequest;
import br.ufs.alarmed.plano.dto.PlanoResponse;
import br.ufs.alarmed.plano.model.ItemDoPlano;
import br.ufs.alarmed.plano.model.PlanoMedicamentoso;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// UC-01, UC-04 e UC-08: cadastrar o plano, alterar o plano confirmado, colocar/tirar
// medicamentos, revisar, corrigir, confirmar e cancelar o que ainda nao foi confirmado.
@Service
@Transactional
public class PlanoMedicamentosoService {

    // situacoes de um plano ainda nao confirmado (cadastro ou alteracao em andamento)
    private static final List<SituacaoPlano> RASCUNHO = List.of(SituacaoPlano.EM_EDICAO, SituacaoPlano.EM_REVISAO);

    private final PlanoMedicamentosoRepository planoRepository;
    private final DoseRepository doseRepository;
    private final ContextoPaciente contextoPaciente;
    private final Clock relogio;
    private final ZoneId fuso;
    private final GeradorDoses gerador;

    public PlanoMedicamentosoService(PlanoMedicamentosoRepository planoRepository, DoseRepository doseRepository,
                                    ContextoPaciente contextoPaciente, Clock relogio, ZoneId fuso,
                                    GeradorDoses gerador) {
        this.planoRepository = planoRepository;
        this.doseRepository = doseRepository;
        this.contextoPaciente = contextoPaciente;
        this.relogio = relogio;
        this.fuso = fuso;
        this.gerador = gerador;
    }

    // resultado do iniciarAlteracao: o controller devolve 201 se criou e 200 se retomou
    public record AlteracaoIniciada(PlanoResponse plano, boolean criada) {
    }

    // UC-01 passo 1: comeca o cadastro pro paciente logado.
    // Se ja tiver um rascunho (EM_EDICAO ou EM_REVISAO), retoma ele em vez de criar outro.
    // Com plano confirmado, o caminho e o UC-04 (TD-08: um plano ativo por paciente).
    public PlanoResponse iniciarCadastro() {
        UUID pacienteId = contextoPaciente.pacienteAtual();

        if (!planoRepository.findByPacienteIdAndSituacao(pacienteId, SituacaoPlano.CONFIRMADO).isEmpty()) {
            throw new RegraNegocioException("Você já tem um plano confirmado. Para mudar, use a alteração do plano.");
        }

        List<PlanoMedicamentoso> rascunhos = planoRepository.findByPacienteIdAndSituacaoIn(pacienteId, RASCUNHO);
        if (!rascunhos.isEmpty()) {
            return PlanoResponse.de(rascunhos.get(0));
        }

        PlanoMedicamentoso plano = new PlanoMedicamentoso(pacienteId);
        planoRepository.save(plano);
        return PlanoResponse.de(plano);
    }

    // consulta o plano em cadastro, pra tela poder mostrar o que ja foi adicionado
    @Transactional(readOnly = true)
    public PlanoResponse buscarPlano(UUID planoId) {
        return PlanoResponse.de(buscarPlanoDoPaciente(planoId));
    }

    // devolve o plano confirmado do paciente logado.
    // o app chama ao abrir: se nao tiver plano confirmado (404), manda o paciente pro cadastro (P01).
    @Transactional(readOnly = true)
    public PlanoResponse buscarPlanoAtual() {
        UUID pacienteId = contextoPaciente.pacienteAtual();

        List<PlanoMedicamentoso> confirmados = planoRepository.findByPacienteIdAndSituacao(pacienteId, SituacaoPlano.CONFIRMADO);
        if (confirmados.isEmpty()) {
            throw new RecursoNaoEncontradoException("Nenhum plano confirmado.");
        }
        return PlanoResponse.de(confirmados.get(0));
    }

    // cadastro ou alteracao em andamento, pro front retomar de onde parou (QP-07: antes
    // ficava no RascunhoController, falando direto com o repository)
    @Transactional(readOnly = true)
    public PlanoResponse buscarRascunho() {
        UUID pacienteId = contextoPaciente.pacienteAtual();
        return planoRepository.findByPacienteIdAndSituacaoIn(pacienteId, RASCUNHO).stream()
                .findFirst()
                .map(PlanoResponse::de)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Nenhum rascunho."));
    }

    // UC-04 passos 1 a 3 (SD04 iniciarAlteracao): abre a versao em edicao do plano
    // confirmado, com os itens copiados. Se a alteracao ja tiver sido aberta, retoma.
    public AlteracaoIniciada iniciarAlteracao(UUID planoId) {
        UUID pacienteId = contextoPaciente.pacienteAtual();
        buscarPlanoDoPaciente(planoId);
        // trava o plano confirmado: duas abas abrindo a alteracao juntas nao criam duas versoes
        PlanoMedicamentoso plano = planoRepository.bloquear(planoId).orElseThrow();

        List<PlanoMedicamentoso> rascunhos = planoRepository.findByPacienteIdAndSituacaoIn(pacienteId, RASCUNHO);
        for (PlanoMedicamentoso rascunho : rascunhos) {
            if (planoId.equals(rascunho.getPlanoAnteriorId())) {
                return new AlteracaoIniciada(PlanoResponse.de(rascunho), false);
            }
        }
        if (!rascunhos.isEmpty()) {
            throw new RegraNegocioException("Já existe um cadastro em andamento. Conclua ou cancele antes de alterar o plano.");
        }

        PlanoMedicamentoso versaoNova = plano.iniciarAlteracao();
        // flush pra os itens copiados ja voltarem com id na resposta
        planoRepository.saveAndFlush(versaoNova);
        return new AlteracaoIniciada(PlanoResponse.de(versaoNova), true);
    }

    // UC-01 passos 2 a 4 / UC-04 passo 4: adiciona um medicamento ao plano
    public PlanoResponse adicionarItem(UUID planoId, ItemDoPlanoRequest request) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);

        ItemDoPlano item = new ItemDoPlano(
                request.nomeMedicamento(),
                request.dosagem(),
                request.viaAdministracao(),
                request.frequencia(),
                request.duracaoTratamento(),
                request.horarios());

        plano.adicionarItem(item);
        // forca o cascade-persist agora: so assim o item ganha o id antes de virar resposta
        // (sem isso, o id so sai preenchido no flush de fim de transacao, tarde demais pro DTO)
        planoRepository.saveAndFlush(plano);
        return PlanoResponse.de(plano);
    }

    // UC-01 / UC-04 passo 4: tira um medicamento do plano
    public PlanoResponse removerItem(UUID planoId, UUID itemId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.removerItem(itemId);
        return PlanoResponse.de(plano);
    }

    // UC-01 passo 6 / UC-04 passo 5: manda o plano completo pra revisao (UC-08)
    public PlanoResponse revisarPlano(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.revisarPlano();
        return PlanoResponse.de(plano);
    }

    // UC-08 A1 / UC-04 A4: achou erro na revisao e volta pra edicao, com os itens preservados
    public PlanoResponse editarPlano(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.editarPlano();
        return PlanoResponse.de(plano);
    }

    // UC-01 passo 7 / UC-04 passo 6 / UC-08 passo 3: confirma o plano revisado (RN01).
    // Na alteracao, tudo na mesma transacao (DM09, Q-01 do P3):
    //  - a versao anterior vira ENCERRADO (encerrarPlano);
    //  - as doses Programadas dela que ainda nao chegaram no horario saem;
    //  - Pendentes (janela aberta) e doses ja registradas ficam como estao;
    //  - as doses da versao nova sao geradas a partir de agora.
    public PlanoResponse confirmarPlano(UUID planoId) {
        UUID pacienteId = contextoPaciente.pacienteAtual();
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);

        PlanoMedicamentoso anterior = null;
        if (plano.ehAlteracao()) {
            // trava o plano antigo pra o agendador nao gerar doses nele enquanto ele e encerrado
            anterior = planoRepository.bloquear(plano.getPlanoAnteriorId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Plano não encontrado."));
        } else if (!planoRepository.findByPacienteIdAndSituacao(pacienteId, SituacaoPlano.CONFIRMADO).isEmpty()) {
            throw new RegraNegocioException("Você já tem um plano confirmado. Para mudar, use a alteração do plano.");
        }

        Instant agora = relogio.instant();
        plano.confirmarPlano(agora, fuso);

        if (anterior != null) {
            anterior.encerrarPlano(agora.atZone(fuso).toLocalDate());
            doseRepository.apagarProgramadasFuturas(anterior.getId(), agora);
        }

        planoRepository.flush();
        gerador.gerar(planoId);
        return PlanoResponse.de(plano);
    }

    // UC-01 A4 / UC-04 A3 / UC-08 A2: desiste do cadastro ou da alteracao antes de confirmar.
    // Na alteracao, o plano confirmado nao foi tocado e continua valendo.
    public void cancelarCadastro(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.cancelarAlteracao();
        planoRepository.delete(plano);
    }

    // busca o plano garantindo que ele e do paciente logado (UC-06, pos-condicao)
    private PlanoMedicamentoso buscarPlanoDoPaciente(UUID planoId) {
        UUID pacienteId = contextoPaciente.pacienteAtual();
        return planoRepository.findByIdAndPacienteId(planoId, pacienteId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Plano não encontrado."));
    }
}
