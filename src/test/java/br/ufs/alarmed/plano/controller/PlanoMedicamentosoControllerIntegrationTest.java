package br.ufs.alarmed.plano.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.ufs.alarmed.conta.controller.ContaController;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

// Testes de integracao dos endpoints de /planos (UC-01, UC-08), subindo o contexto
// completo (controller + service + repository + banco H2) e autenticando via sessao (ContextoPacienteViaSessao).
// Cada teste usa um paciente real, criado por POST /contas, por causa da chave estrangeira do plano.
// Cada teste roda numa transacao que e desfeita no final, pra um nao sujar o outro.
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PlanoMedicamentosoControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void iniciarCadastroSemSessaoRetorna401() throws Exception {
        mockMvc.perform(post("/planos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void iniciarCadastroCriaPlanoEmEdicao() throws Exception {
        UUID pacienteId = criarPaciente();

        mockMvc.perform(post("/planos").sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"))
                .andExpect(jsonPath("$.itens").isEmpty());
    }

    @Test
    void iniciarCadastroDuasVezesRetomaOMesmoRascunho() throws Exception {
        UUID pacienteId = criarPaciente();

        UUID primeiroId = criarPlano(pacienteId);
        UUID segundoId = criarPlano(pacienteId);

        assertThat(segundoId).isEqualTo(primeiroId);
    }

    @Test
    void buscarPlanoDeOutroPacienteRetorna404() throws Exception {
        UUID planoId = criarPlano(criarPaciente());

        mockMvc.perform(get("/planos/{id}", planoId).sessionAttr(ContaController.CHAVE_SESSAO, criarPaciente()))
                .andExpect(status().isNotFound());
    }

    @Test
    void adicionarItemComDadosInvalidosRetorna400() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);

        String corpoInvalido = """
                {
                  "nomeMedicamento": "",
                  "dosagem": "50 mg",
                  "frequencia": "12 em 12 horas",
                  "duracaoTratamento": "uso continuo",
                  "horarios": ["08:00"]
                }
                """;

        mockMvc.perform(post("/planos/{id}/itens", planoId)
                        .sessionAttr(ContaController.CHAVE_SESSAO, pacienteId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoInvalido))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.nomeMedicamento").exists());
    }

    @Test
    void adicionarEDepoisRemoverItem() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);

        String resposta = adicionarItemLosartana(pacienteId, planoId);
        UUID itemId = UUID.fromString(objectMapper.readTree(resposta).get("itens").get(0).get("id").asText());

        mockMvc.perform(delete("/planos/{id}/itens/{itemId}", planoId, itemId)
                        .sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens").isEmpty());
    }

    @Test
    void confirmarSemRevisarAntesRetorna409() throws Exception {
        // RN01, via HTTP: nao da pra pular a revisao
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);

        mockMvc.perform(post("/planos/{id}/confirmar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isConflict());
    }

    @Test
    void fluxoCompletoAteConfirmar() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);

        mockMvc.perform(post("/planos/{id}/revisar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_REVISAO"));

        mockMvc.perform(post("/planos/{id}/confirmar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("CONFIRMADO"));
    }

    @Test
    void editarVoltaDaRevisaoParaEdicao() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);
        mockMvc.perform(post("/planos/{id}/revisar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId));

        mockMvc.perform(post("/planos/{id}/editar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"));
    }

    @Test
    void cancelarCadastroEmEdicaoApagaOPlano() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);

        mockMvc.perform(delete("/planos/{id}", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/planos/{id}", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelarPlanoConfirmadoRetorna409() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);
        mockMvc.perform(post("/planos/{id}/revisar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId));
        mockMvc.perform(post("/planos/{id}/confirmar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId));

        mockMvc.perform(delete("/planos/{id}", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isConflict());
    }

    @Test
    void planoAtualSemPlanoConfirmadoRetorna404() throws Exception {
        UUID pacienteId = criarPaciente();
        // so existe um rascunho, que ainda nao conta como plano atual
        criarPlano(pacienteId);

        mockMvc.perform(get("/planos/atual").sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isNotFound());
    }

    @Test
    void planoAtualDevolveOPlanoConfirmado() throws Exception {
        UUID pacienteId = criarPaciente();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);
        mockMvc.perform(post("/planos/{id}/revisar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId));
        mockMvc.perform(post("/planos/{id}/confirmar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, pacienteId));

        mockMvc.perform(get("/planos/atual").sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(planoId.toString()))
                .andExpect(jsonPath("$.situacao").value("CONFIRMADO"))
                .andExpect(jsonPath("$.itens[0].nomeMedicamento").value("Losartana"));
    }

    @Test
    void planoAtualNaoMostraPlanoDeOutroPaciente() throws Exception {
        UUID donoDoPlano = criarPaciente();
        UUID planoId = criarPlano(donoDoPlano);
        adicionarItemLosartana(donoDoPlano, planoId);
        mockMvc.perform(post("/planos/{id}/revisar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, donoDoPlano));
        mockMvc.perform(post("/planos/{id}/confirmar", planoId).sessionAttr(ContaController.CHAVE_SESSAO, donoDoPlano));

        // outro paciente logado nao enxerga o plano confirmado do primeiro
        mockMvc.perform(get("/planos/atual").sessionAttr(ContaController.CHAVE_SESSAO, criarPaciente()))
                .andExpect(status().isNotFound());
    }

    @Test
    void planoAtualSemSessaoRetorna401() throws Exception {
        mockMvc.perform(get("/planos/atual"))
                .andExpect(status().isUnauthorized());
    }

    // cria uma conta de verdade (POST /contas) e devolve o id do paciente dela.
    // precisa ser um paciente real porque o plano tem chave estrangeira pra tabela paciente (TD-04).
    // o email muda a cada chamada pra nao bater na regra de "Email ja cadastrado".
    private UUID criarPaciente() throws Exception {
        String email = "paciente-" + UUID.randomUUID() + "@teste.com";
        String corpo = """
                {
                  "nome": "Maria Teste",
                  "email": "%s",
                  "senha": "remedio2026",
                  "confirmacaoSenha": "remedio2026",
                  "dataNascimento": "1956-05-14",
                  "aceiteTermos": true
                }
                """.formatted(email);

        String resposta = mockMvc.perform(post("/contas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(resposta).get("id").asText());
    }

    private UUID criarPlano(UUID pacienteId) throws Exception {
        String resposta = mockMvc.perform(post("/planos").sessionAttr(ContaController.CHAVE_SESSAO, pacienteId))
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(resposta).get("id").asText());
    }

    private String adicionarItemLosartana(UUID pacienteId, UUID planoId) throws Exception {
        String corpo = """
                {
                  "nomeMedicamento": "Losartana",
                  "dosagem": "50 mg",
                  "viaAdministracao": "oral",
                  "frequencia": "12 em 12 horas",
                  "duracaoTratamento": "uso continuo",
                  "horarios": ["08:00", "20:00"]
                }
                """;

        return mockMvc.perform(post("/planos/{id}/itens", planoId)
                        .sessionAttr(ContaController.CHAVE_SESSAO, pacienteId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
}
