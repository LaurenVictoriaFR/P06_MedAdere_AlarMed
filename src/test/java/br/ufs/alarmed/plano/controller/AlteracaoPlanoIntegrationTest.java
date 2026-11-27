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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// UC-04 Alterar plano confirmado, pela API (contrato em docs/CONTRATO_BLOCO_C.md).
// Cobre RN01/QS-04 na alteracao, UC-04 A1 a A4, TD-08 (um plano ativo) e QS-06 (outra conta).
// O efeito nas doses fica em AlteracaoPlanoDosesIntegrationTest, que precisa do relogio de teste.
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AlteracaoPlanoIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void iniciarAlteracaoCopiaOsItensEOConfirmadoContinuaValendo() throws Exception {
        UUID paciente = criarPaciente();
        UUID confirmado = criarPlanoConfirmado(paciente);
        UUID itemOriginal = UUID.fromString(buscar(paciente, "/planos/" + confirmado).get("itens").get(0).get("id").asText());

        JsonNode versao = json(mockMvc.perform(comSessao(post("/planos/{id}/alteracao", confirmado), paciente))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"))
                .andExpect(jsonPath("$.planoAnteriorId").value(confirmado.toString()))
                .andExpect(jsonPath("$.itens[0].nomeMedicamento").value("Losartana"))
                .andExpect(jsonPath("$.itens[0].itemOrigemId").value(itemOriginal.toString()))
                .andReturn().getResponse().getContentAsString());

        // a copia e outro item, mas continua o tratamento de onde o original estava
        JsonNode copia = versao.get("itens").get(0);
        assertThat(copia.get("id").asText()).isNotEqualTo(itemOriginal.toString());
        assertThat(copia.get("inicioTratamento").asText())
                .isEqualTo(buscar(paciente, "/planos/" + confirmado).get("itens").get(0).get("inicioTratamento").asText());

        // enquanto a alteracao nao e confirmada, o plano atual e o mesmo
        mockMvc.perform(comSessao(get("/planos/atual"), paciente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(confirmado.toString()));
    }

    @Test
    void iniciarAlteracaoDuasVezesRetomaAMesmaVersao() throws Exception {
        UUID paciente = criarPaciente();
        UUID confirmado = criarPlanoConfirmado(paciente);

        UUID primeira = iniciarAlteracao(paciente, confirmado);
        String segunda = mockMvc.perform(comSessao(post("/planos/{id}/alteracao", confirmado), paciente))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(json(segunda).get("id").asText()).isEqualTo(primeira.toString());
    }

    @Test
    void rascunhoDevolveAAlteracaoPendente() throws Exception {
        UUID paciente = criarPaciente();
        UUID confirmado = criarPlanoConfirmado(paciente);
        UUID versao = iniciarAlteracao(paciente, confirmado);

        mockMvc.perform(comSessao(get("/planos/rascunho"), paciente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(versao.toString()))
                .andExpect(jsonPath("$.planoAnteriorId").value(confirmado.toString()));
    }

    @Test
    void alterarPlanoQueNaoEstaConfirmadoRetorna409() throws Exception {
        UUID paciente = criarPaciente();
        UUID rascunho = criarPlano(paciente);

        mockMvc.perform(comSessao(post("/planos/{id}/alteracao", rascunho), paciente))
                .andExpect(status().isConflict());
    }

    @Test
    void alterarPlanoDeOutroPacienteRetorna404() throws Exception {
        UUID confirmado = criarPlanoConfirmado(criarPaciente());

        mockMvc.perform(comSessao(post("/planos/{id}/alteracao", confirmado), criarPaciente()))
                .andExpect(status().isNotFound());
    }

    @Test
    void alterarSemSessaoRetorna401() throws Exception {
        mockMvc.perform(post("/planos/{id}/alteracao", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void confirmarAlteracaoSemRevisarRetorna409() throws Exception {
        // RN01 / UC-04 A2 / QS-04: chamar a API direto nao pula a revisao
        UUID paciente = criarPaciente();
        UUID confirmado = criarPlanoConfirmado(paciente);
        UUID versao = iniciarAlteracao(paciente, confirmado);

        mockMvc.perform(comSessao(post("/planos/{id}/confirmar", versao), paciente))
                .andExpect(status().isConflict());

        mockMvc.perform(comSessao(get("/planos/atual"), paciente))
                .andExpect(jsonPath("$.id").value(confirmado.toString()));
    }

    @Test
    void confirmarAlteracaoTrocaOPlanoAtualEEncerraOAnterior() throws Exception {
        UUID paciente = criarPaciente();
        UUID confirmado = criarPlanoConfirmado(paciente);
        UUID versao = iniciarAlteracao(paciente, confirmado);
        adicionarItem(paciente, versao, "Metformina", "uso continuo");

        mockMvc.perform(comSessao(post("/planos/{id}/revisar", versao), paciente)).andExpect(status().isOk());
        mockMvc.perform(comSessao(post("/planos/{id}/confirmar", versao), paciente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("CONFIRMADO"));

        mockMvc.perform(comSessao(get("/planos/atual"), paciente))
                .andExpect(jsonPath("$.id").value(versao.toString()))
                .andExpect(jsonPath("$.itens.length()").value(2));
        mockMvc.perform(comSessao(get("/planos/{id}", confirmado), paciente))
                .andExpect(jsonPath("$.situacao").value("ENCERRADO"))
                .andExpect(jsonPath("$.dataFim").isNotEmpty());
        mockMvc.perform(comSessao(get("/planos/rascunho"), paciente))
                .andExpect(status().isNotFound());
    }

    @Test
    void corrigirDuranteARevisaoDaAlteracaoExigeNovaRevisao() throws Exception {
        // UC-04 A4 / UC-08 A1
        UUID paciente = criarPaciente();
        UUID versao = iniciarAlteracao(paciente, criarPlanoConfirmado(paciente));
        mockMvc.perform(comSessao(post("/planos/{id}/revisar", versao), paciente)).andExpect(status().isOk());

        mockMvc.perform(comSessao(post("/planos/{id}/editar", versao), paciente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"))
                .andExpect(jsonPath("$.itens.length()").value(1));
        mockMvc.perform(comSessao(post("/planos/{id}/confirmar", versao), paciente))
                .andExpect(status().isConflict());
    }

    @Test
    void cancelarAlteracaoMantemOPlanoConfirmado() throws Exception {
        // UC-04 A3: as alteracoes nao sao aplicadas
        UUID paciente = criarPaciente();
        UUID confirmado = criarPlanoConfirmado(paciente);
        UUID versao = iniciarAlteracao(paciente, confirmado);
        adicionarItem(paciente, versao, "Metformina", "uso continuo");

        mockMvc.perform(comSessao(delete("/planos/{id}", versao), paciente))
                .andExpect(status().isNoContent());

        mockMvc.perform(comSessao(get("/planos/atual"), paciente))
                .andExpect(jsonPath("$.id").value(confirmado.toString()))
                .andExpect(jsonPath("$.situacao").value("CONFIRMADO"))
                .andExpect(jsonPath("$.itens.length()").value(1));
    }

    @Test
    void novoCadastroComPlanoConfirmadoRetorna409() throws Exception {
        // TD-08: nada de segundo plano confirmado pelo POST /planos
        UUID paciente = criarPaciente();
        criarPlanoConfirmado(paciente);

        mockMvc.perform(comSessao(post("/planos"), paciente))
                .andExpect(status().isConflict());
    }

    @Test
    void iniciarCadastroRetomaRascunhoQueEstaEmRevisao() throws Exception {
        // TD-08: antes so retomava EM_EDICAO e criava outro rascunho
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        adicionarItem(paciente, plano, "Losartana", "uso continuo");
        mockMvc.perform(comSessao(post("/planos/{id}/revisar", plano), paciente));

        assertThat(criarPlano(paciente)).isEqualTo(plano);
    }

    @Test
    void duracaoInvalidaERecusadaJaAoAdicionarOItem() throws Exception {
        // TD-03 / UC-04 A1: o erro aparece no item, nao so na confirmacao
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);

        for (String duracao : new String[] {"para sempre", "0 dias", "ate 01/01/2020"}) {
            mockMvc.perform(comSessao(post("/planos/{id}/itens", plano), paciente)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(corpoItem("Losartana", duracao)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.camposInvalidos.duracaoTratamento").exists());
        }
    }

    @Test
    void duracoesValidasContinuamAceitas() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);

        for (String duracao : new String[] {"uso contínuo", "7 dias", "1 dia", "até 31/12/2099"}) {
            adicionarItem(paciente, plano, "Remedio " + duracao, duracao);
        }
    }

    private MockHttpServletRequestBuilder comSessao(MockHttpServletRequestBuilder requisicao, UUID paciente) {
        return requisicao.sessionAttr(ContaController.CHAVE_SESSAO, paciente);
    }

    private JsonNode json(String texto) {
        return objectMapper.readTree(texto);
    }

    private JsonNode buscar(UUID paciente, String rota) throws Exception {
        return json(mockMvc.perform(comSessao(get(rota), paciente))
                .andReturn().getResponse().getContentAsString());
    }

    private UUID criarPaciente() throws Exception {
        String corpo = """
                {
                  "nome": "Maria Teste",
                  "email": "%s",
                  "senha": "remedio2026",
                  "confirmacaoSenha": "remedio2026",
                  "dataNascimento": "1956-05-14",
                  "aceiteTermos": true
                }
                """.formatted("paciente-" + UUID.randomUUID() + "@teste.com");
        String resposta = mockMvc.perform(post("/contas").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json(resposta).get("id").asText());
    }

    private UUID criarPlano(UUID paciente) throws Exception {
        String resposta = mockMvc.perform(comSessao(post("/planos"), paciente))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json(resposta).get("id").asText());
    }

    private UUID criarPlanoConfirmado(UUID paciente) throws Exception {
        UUID plano = criarPlano(paciente);
        adicionarItem(paciente, plano, "Losartana", "uso continuo");
        mockMvc.perform(comSessao(post("/planos/{id}/revisar", plano), paciente)).andExpect(status().isOk());
        mockMvc.perform(comSessao(post("/planos/{id}/confirmar", plano), paciente)).andExpect(status().isOk());
        return plano;
    }

    private UUID iniciarAlteracao(UUID paciente, UUID confirmado) throws Exception {
        String resposta = mockMvc.perform(comSessao(post("/planos/{id}/alteracao", confirmado), paciente))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json(resposta).get("id").asText());
    }

    private void adicionarItem(UUID paciente, UUID plano, String nome, String duracao) throws Exception {
        mockMvc.perform(comSessao(post("/planos/{id}/itens", plano), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoItem(nome, duracao)))
                .andExpect(status().isOk());
    }

    private String corpoItem(String nome, String duracao) {
        return """
                {
                  "nomeMedicamento": "%s",
                  "dosagem": "50 mg",
                  "viaAdministracao": "oral",
                  "frequencia": "12 em 12 horas",
                  "duracaoTratamento": "%s",
                  "horarios": ["08:00", "20:00"]
                }
                """.formatted(nome, duracao);
    }
}
