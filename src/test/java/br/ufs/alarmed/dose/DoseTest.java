package br.ufs.alarmed.dose;

import static org.assertj.core.api.Assertions.*;
import br.ufs.alarmed.dose.model.*;
import br.ufs.alarmed.comum.util.DuracaoTratamento;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DoseTest {
    private final Instant t = Instant.parse("2026-11-22T11:00:00Z");
    private Dose dose() {
        return new Dose(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), LocalDate.of(2026,11,22),
                LocalTime.of(8,0), t, t.plusSeconds(121*60));
    }
    @Test void qs02Limites119120E121() {
        for (int minuto : new int[]{119,120}) {
            Dose d = dose(); d.registrar(EstadoDose.TOMADA, t.plusSeconds(minuto*60));
            assertThat(d.getEstado()).isEqualTo(EstadoDose.TOMADA);
        }
        Dose d = dose();
        assertThatThrownBy(() -> d.registrar(EstadoDose.TOMADA,t.plusSeconds(121*60))).hasMessageContaining("prazo");
        assertThat(d.getEstado()).isEqualTo(EstadoDose.NAO_TOMADA);
        assertThat(d.isAutomatica()).isTrue();
    }
    @Test void minuto120InteiroAindaAceita() {
        Dose d = dose(); d.registrar(EstadoDose.TOMADA,t.plusSeconds(120*60+59));
        assertThat(d.getEstado()).isEqualTo(EstadoDose.TOMADA);
    }
    @Test void antesDeTEstaProgramadaERecusaRegistro() {
        Dose d = dose();
        assertThatThrownBy(() -> d.registrar(EstadoDose.TOMADA,t.minusSeconds(1))).hasMessageContaining("Ainda não");
        assertThat(d.getEstado()).isEqualTo(EstadoDose.PROGRAMADA);
        d.atualizar(t); assertThat(d.getEstado()).isEqualTo(EstadoDose.PENDENTE);
    }
    @Test void resultadoNaoPodeSerSobrescritoPelaExpiracao() {
        Dose d = dose(); d.registrar(EstadoDose.TOMADA,t.plusSeconds(20));
        d.atualizar(t.plusSeconds(9000)); assertThat(d.getEstado()).isEqualTo(EstadoDose.TOMADA);
        assertThatThrownBy(() -> d.registrar(EstadoDose.NAO_TOMADA,t.plusSeconds(9000))).hasMessageContaining("já foi");
    }
    @Test void desfazerSoDentroDaJanela() {
        Dose d = dose(); d.registrar(EstadoDose.NAO_TOMADA,t.plusSeconds(20));
        d.desfazer(t.plusSeconds(30)); assertThat(d.getEstado()).isEqualTo(EstadoDose.PENDENTE);
        d.registrar(EstadoDose.TOMADA,t.plusSeconds(40));
        assertThatThrownBy(() -> d.desfazer(t.plusSeconds(121*60))).hasMessageContaining("corrigir");
        assertThat(d.getEstado()).isEqualTo(EstadoDose.TOMADA);
    }
    @Test void tratamentoFinitoETextoInvalido() {
        LocalDate inicio = LocalDate.of(2026,11,22);
        assertThat(DuracaoTratamento.fim("7 dias",inicio)).isEqualTo(inicio.plusDays(6));
        assertThat(DuracaoTratamento.fim("uso contínuo",inicio)).isNull();
        assertThat(DuracaoTratamento.fim("até 30/11/2026",inicio)).isEqualTo(LocalDate.of(2026,11,30));
        assertThatThrownBy(() -> DuracaoTratamento.fim("até 31/02/2027",inicio)).hasMessageContaining("inválida");
        assertThatThrownBy(() -> DuracaoTratamento.fim("algum tempo",inicio)).hasMessageContaining("inválida");
        assertThatThrownBy(() -> DuracaoTratamento.fim("0 dias",inicio)).hasMessageContaining("inválida");
    }
}
