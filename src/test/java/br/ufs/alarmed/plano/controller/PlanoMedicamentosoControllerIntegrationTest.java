package br.ufs.alarmed.plano.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.ufs.alarmed.comum.config.ContextoPacienteViaCabecalho;
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
// completo (controller + service + repository + banco H2) e autenticando via cabecalho.
// Cada teste roda numa transacao que e desfeita no final, pra um nao sujar o outro.
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PlanoMedicamentosoControllerIntegrationTest {

    private static final String CABECALHO = ContextoPacienteViaCabecalho.CABECALHO;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void iniciarCadastroSemCabecalhoRetorna401() throws Exception {
        mockMvc.perform(post("/planos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void iniciarCadastroCriaPlanoEmEdicao() throws Exception {
        UUID pacienteId = UUID.randomUUID();

        mockMvc.perform(post("/planos").header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"))
                .andExpect(jsonPath("$.itens").isEmpty());
    }

    @Test
    void iniciarCadastroDuasVezesRetomaOMesmoRascunho() throws Exception {
        UUID pacienteId = UUID.randomUUID();

        UUID primeiroId = criarPlano(pacienteId);
        UUID segundoId = criarPlano(pacienteId);

        assertThat(segundoId).isEqualTo(primeiroId);
    }

    @Test
    void buscarPlanoDeOutroPacienteRetorna404() throws Exception {
        UUID planoId = criarPlano(UUID.randomUUID());

        mockMvc.perform(get("/planos/{id}", planoId).header(CABECALHO, UUID.randomUUID().toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void adicionarItemComDadosInvalidosRetorna400() throws Exception {
        UUID pacienteId = UUID.randomUUID();
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
                        .header(CABECALHO, pacienteId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoInvalido))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.nomeMedicamento").exists());
    }

    @Test
    void adicionarEDepoisRemoverItem() throws Exception {
        UUID pacienteId = UUID.randomUUID();
        UUID planoId = criarPlano(pacienteId);

        String resposta = adicionarItemLosartana(pacienteId, planoId);
        UUID itemId = UUID.fromString(objectMapper.readTree(resposta).get("itens").get(0).get("id").asText());

        mockMvc.perform(delete("/planos/{id}/itens/{itemId}", planoId, itemId)
                        .header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens").isEmpty());
    }

    @Test
    void confirmarSemRevisarAntesRetorna409() throws Exception {
        // RN01, via HTTP: nao da pra pular a revisao
        UUID pacienteId = UUID.randomUUID();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);

        mockMvc.perform(post("/planos/{id}/confirmar", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void fluxoCompletoAteConfirmar() throws Exception {
        UUID pacienteId = UUID.randomUUID();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);

        mockMvc.perform(post("/planos/{id}/revisar", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_REVISAO"));

        mockMvc.perform(post("/planos/{id}/confirmar", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("CONFIRMADO"));
    }

    @Test
    void editarVoltaDaRevisaoParaEdicao() throws Exception {
        UUID pacienteId = UUID.randomUUID();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);
        mockMvc.perform(post("/planos/{id}/revisar", planoId).header(CABECALHO, pacienteId.toString()));

        mockMvc.perform(post("/planos/{id}/editar", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"));
    }

    @Test
    void cancelarCadastroEmEdicaoApagaOPlano() throws Exception {
        UUID pacienteId = UUID.randomUUID();
        UUID planoId = criarPlano(pacienteId);

        mockMvc.perform(delete("/planos/{id}", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/planos/{id}", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelarPlanoConfirmadoRetorna409() throws Exception {
        UUID pacienteId = UUID.randomUUID();
        UUID planoId = criarPlano(pacienteId);
        adicionarItemLosartana(pacienteId, planoId);
        mockMvc.perform(post("/planos/{id}/revisar", planoId).header(CABECALHO, pacienteId.toString()));
        mockMvc.perform(post("/planos/{id}/confirmar", planoId).header(CABECALHO, pacienteId.toString()));

        mockMvc.perform(delete("/planos/{id}", planoId).header(CABECALHO, pacienteId.toString()))
                .andExpect(status().isConflict());
    }

    private UUID criarPlano(UUID pacienteId) throws Exception {
        String resposta = mockMvc.perform(post("/planos").header(CABECALHO, pacienteId.toString()))
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
                        .header(CABECALHO, pacienteId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
}
