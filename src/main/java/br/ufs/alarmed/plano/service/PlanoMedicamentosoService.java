package br.ufs.alarmed.plano.service;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException;
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

// UC-01, passos 1 a 5: comecar o cadastro do plano e colocar/tirar medicamentos dele.
// Revisao, correcao, confirmacao e cancelamento (UC-08) ficam pro proximo passo.
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
        return PlanoResponse.de(plano);
    }

    // UC-01: tira um medicamento do plano
    public PlanoResponse removerItem(UUID planoId, UUID itemId) {
        PlanoMedicamentoso plano = buscarPlanoDoPaciente(planoId);
        plano.removerItem(itemId);
        return PlanoResponse.de(plano);
    }

    // busca o plano garantindo que ele e do paciente logado (UC-06, pos-condicao)
    private PlanoMedicamentoso buscarPlanoDoPaciente(UUID planoId) {
        UUID pacienteId = contextoPaciente.pacienteAtual();
        return planoRepository.findByIdAndPacienteId(planoId, pacienteId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Plano não encontrado."));
    }
}
