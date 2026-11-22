package br.ufs.alarmed.dose;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.ufs.alarmed.conta.controller.ContaController;
import br.ufs.alarmed.conta.model.*;
import br.ufs.alarmed.conta.repository.*;
import br.ufs.alarmed.dose.model.*;
import br.ufs.alarmed.dose.repository.*;
import br.ufs.alarmed.dose.service.*;
import br.ufs.alarmed.notificacao.model.*;
import br.ufs.alarmed.notificacao.repository.*;
import br.ufs.alarmed.notificacao.service.*;
import br.ufs.alarmed.plano.model.*;
import br.ufs.alarmed.plano.repository.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest @AutoConfigureMockMvc @Import(DosesIntegrationTest.Config.class)
class DosesIntegrationTest {
    @TestConfiguration static class Config {
        @Bean @Primary RelogioTeste relogioTeste() { return new RelogioTeste(); }
    }
    @Autowired MockMvc mvc;
    @Autowired RelogioTeste clock;
    @Autowired ContaUsuarioRepository contas;
    @Autowired PacienteRepository pacientes;
    @Autowired PlanoMedicamentosoRepository planos;
    @Autowired DoseRepository doses;
    @Autowired GeradorDoses gerador;
    @Autowired LeitorDose leitor;
    @Autowired ProcessadorLembrete processador;
    @Autowired LembreteRepository lembretes;
    @Autowired EntregaPushRepository entregas;
    @Autowired InscricaoPushRepository inscricoes;
    @Autowired org.springframework.transaction.PlatformTransactionManager transacoes;
    @MockitoBean EmissorPush emissor;
    UUID paciente;
    UUID plano;
    Instant t = Instant.parse("2026-11-22T11:00:00Z");

