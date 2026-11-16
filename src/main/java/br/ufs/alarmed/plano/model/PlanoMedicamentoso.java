package br.ufs.alarmed.plano.model;

import br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException;
import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

// Entidade principal do plano medicamentoso (UC-01).
// Por enquanto só tem os dados basicos
@Entity
@Table(name = "plano_medicamentoso")
public class PlanoMedicamentoso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Ainda e so um UUID solto, sem referencia pra tabela de paciente, porque o cadastro de paciente (Bloco B) ainda nao existe
    @Column(name = "paciente_id", nullable = false)
    private UUID pacienteId;

    @Column(name = "data_inicio", nullable = false)
    private LocalDate dataInicio;

    // opcional: fica vazio enquanto o plano estiver valendo
    @Column(name = "data_fim")
    private LocalDate dataFim;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SituacaoPlano situacao;

    // Os itens pertencem ao plano: se o item sai do plano, ele e apagado do banco.
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "plano_id", nullable = false)
    private List<ItemDoPlano> itens = new ArrayList<>();

    // construtor vazio, exigido pelo JPA
    protected PlanoMedicamentoso() {
    }

    // construtor usado de verdade, pra criar um plano novo
    public PlanoMedicamentoso(UUID pacienteId) {
        this.pacienteId = Objects.requireNonNull(pacienteId, "pacienteId");
        this.dataInicio = LocalDate.now();
        this.situacao = SituacaoPlano.EM_EDICAO;
    }

    // ---------------------------------------------------------------
    // Regras de transicao (MOD-03): a situacao so muda por estes metodos.
    //
    //   EM_EDICAO --revisarPlano()--> EM_REVISAO --confirmarPlano()--> CONFIRMADO
    //       ^                              |
    //       +-------- editarPlano() -------+   (corrigir, UC-08 A1)
    //
    // Itens so podem ser adicionados ou removidos em EM_EDICAO. Assim, qualquer
    // mudanca depois da revisao obriga o plano a voltar e ser revisado de novo.
    // ---------------------------------------------------------------

    // UC-01 passos 2 a 4: coloca um medicamento no plano
    public void adicionarItem(ItemDoPlano item) {
        Objects.requireNonNull(item, "item");
        exigirSituacao(SituacaoPlano.EM_EDICAO, "Só é possível adicionar medicamentos com o plano em edição.");
        itens.add(item);
    }

    // tira um medicamento do plano (os horarios dele saem junto)
    public void removerItem(UUID itemId) {
        exigirSituacao(SituacaoPlano.EM_EDICAO, "Só é possível remover medicamentos com o plano em edição.");
        boolean removeu = itens.removeIf(item -> item.getId() != null && item.getId().equals(itemId));
        if (!removeu) {
            throw new RecursoNaoEncontradoException("Medicamento não encontrado neste plano.");
        }
    }

    // UC-01 passo 6: manda o plano completo pra revisao (UC-08)
    public void revisarPlano() {
        exigirSituacao(SituacaoPlano.EM_EDICAO, "Só é possível revisar um plano que está em edição.");
        if (itens.isEmpty()) {
            throw new RegraNegocioException("Adicione ao menos um medicamento antes de revisar o plano.");
        }
        this.situacao = SituacaoPlano.EM_REVISAO;
    }

    // UC-08 A1: o usuario achou erro na revisao e volta pra edicao, com tudo preservado
    public void editarPlano() {
        exigirSituacao(SituacaoPlano.EM_REVISAO, "Só é possível voltar para a edição a partir da revisão.");
        this.situacao = SituacaoPlano.EM_EDICAO;
    }

    // UC-01 passo 7 / UC-08 passo 3: confirma o plano revisado.
    // RN01 / R03: sem passar pela revisao, o servidor bloqueia (UC-01 A2).
    public void confirmarPlano() {
        exigirSituacao(SituacaoPlano.EM_REVISAO, "O plano precisa ser revisado antes de ser confirmado (RN01).");
        this.situacao = SituacaoPlano.CONFIRMADO;
    }

    // confere a situacao atual e, se nao for a esperada, barra a operacao
    private void exigirSituacao(SituacaoPlano esperada, String mensagem) {
        if (this.situacao != esperada) {
            throw new RegraNegocioException(mensagem);
        }
    }

    // Getters
    public UUID getId() {
        return id;
    }

    public UUID getPacienteId() {
        return pacienteId;
    }

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public SituacaoPlano getSituacao() {
        return situacao;
    }

    // devolve so pra leitura, pra ninguem mexer na lista por fora
    public List<ItemDoPlano> getItens() {
        return Collections.unmodifiableList(itens);
    }
}
