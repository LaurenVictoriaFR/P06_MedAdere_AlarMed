package br.ufs.alarmed.plano.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.ufs.alarmed.conta.controller.ContaController;
import br.ufs.alarmed.plano.repository.FotoCaixaRepository;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// RF008 (foto da caixa), observacao do item e BL-06 (editar item no lugar), pela API.
// Contrato em docs/CONTRATO_BLOCO_C.md. Sem @Transactional de proposito: assim a copia da
// foto no banco e a exclusao em cascata (ON DELETE CASCADE) rodam de verdade.
@SpringBootTest
@AutoConfigureMockMvc
class FotoEEdicaoDoItemIntegrationTest {

    // so os bytes iniciais importam: e por eles que o servidor reconhece o formato
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 1, 2, 3};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 9, 9};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 4, 0, 0, 0, 'W', 'E', 'B', 'P', 7};

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FotoCaixaRepository fotos;

    // ---------------------------------------------------------------- foto da caixa

    @Test
    void enviarFotoEDepoisBaixarDevolveAMesmaImagem() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");

        enviarFoto(paciente, plano, item, "caixa.png", PNG).andExpect(status().isNoContent());

        mockMvc.perform(comSessao(get("/planos/{id}", plano), paciente))
                .andExpect(jsonPath("$.itens[0].temFoto").value(true));
        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", plano, item), paciente))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }

    @Test
    void enviarOutraFotoSubstituiAAnterior() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");

        enviarFoto(paciente, plano, item, "caixa.jpg", JPEG).andExpect(status().isNoContent());
        enviarFoto(paciente, plano, item, "caixa.webp", WEBP).andExpect(status().isNoContent());

        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", plano, item), paciente))
                .andExpect(content().contentType("image/webp"))
                .andExpect(content().bytes(WEBP));
    }

    @Test
    void arquivoQueNaoEImagemRetorna400MesmoComNomeDePng() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");

        enviarFoto(paciente, plano, item, "caixa.png", "<script>alert(1)</script>".getBytes())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value("Envie a foto em JPEG, PNG ou WebP."));
        mockMvc.perform(comSessao(get("/planos/{id}", plano), paciente))
                .andExpect(jsonPath("$.itens[0].temFoto").value(false));
    }

    @Test
    void fotoAcimaDe2MbRetorna400() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");
        byte[] grande = Arrays.copyOf(PNG, 2 * 1024 * 1024 + 1);

        enviarFoto(paciente, plano, item, "caixa.png", grande)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value("A foto pode ter no máximo 2 MB."));
    }

    @Test
    void enviarSemOCampoArquivoRetorna400() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");

        mockMvc.perform(comSessao(multipart(HttpMethod.PUT, "/planos/{p}/itens/{i}/foto", plano, item)
                        .file(new MockMultipartFile("outro", "caixa.png", "image/png", PNG)), paciente))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mudarFotoForaDaEdicaoRetorna409() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");
        mockMvc.perform(comSessao(post("/planos/{id}/revisar", plano), paciente)).andExpect(status().isOk());

        // em revisao (MOD-03): qualquer mudanca obriga a voltar pra edicao
        enviarFoto(paciente, plano, item, "caixa.png", PNG).andExpect(status().isConflict());

        // confirmado: a foto so muda pela alteracao do plano (UC-04)
        mockMvc.perform(comSessao(post("/planos/{id}/confirmar", plano), paciente)).andExpect(status().isOk());
        enviarFoto(paciente, plano, item, "caixa.png", PNG).andExpect(status().isConflict());
        mockMvc.perform(comSessao(delete("/planos/{p}/itens/{i}/foto", plano, item), paciente))
                .andExpect(status().isConflict());
    }

    @Test
    void fotoDeOutraContaRetorna404() throws Exception {
        UUID dono = criarPaciente();
        UUID outro = criarPaciente();
        UUID plano = criarPlano(dono);
        UUID item = adicionarItem(dono, plano, "Losartana", "08:00");
        enviarFoto(dono, plano, item, "caixa.png", PNG).andExpect(status().isNoContent());

        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", plano, item), outro))
                .andExpect(status().isNotFound());
        enviarFoto(outro, plano, item, "caixa.png", JPEG).andExpect(status().isNotFound());
        mockMvc.perform(comSessao(delete("/planos/{p}/itens/{i}/foto", plano, item), outro))
                .andExpect(status().isNotFound());
    }

    @Test
    void removerFotoTiraAImagemEOGetPassaADar404() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");
        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", plano, item), paciente))
                .andExpect(status().isNotFound());

        enviarFoto(paciente, plano, item, "caixa.png", PNG).andExpect(status().isNoContent());
        mockMvc.perform(comSessao(delete("/planos/{p}/itens/{i}/foto", plano, item), paciente))
                .andExpect(status().isNoContent());

        assertThat(fotos.findById(item)).isEmpty();
        mockMvc.perform(comSessao(get("/planos/{id}", plano), paciente))
                .andExpect(jsonPath("$.itens[0].temFoto").value(false));
        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", plano, item), paciente))
                .andExpect(status().isNotFound());
    }

    @Test
    void removerOItemApagaAFotoJunto() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");
        enviarFoto(paciente, plano, item, "caixa.png", PNG).andExpect(status().isNoContent());

        mockMvc.perform(comSessao(delete("/planos/{p}/itens/{i}", plano, item), paciente))
                .andExpect(status().isOk());

        assertThat(fotos.findById(item)).isEmpty();
    }

    @Test
    void alteracaoDoPlanoMantemAFotoNaCopiaSemMexerNoOriginal() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID original = adicionarItem(paciente, plano, "Losartana", "08:00");
        enviarFoto(paciente, plano, original, "caixa.png", PNG).andExpect(status().isNoContent());
        revisarEConfirmar(paciente, plano);

        JsonNode versao = json(mockMvc.perform(comSessao(post("/planos/{id}/alteracao", plano), paciente))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.itens[0].temFoto").value(true))
                .andReturn().getResponse().getContentAsString());
        UUID versaoId = UUID.fromString(versao.get("id").asText());
        UUID copia = UUID.fromString(versao.get("itens").get(0).get("id").asText());

        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", versaoId, copia), paciente))
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG));

        // trocar a foto na copia nao muda a do plano que ainda esta valendo
        enviarFoto(paciente, versaoId, copia, "caixa.jpg", JPEG).andExpect(status().isNoContent());
        mockMvc.perform(comSessao(get("/planos/{p}/itens/{i}/foto", plano, original), paciente))
                .andExpect(content().bytes(PNG));

        // desistir da alteracao apaga a foto da copia e deixa a original
        mockMvc.perform(comSessao(delete("/planos/{id}", versaoId), paciente))
                .andExpect(status().isNoContent());
        assertThat(fotos.findById(copia)).isEmpty();
        assertThat(fotos.findById(original)).isPresent();
    }

    // ---------------------------------------------------------------- observacao

    @Test
    void observacaoEGuardadaECopiadaNaAlteracao() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        mockMvc.perform(comSessao(post("/planos/{id}/itens", plano), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Omeprazol", "uso continuo", "tomar em jejum", "07:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].observacao").value("tomar em jejum"));
        revisarEConfirmar(paciente, plano);

        mockMvc.perform(comSessao(post("/planos/{id}/alteracao", plano), paciente))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.itens[0].observacao").value("tomar em jejum"));
    }

    @Test
    void observacaoMuitoLongaRetorna400ComOCampo() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);

        mockMvc.perform(comSessao(post("/planos/{id}/itens", plano), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Omeprazol", "uso continuo", "x".repeat(501), "07:00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.observacao").exists());
    }

    // ---------------------------------------------------------------- editar item (BL-06)

    @Test
    void editarItemMudaOsDadosNoLugarEMantemOId() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00", "20:00");

        // 08:00 continua, 20:00 sai e 21:00 entra
        mockMvc.perform(comSessao(put("/planos/{p}/itens/{i}", plano, item), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Losartana Potássica", "7 dias", "depois do cafe", "08:00", "21:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens.length()").value(1))
                .andExpect(jsonPath("$.itens[0].id").value(item.toString()))
                .andExpect(jsonPath("$.itens[0].nomeMedicamento").value("Losartana Potássica"))
                .andExpect(jsonPath("$.itens[0].duracaoTratamento").value("7 dias"))
                .andExpect(jsonPath("$.itens[0].observacao").value("depois do cafe"))
                .andExpect(jsonPath("$.itens[0].horarios[0]").value("08:00:00"))
                .andExpect(jsonPath("$.itens[0].horarios[1]").value("21:00:00"))
                .andExpect(jsonPath("$.itens[0].horarios.length()").value(2));

        // e continua igual quando le de novo do banco
        mockMvc.perform(comSessao(get("/planos/{id}", plano), paciente))
                .andExpect(jsonPath("$.itens[0].nomeMedicamento").value("Losartana Potássica"))
                .andExpect(jsonPath("$.itens[0].horarios[1]").value("21:00:00"));
    }

    @Test
    void editarACopiaNaAlteracaoMantemOrigemInicioEFoto() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID original = adicionarItem(paciente, plano, "Losartana", "08:00");
        enviarFoto(paciente, plano, original, "caixa.png", PNG).andExpect(status().isNoContent());
        revisarEConfirmar(paciente, plano);
        String inicio = json(mockMvc.perform(comSessao(get("/planos/{id}", plano), paciente))
                .andReturn().getResponse().getContentAsString())
                .get("itens").get(0).get("inicioTratamento").asText();

        JsonNode versao = json(mockMvc.perform(comSessao(post("/planos/{id}/alteracao", plano), paciente))
                .andReturn().getResponse().getContentAsString());
        UUID versaoId = UUID.fromString(versao.get("id").asText());
        UUID copia = UUID.fromString(versao.get("itens").get(0).get("id").asText());

        mockMvc.perform(comSessao(put("/planos/{p}/itens/{i}", versaoId, copia), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Losartana", "uso continuo", null, "09:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].id").value(copia.toString()))
                .andExpect(jsonPath("$.itens[0].itemOrigemId").value(original.toString()))
                .andExpect(jsonPath("$.itens[0].inicioTratamento").value(inicio))
                .andExpect(jsonPath("$.itens[0].temFoto").value(true))
                .andExpect(jsonPath("$.itens[0].horarios[0]").value("09:00:00"));
    }

    @Test
    void editarItemForaDaEdicaoRetorna409() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");
        mockMvc.perform(comSessao(post("/planos/{id}/revisar", plano), paciente)).andExpect(status().isOk());

        mockMvc.perform(comSessao(put("/planos/{p}/itens/{i}", plano, item), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Losartana", "uso continuo", null, "09:00")))
                .andExpect(status().isConflict());
    }

    @Test
    void editarItemQueNaoExisteRetorna404() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        adicionarItem(paciente, plano, "Losartana", "08:00");

        mockMvc.perform(comSessao(put("/planos/{p}/itens/{i}", plano, UUID.randomUUID()), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Losartana", "uso continuo", null, "09:00")))
                .andExpect(status().isNotFound());
    }

    @Test
    void editarItemComDadosInvalidosRetorna400ENaoMuda() throws Exception {
        UUID paciente = criarPaciente();
        UUID plano = criarPlano(paciente);
        UUID item = adicionarItem(paciente, plano, "Losartana", "08:00");

        mockMvc.perform(comSessao(put("/planos/{p}/itens/{i}", plano, item), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Losartana", "para sempre", null, "09:00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.duracaoTratamento").exists());
        // horario repetido tambem volta como campo invalido (contrato, TD-03)
        mockMvc.perform(comSessao(put("/planos/{p}/itens/{i}", plano, item), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item("Losartana", "uso continuo", null, "09:00", "09:00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.horarios").value("O mesmo horário foi informado mais de uma vez."));

        mockMvc.perform(comSessao(get("/planos/{id}", plano), paciente))
                .andExpect(jsonPath("$.itens[0].horarios[0]").value("08:00:00"))
                .andExpect(jsonPath("$.itens[0].duracaoTratamento").value("uso continuo"));
    }

    // ---------------------------------------------------------------- apoio

    private ResultActions enviarFoto(UUID paciente, UUID plano, UUID item, String nome, byte[] bytes)
            throws Exception {
        return mockMvc.perform(comSessao(multipart(HttpMethod.PUT, "/planos/{p}/itens/{i}/foto", plano, item)
                .file(new MockMultipartFile("arquivo", nome, "image/png", bytes)), paciente));
    }

    private <B extends AbstractMockHttpServletRequestBuilder<B>> B comSessao(B requisicao, UUID paciente) {
        return requisicao.sessionAttr(ContaController.CHAVE_SESSAO, paciente);
    }

    private JsonNode json(String texto) {
        return objectMapper.readTree(texto);
    }

    private UUID criarPaciente() throws Exception {
        String corpo = """
                {
                  "nome": "Pessoa Teste",
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

    private UUID adicionarItem(UUID paciente, UUID plano, String nome, String... horarios) throws Exception {
        String resposta = mockMvc.perform(comSessao(post("/planos/{id}/itens", plano), paciente)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item(nome, "uso continuo", null, horarios)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode itens = json(resposta).get("itens");
        return UUID.fromString(itens.get(itens.size() - 1).get("id").asText());
    }

    private void revisarEConfirmar(UUID paciente, UUID plano) throws Exception {
        mockMvc.perform(comSessao(post("/planos/{id}/revisar", plano), paciente)).andExpect(status().isOk());
        mockMvc.perform(comSessao(post("/planos/{id}/confirmar", plano), paciente)).andExpect(status().isOk());
    }

    private String item(String nome, String duracao, String observacao, String... horarios) {
        String lista = String.join("\", \"", horarios);
        String obs = observacao == null ? "null" : "\"" + observacao + "\"";
        return """
                {"nomeMedicamento": "%s", "dosagem": "50 mg", "frequencia": "diaria",
                 "duracaoTratamento": "%s", "horarios": ["%s"], "observacao": %s}
                """.formatted(nome, duracao, lista, obs);
    }
}