    @BeforeEach void preparar() {
        clock.fixar("2026-11-22T10:00:00Z");
        paciente = novoPaciente();
        plano = novoPlano("uso contínuo", List.of(LocalTime.of(8,0),LocalTime.of(20,0)));
        when(emissor.configurado()).thenReturn(true);
        when(emissor.enviar(any(),any(),anyInt())).thenReturn(201);
    }
    UUID novoPaciente() {
        var conta = contas.save(new ContaUsuario("Pessoa fictícia",UUID.randomUUID()+"@exemplo.test","hash-teste",LocalDate.of(1990,1,1),null));
        return pacientes.save(new Paciente(conta,"Pessoa fictícia")).getId();
    }
    UUID novoPlano(String duracao, List<LocalTime> horarios) {
        PlanoMedicamentoso p = new PlanoMedicamentoso(paciente);
        p.adicionarItem(new ItemDoPlano("Medicamento fictício","50 mg · 1 comprimido","oral","diária",duracao,horarios));
        p.revisarPlano(); p.confirmarPlano(clock.instant(),ZoneId.of("America/Maceio"));
        return planos.saveAndFlush(p).getId();
    }
    String doseId() {
        gerador.gerar(plano);
        return doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente,LocalDate.of(2026,11,22),LocalDate.of(2026,11,22)).get(0).getId();
    }
    InscricaoPush inscrever() {
        return inscricoes.save(new InscricaoPush(paciente,"https://fcm.googleapis.com/fake/"+UUID.randomUUID(),UUID.randomUUID().toString(),"chave-teste","auth-teste"));
    }

    @Test void geracaoIdempotenteEMeiaNoite() {
        gerador.gerar(plano); long quantidade = doses.count(); gerador.gerar(plano);
        assertThat(doses.count()).isEqualTo(quantidade);
        var d = doses.findById(doseId()).orElseThrow();
        assertThat(d.getProgramadaEm()).isEqualTo(t); // 08:00 no fuso do plano, UTC-3.
        assertThat(d.getFimJanela()).isEqualTo(t.plusSeconds(121*60));
    }
    @Test void horariosAnterioresAConfirmacaoNaoGeramDoses() {
        clock.fixar("2026-11-22T13:30:00Z");
        UUID outro = novoPlano("1 dia",List.of(LocalTime.of(8,0),LocalTime.of(20,0)));
        gerador.gerar(outro);
        var lista = doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente,LocalDate.of(2026,11,22),LocalDate.of(2026,11,30));
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).getHorario()).isEqualTo(LocalTime.of(20,0));
    }
    @Test void proximaDoseFechaJanelaETratamentoAcabaNoUltimoDia() {
        UUID curto = novoPlano("1 dia",List.of(LocalTime.of(8,0),LocalTime.of(9,0)));
        gerador.gerar(curto);
        var lista = doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente,LocalDate.of(2026,11,22),LocalDate.of(2026,11,30));
        assertThat(lista).hasSize(2);
        assertThat(lista.get(0).getFimJanela()).isEqualTo(t.plusSeconds(3600));
    }
    @Test void qs02ApiValida119120121ERelogioServidor() throws Exception {
        String id = doseId();
        clock.fixar(t.plusSeconds(119*60));
        mvc.perform(put("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"tomada\",\"em\":\"2099-01-01T00:00:00Z\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.em").value(clock.instant().toString()));
        mvc.perform(delete("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,paciente)).andExpect(status().isNoContent());
        clock.fixar(t.plusSeconds(120*60+59));
        mvc.perform(put("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"nao_tomada\"}"))
                .andExpect(status().isOk());
        mvc.perform(delete("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,paciente)).andExpect(status().isNoContent());
        clock.fixar(t.plusSeconds(121*60));
        mvc.perform(put("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"tomada\"}"))
                .andExpect(status().isConflict());
        assertThat(doses.findById(id).orElseThrow().isAutomatica()).isTrue();
    }
    @Test void qs06IsolamentoSemSessaoEStatusInvalido() throws Exception {
        String id = doseId();
        mvc.perform(get("/doses")).andExpect(status().isUnauthorized());
        mvc.perform(put("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,novoPaciente())
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"tomada\"}")).andExpect(status().isNotFound());
        mvc.perform(put("/registros/{id}",id).sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"qualquer\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/doses?de=banana").sessionAttr(ContaController.CHAVE_SESSAO,paciente)).andExpect(status().isBadRequest());
    }
    @Test void qs01Qs12UmaSolicitacaoPorAparelhoMesmoComDuasVarreduras() {
        String id = doseId(); inscrever(); clock.fixar(t.plusSeconds(30));
        processador.processar(id); processador.processar(id);
        verify(emissor,times(1)).enviar(any(),argThat(payload -> new String(payload,java.nio.charset.StandardCharsets.UTF_8).contains(id)),intThat(ttl -> ttl > 0));
        assertThat(lembretes.findById(id).orElseThrow().getSituacao()).isEqualTo("ACEITA_PELO_SERVICO");
    }
    @Test void qs03DisputaEntreRegistroEExpiracaoEmDezExecucoes() throws Exception {
        gerador.gerar(plano);
        var lista = doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente,LocalDate.of(2026,11,22),LocalDate.of(2026,11,29));
        try (var executor = Executors.newFixedThreadPool(2)) {
            for (var dose : lista.subList(0,10)) {
                var inicio = new CountDownLatch(1);
                var usuarioVenceu = new java.util.concurrent.atomic.AtomicBoolean();
                var registro = executor.submit(() -> {
                    inicio.await();
                    try { new TransactionTemplate(transacoes).execute(s -> {
                        doses.bloquear(dose.getId()).orElseThrow().registrar(EstadoDose.TOMADA,dose.getFimJanela().minusSeconds(1));
                        return null;
                    }); usuarioVenceu.set(true); }
                    catch (br.ufs.alarmed.comum.excecao.RegraNegocioException esperado) { }
                    return null;
                });
                var expiracao = executor.submit(() -> {
                    inicio.await();
                    new TransactionTemplate(transacoes).execute(s -> {
                        doses.bloquear(dose.getId()).orElseThrow().atualizar(dose.getFimJanela()); return null;
                    }); return null;
                });
                inicio.countDown(); registro.get(10,TimeUnit.SECONDS); expiracao.get(10,TimeUnit.SECONDS);
                var finalizada = doses.findById(dose.getId()).orElseThrow();
                assertThat(finalizada.getEstado()).isEqualTo(usuarioVenceu.get() ? EstadoDose.TOMADA : EstadoDose.NAO_TOMADA);
                assertThat(finalizada.isAutomatica()).isEqualTo(!usuarioVenceu.get());
            }
        }
    }
    @Test void qs12VarredurasConcorrentesSolicitamPushUmaVez() throws Exception {
        String id = doseId(); inscrever(); clock.fixar(t.plusSeconds(30));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var inicio = new CountDownLatch(1);
            var a = executor.submit(() -> { inicio.await(); processador.processar(id); return null; });
            var b = executor.submit(() -> { inicio.await(); processador.processar(id); return null; });
            inicio.countDown(); a.get(10,TimeUnit.SECONDS); b.get(10,TimeUnit.SECONDS);
        }
        verify(emissor,times(1)).enviar(any(),any(),anyInt());
        var entrega = entregas.findAll().stream().filter(e -> e.getPrimeiraTentativaEm() != null
                && e.getPrimeiraTentativaEm().equals(t.plusSeconds(30))).findFirst().orElseThrow();
        assertThat(Duration.between(t,entrega.getPrimeiraTentativaEm()).getSeconds()).isLessThanOrEqualTo(60);
    }
    @Test void pushRecusaEndpointArbitrarioEExigeSessao() throws Exception {
        var par = WebPushTransporteTest.chaves();
        String corpo = "{\"endpoint\":\"https://127.0.0.1/interno\",\"keys\":{\"p256dh\":\"%s\",\"auth\":\"%s\"}}"
                .formatted(WebPushTransporteTest.publica(par),Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]));
        mvc.perform(post("/push/inscricoes").contentType(MediaType.APPLICATION_JSON).content(corpo)).andExpect(status().isUnauthorized());
        mvc.perform(post("/push/inscricoes").sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo)).andExpect(status().isConflict());
    }
    @Test void cadastroInscricaoIdempotenteELogoutInvalidaSessao() throws Exception {
        var par = WebPushTransporteTest.chaves();
        String endpoint = "https://fcm.googleapis.com/fake/"+UUID.randomUUID();
        String corpo = "{\"endpoint\":\"%s\",\"keys\":{\"p256dh\":\"%s\",\"auth\":\"%s\"}}"
                .formatted(endpoint,WebPushTransporteTest.publica(par),Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]));
        for (int i=0;i<2;i++) mvc.perform(post("/push/inscricoes").sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo)).andExpect(status().isCreated());
        assertThat(inscricoes.findByPacienteIdAndAtivaTrueOrderById(paciente)).hasSize(1);
        mvc.perform(delete("/push/inscricoes").sessionAttr(ContaController.CHAVE_SESSAO,paciente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"endpoint\":\""+endpoint+"\"}")).andExpect(status().isNoContent());
        assertThat(inscricoes.findByPacienteIdAndAtivaTrueOrderById(paciente)).isEmpty();
        var sessao = new org.springframework.mock.web.MockHttpSession();
        sessao.setAttribute(ContaController.CHAVE_SESSAO,paciente);
        mvc.perform(post("/logout").session(sessao)).andExpect(status().isNoContent());
        assertThat(sessao.isInvalid()).isTrue();
    }
    @Test void qs10RecuperacaoNaoEnviaLembreteExpirado() {
        String id = doseId(); inscrever(); clock.fixar(t.plusSeconds(121*60));
        processador.processar(id);
        verify(emissor,never()).enviar(any(),any(),anyInt());
        assertThat(doses.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoDose.NAO_TOMADA);
    }
    @Test void consultaPodeExpirarDoseSemDeixarLembretePresoEmRepeticao() {
        String id = doseId(); inscrever(); clock.fixar(t);
        when(emissor.enviar(any(),any(),anyInt())).thenReturn(503);
        processador.processar(id);
        clock.fixar(t.plusSeconds(121*60)); leitor.ler(id,paciente);
        assertThat(doses.idsVencidas(clock.instant(),List.of(EstadoDose.PROGRAMADA,EstadoDose.PENDENTE))).contains(id);
        processador.processar(id);
        assertThat(lembretes.findById(id).orElseThrow().getSituacao()).isEqualTo("EXPIRADO");
        assertThat(doses.idsVencidas(clock.instant(),List.of(EstadoDose.PROGRAMADA,EstadoDose.PENDENTE))).doesNotContain(id);
    }
    @Test void inscricaoExpiradaETratadaSemEnvioInfinito() {
        String id = doseId(); var inscricao = inscrever(); clock.fixar(t);
        when(emissor.enviar(any(),any(),anyInt())).thenReturn(410);
        processador.processar(id); processador.processar(id);
        verify(emissor,times(1)).enviar(any(),any(),anyInt());
        assertThat(inscricoes.findById(inscricao.getId()).orElseThrow().isAtiva()).isFalse();
    }
    @Test void falhasRecentesFicamVisiveisSomenteParaODonoDaDose() throws Exception {
        String id = doseId(); inscrever(); clock.fixar(t);
        when(emissor.enviar(any(),any(),anyInt())).thenReturn(410);
        processador.processar(id);
        mvc.perform(get("/push/situacao").sessionAttr(ContaController.CHAVE_SESSAO,paciente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.falhasRecentes").value(1));
        mvc.perform(get("/push/situacao").sessionAttr(ContaController.CHAVE_SESSAO,novoPaciente()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.falhasRecentes").value(0));
    }
    @Test void falhaTransitoriaRepeteSemReenviarAoAparelhoJaAceito() {
        String id = doseId(); var a = inscrever(); var b = inscrever(); clock.fixar(t);
        when(emissor.enviar(argThat(i -> i.getId().equals(b.getId())),any(),anyInt())).thenReturn(503,201);
        processador.processar(id); processador.processar(id);
        clock.fixar(t.plusSeconds(31)); processador.processar(id);
        verify(emissor,times(1)).enviar(argThat(i -> i.getId().equals(a.getId())),any(),anyInt());
        verify(emissor,times(2)).enviar(argThat(i -> i.getId().equals(b.getId())),any(),anyInt());
    }
    @Test void qs03ConcorrenciaNaoSobrescreveRegistro() throws Exception {
        String id = doseId(); clock.fixar(t.plusSeconds(120*60));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var inicio = new CountDownLatch(1);
            var um = executor.submit(() -> { inicio.await(); new TransactionTemplate(transacoes).execute(s -> {
                var d = doses.bloquear(id).orElseThrow(); d.registrar(EstadoDose.TOMADA,clock.instant()); return null;
            }); return null; });
            var dois = executor.submit(() -> { inicio.await(); processador.processar(id); return null; });
            inicio.countDown(); um.get(10,TimeUnit.SECONDS); dois.get(10,TimeUnit.SECONDS);
        }
        assertThat(doses.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoDose.TOMADA);
        clock.fixar(t.plusSeconds(121*60)); processador.processar(id);
        assertThat(doses.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoDose.TOMADA);
    }
    @Test void qs12GeracaoConcorrenteNaoDuplica() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var inicio = new CountDownLatch(1);
            var a = executor.submit(() -> { inicio.await(); gerador.gerar(plano); return null; });
            var b = executor.submit(() -> { inicio.await(); gerador.gerar(plano); return null; });
            inicio.countDown(); a.get(10,TimeUnit.SECONDS); b.get(10,TimeUnit.SECONDS);
        }
        assertThat(doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente,LocalDate.of(2026,11,22),LocalDate.of(2026,11,29))).hasSize(16);
    }
}
