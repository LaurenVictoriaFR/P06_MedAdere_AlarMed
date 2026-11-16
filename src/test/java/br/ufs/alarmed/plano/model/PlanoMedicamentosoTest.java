package br.ufs.alarmed.plano.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException;
import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

// Testes das regras de transicao do plano (MOD-03) e da RN01.
class PlanoMedicamentosoTest {

    @Test
    void novoPlanoComecaEmEdicaoComDataDeHoje() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());

        assertThat(plano.getSituacao()).isEqualTo(SituacaoPlano.EM_EDICAO);
        assertThat(plano.getDataInicio()).isEqualTo(LocalDate.now());
        assertThat(plano.getDataFim()).isNull();
        assertThat(plano.getItens()).isEmpty();
    }

    @Test
    void adicionarItemFuncionaEmEdicao() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());

        plano.adicionarItem(itemQualquer());

        assertThat(plano.getItens()).hasSize(1);
    }

    @Test
    void adicionarItemFalhaForaDaEdicao() {
        PlanoMedicamentoso plano = planoEmRevisaoComUmItem();

        assertThatThrownBy(() -> plano.adicionarItem(itemQualquer()))
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void removerItemFuncionaEmEdicao() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());
        ItemDoPlano item = itemQualquer();
        // em producao quem atribui o id e o JPA ao persistir; aqui simulamos pra testar so a regra de negocio
        UUID itemId = UUID.randomUUID();
        ReflectionTestUtils.setField(item, "id", itemId);
        plano.adicionarItem(item);

        plano.removerItem(itemId);

        assertThat(plano.getItens()).isEmpty();
    }

    @Test
    void removerItemFalhaForaDaEdicao() {
        PlanoMedicamentoso plano = planoEmRevisaoComUmItem();
        UUID itemId = plano.getItens().get(0).getId();

        assertThatThrownBy(() -> plano.removerItem(itemId))
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void removerItemInexistenteLancaRecursoNaoEncontrado() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());
        plano.adicionarItem(itemQualquer());

        assertThatThrownBy(() -> plano.removerItem(UUID.randomUUID()))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void revisarPlanoFalhaSemItens() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());

        assertThatThrownBy(plano::revisarPlano)
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void revisarPlanoMudaParaEmRevisao() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());
        plano.adicionarItem(itemQualquer());

        plano.revisarPlano();

        assertThat(plano.getSituacao()).isEqualTo(SituacaoPlano.EM_REVISAO);
    }

    @Test
    void revisarPlanoFalhaSeJaEstiverEmRevisao() {
        PlanoMedicamentoso plano = planoEmRevisaoComUmItem();

        assertThatThrownBy(plano::revisarPlano)
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void editarPlanoVoltaParaEdicaoPreservandoOsItens() {
        PlanoMedicamentoso plano = planoEmRevisaoComUmItem();

        plano.editarPlano();

        assertThat(plano.getSituacao()).isEqualTo(SituacaoPlano.EM_EDICAO);
        assertThat(plano.getItens()).hasSize(1);
    }

    @Test
    void editarPlanoFalhaForaDaRevisao() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());

        assertThatThrownBy(plano::editarPlano)
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void confirmarPlanoFalhaSemPassarPelaRevisao() {
        // RN01: nao pode confirmar direto da edicao, tem que passar pela revisao antes
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());
        plano.adicionarItem(itemQualquer());

        assertThatThrownBy(plano::confirmarPlano)
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void confirmarPlanoFuncionaDepoisDaRevisao() {
        PlanoMedicamentoso plano = planoEmRevisaoComUmItem();

        plano.confirmarPlano();

        assertThat(plano.getSituacao()).isEqualTo(SituacaoPlano.CONFIRMADO);
    }

    @Test
    void listaDeItensDevolvidaNaoPodeSerAlterada() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());
        plano.adicionarItem(itemQualquer());

        assertThatThrownBy(() -> plano.getItens().add(itemQualquer()))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    private PlanoMedicamentoso planoEmRevisaoComUmItem() {
        PlanoMedicamentoso plano = new PlanoMedicamentoso(UUID.randomUUID());
        plano.adicionarItem(itemQualquer());
        plano.revisarPlano();
        return plano;
    }

    private ItemDoPlano itemQualquer() {
        return new ItemDoPlano("Losartana", "50 mg", "oral", "12 em 12 horas", "uso contínuo",
                List.of(LocalTime.of(8, 0)));
    }
}
