package br.ufs.alarmed.plano.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

// Testes das regras de negocio na hora de montar um medicamento do plano.
class ItemDoPlanoTest {

    @Test
    void criaItemComOsDadosInformados() {
        ItemDoPlano item = new ItemDoPlano("Losartana", "50 mg", "oral", "12 em 12 horas", "uso contínuo",
                List.of(LocalTime.of(8, 0), LocalTime.of(20, 0)));

        assertThat(item.getNomeMedicamento()).isEqualTo("Losartana");
        assertThat(item.getDosagem()).isEqualTo("50 mg");
        assertThat(item.getViaAdministracao()).isEqualTo("oral");
        assertThat(item.getFrequencia()).isEqualTo("12 em 12 horas");
        assertThat(item.getDuracaoTratamento()).isEqualTo("uso contínuo");
        assertThat(item.getHorarios()).extracting(HorarioProgramado::getHora)
                .containsExactly(LocalTime.of(8, 0), LocalTime.of(20, 0));
    }

    @Test
    void viaDeAdministracaoEOpcional() {
        // DM12: nem toda receita informa a via
        ItemDoPlano item = new ItemDoPlano("Dipirona", "1 comprimido", null, "se necessário", "uso contínuo",
                List.of(LocalTime.of(8, 0)));

        assertThat(item.getViaAdministracao()).isNull();
    }

    @Test
    void falhaSemNenhumHorario() {
        assertThatThrownBy(() -> new ItemDoPlano("Losartana", "50 mg", "oral", "1 vez ao dia", "7 dias", List.of()))
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void falhaComHorarioRepetido() {
        assertThatThrownBy(() -> new ItemDoPlano("Losartana", "50 mg", "oral", "1 vez ao dia", "7 dias",
                List.of(LocalTime.of(8, 0), LocalTime.of(8, 0))))
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void listaDeHorariosDevolvidaNaoPodeSerAlterada() {
        ItemDoPlano item = new ItemDoPlano("Losartana", "50 mg", "oral", "1 vez ao dia", "7 dias",
                List.of(LocalTime.of(8, 0)));

        assertThatThrownBy(() -> item.getHorarios().add(new HorarioProgramado(LocalTime.of(9, 0))))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
