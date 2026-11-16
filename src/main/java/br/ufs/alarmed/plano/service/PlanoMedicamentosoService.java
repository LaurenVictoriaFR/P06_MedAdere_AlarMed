package br.ufs.alarmed.plano.service;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException;
import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import br.ufs.alarmed.plano.dto.ItemDoPlanoRequest;
import br.ufs.alarmed.plano.dto.PlanoResponse;
import br.ufs.alarmed.plano.model.ItemDoPlano;
import br.ufs.alarmed.plano.model.PlanoMedicamentoso;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// UC-01 e UC-08: comecar o cadastro do plano, colocar/tirar medicamentos, revisar,
// corrigir, confirmar e cancelar um cadastro que ainda nao foi confirmado.
@Service
@Transactional
public class PlanoMedicamentosoService {

    private final PlanoMedicamentosoRepository planoRepository;
    private final ContextoPaciente contextoPaciente;

    public PlanoMedicamentosoService(PlanoMedicamentosoRepository planoRepository, ContextoPaciente contextoPaciente) {
        this.planoRepository = planoRepository;
        this.contextoPaciente = contextoPaciente;
    }

    // UC-01 passo 1: comeca o cadastro pro paciente logado.
    // Se ja tiver um rascunho (EM_EDICAO) pela metade, retoma ele em vez de criar outro.
    public PlanoResponse iniciarCadastro() {
        UUID pacienteId = contextoPaciente.pacienteAtual();

        List<PlanoMedicamentoso> rascunhos = planoRepository.findByPacienteIdAndSituacao(pacienteId, SituacaoPlano.EM_EDICAO);
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

    // UC-01 passos 2 a 4: adiciona um medicamento ao plano
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

    // UC-01: tira um medicamento do plano
    public PlanoResponse removerItem(UUID planoId, UUID itemId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.removerItem(itemId);
        return PlanoResponse.de(plano);
    }

    // UC-01 passo 6: manda o plano completo pra revisao (UC-08)
    public PlanoResponse revisarPlano(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.revisarPlano();
        return PlanoResponse.de(plano);
    }

    // UC-08 A1: achou erro na revisao e volta pra edicao, com os itens preservados
    public PlanoResponse editarPlano(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.editarPlano();
        return PlanoResponse.de(plano);
    }

    // UC-01 passo 7 / UC-08 passo 3: confirma o plano revisado (RN01)
    public PlanoResponse confirmarPlano(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.confirmarPlano();
        return PlanoResponse.de(plano);
    }

    // desiste do cadastro enquanto ele ainda nao foi confirmado.
    // depois de CONFIRMADO, cancelar e outro fluxo (UC-04), fora desta entrega.
    public void cancelarCadastro(UUID planoId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        if (plano.getSituacao() != SituacaoPlano.EM_EDICAO && plano.getSituacao() != SituacaoPlano.EM_REVISAO) {
            throw new RegraNegocioException("Só é possível cancelar um cadastro que ainda não foi confirmado.");
        }
        planoRepository.delete(plano);
    }

    // busca o plano garantindo que ele e do paciente logado (UC-06, pos-condicao)
    private PlanoMedicamentoso buscarPlanoDoPaciente(UUID planoId) {
        UUID pacienteId = contextoPaciente.pacienteAtual();
        return planoRepository.findByIdAndPacienteId(planoId, pacienteId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Plano não encontrado."));
    }
}
