package br.ufs.alarmed.plano;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.ufs.alarmed.conta.controller.ContaController;
import br.ufs.alarmed.conta.model.ContaUsuario;
import br.ufs.alarmed.conta.model.Paciente;
import br.ufs.alarmed.conta.repository.ContaUsuarioRepository;
import br.ufs.alarmed.conta.repository.PacienteRepository;
import br.ufs.alarmed.dose.RelogioTeste;
import br.ufs.alarmed.dose.model.Dose;
import br.ufs.alarmed.dose.repository.DoseRepository;
import br.ufs.alarmed.dose.service.GeradorDoses;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// UC-04: o que acontece com as doses quando a alteracao e confirmada
// (DM09; Q-01 e QS-13 do P3; ADR-10). Usa o relogio de teste do Bloco D.
// Fuso do plano: America/Maceio (UTC-3). 08:00 local = 11:00Z; 20:00 local = 23:00Z.
@SpringBootTest
@AutoConfigureMockMvc
@Import(AlteracaoPlanoDosesIntegrationTest.Config.class)
class AlteracaoPlanoDosesIntegrationTest {

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        RelogioTeste relogioTeste() {
            return new RelogioTeste();
        }
    }

    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    RelogioTeste clock;
    @Autowired
    ContaUsuarioRepository contas;
    @Autowired
    PacienteRepository pacientes;
    @Autowired
    PlanoMedicamentosoRepository planos;
    @Autowired
    DoseRepository doses;
    @Autowired
    GeradorDoses gerador;

    UUID paciente;

    @BeforeEach
    void preparar() {
        // 22/11, 07:00 em Maceio
        clock.fixar("2026-11-22T10:00:00Z");
        var conta = contas.save(new ContaUsuario("Pessoa fictícia", UUID.randomUUID() + "@exemplo.test",
                "hash-teste", LocalDate.of(1990, 1, 1), null));
        paciente = pacientes.save(new Paciente(conta, "Pessoa fictícia")).getId();
    }

    @Test
    void confirmarAlteracaoTrocaProgramadasEMantemPendentesERegistradas() throws Exception {
        UUID antigo = criarPlanoConfirmado("Losartana", "uso continuo", "08:00", "20:00");
        gerador.gerar(antigo);

        // 22/11 08:30 local: a dose das 08:00 esta Pendente (janela aberta), a das 20:00 Programada
        clock.fixar("2026-11-22T11:30:00Z");
        UUID versao = iniciarAlteracao(antigo);
        UUID itemCopiado = UUID.fromString(lerPlano(versao).get("itens").get(0).get("id").asText());
        mvc.perform(sessao(post("/planos/{id}/itens", versao)).contentType(MediaType.APPLICATION_JSON)
                        .content(item("Metformina", "uso continuo", "21:00")))
                .andExpect(status().isOk());
        revisarEConfirmar(versao);

        assertThat(planos.findById(antigo).orElseThrow().getSituacao()).isEqualTo(SituacaoPlano.ENCERRADO);

        List<Dose> doPlanoAntigo = dosesDoPlano(antigo);
        // so sobra a dose das 08:00 de hoje, que ainda esta na janela (Q-01)
        assertThat(doPlanoAntigo).extracting(Dose::getId)
                .containsExactly(doPlanoAntigo.get(0).getItemId() + "@2026-11-22T08:00");

        // a versao nova comeca agora: 20:00 do item copiado e 21:00 do item novo, sem as 08:00 de hoje
        List<Dose> daVersaoNova = dosesDoPlano(versao);
        assertThat(daVersaoNova).isNotEmpty();
        assertThat(daVersaoNova).allMatch(d -> d.getProgramadaEm().isAfter(clock.instant()));
        assertThat(daVersaoNova).anyMatch(d -> d.getItemId().equals(itemCopiado)
                && d.getDataLocal().equals(LocalDate.of(2026, 11, 22)) && d.getHorario().equals(LocalTime.of(20, 0)));
        assertThat(daVersaoNova).anyMatch(d -> d.getHorario().equals(LocalTime.of(21, 0)));

        // a dose Pendente do plano antigo ainda pode ser registrada
        mvc.perform(sessao(put("/registros/{id}", doPlanoAntigo.get(0).getId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"tomada\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void doseJaRegistradaDoPlanoAntigoNaoMuda() throws Exception {
        UUID antigo = criarPlanoConfirmado("Losartana", "uso continuo", "08:00", "20:00");
        gerador.gerar(antigo);
        clock.fixar("2026-11-22T11:10:00Z");
        String doseDasOito = dosesDoPlano(antigo).get(0).getId();
        mvc.perform(sessao(put("/registros/{id}", doseDasOito))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"tomada\"}"))
                .andExpect(status().isOk());

        // depois da janela fechar, altera o plano
        clock.fixar("2026-11-22T14:00:00Z");
        UUID versao = iniciarAlteracao(antigo);
        revisarEConfirmar(versao);

        Dose registrada = doses.findById(doseDasOito).orElseThrow();
        assertThat(registrada.getEstado().name()).isEqualTo("TOMADA");
    }

    @Test
    void alterarOPlanoNaoReiniciaADuracaoDoTratamento() throws Exception {
        // tratamento de 2 dias comecou em 22/11: acaba em 23/11, mesmo alterando o plano em 23/11
        UUID antigo = criarPlanoConfirmado("Amoxicilina", "2 dias", "08:00", "20:00");
        gerador.gerar(antigo);

        clock.fixar("2026-11-23T10:00:00Z");
        UUID versao = iniciarAlteracao(antigo);
        revisarEConfirmar(versao);

        List<Dose> daVersaoNova = dosesDoPlano(versao);
        assertThat(daVersaoNova).isNotEmpty();
        assertThat(daVersaoNova).allMatch(d -> !d.getDataLocal().isAfter(LocalDate.of(2026, 11, 23)));
        assertThat(lerPlano(versao).get("itens").get(0).get("inicioTratamento").asText())
                .isEqualTo("2026-11-22");
    }

    private JsonNode lerPlano(UUID plano) throws Exception {
        return json.readTree(mvc.perform(sessao(get("/planos/{id}", plano)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private List<Dose> dosesDoPlano(UUID plano) {
        return doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente,
                        LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 31)).stream()
                .filter(d -> d.getPlanoId().equals(plano))
                .toList();
    }

    private UUID criarPlanoConfirmado(String nome, String duracao, String... horarios) throws Exception {
        UUID plano = UUID.fromString(json.readTree(mvc.perform(sessao(post("/planos")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asText());
        mvc.perform(sessao(post("/planos/{id}/itens", plano)).contentType(MediaType.APPLICATION_JSON)
                        .content(item(nome, duracao, horarios)))
                .andExpect(status().isOk());
        revisarEConfirmar(plano);
        return plano;
    }

    private UUID iniciarAlteracao(UUID confirmado) throws Exception {
        String resposta = mvc.perform(sessao(post("/planos/{id}/alteracao", confirmado)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(resposta).get("id").asText());
    }

    private void revisarEConfirmar(UUID plano) throws Exception {
        mvc.perform(sessao(post("/planos/{id}/revisar", plano))).andExpect(status().isOk());
        mvc.perform(sessao(post("/planos/{id}/confirmar", plano))).andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder sessao(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder requisicao) {
        return requisicao.sessionAttr(ContaController.CHAVE_SESSAO, paciente);
    }

    private String item(String nome, String duracao, String... horarios) {
        String lista = String.join("\", \"", horarios);
        return """
                {"nomeMedicamento": "%s", "dosagem": "50 mg", "frequencia": "diaria",
                 "duracaoTratamento": "%s", "horarios": ["%s"]}
                """.formatted(nome, duracao, lista);
    }
}
