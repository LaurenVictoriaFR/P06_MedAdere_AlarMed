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
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
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

    private Instant confirmadoEm;
    @Column(length = 60)
    private String fusoHorario;
    private LocalDate geradoAte;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SituacaoPlano situacao;

    // UC-04: nesta versao em edicao, o plano confirmado que ela vai substituir.
    // Null no primeiro cadastro.
    @Column(name = "plano_anterior_id")
    private UUID planoAnteriorId;

    // bloqueio otimista (TD-05): se duas requisicoes mexem no mesmo plano ao mesmo
    // tempo, a segunda falha em vez de atropelar a primeira
    @Version
    @Column(nullable = false)
    private long versao;

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
    // Alteracao (UC-04, SD04): iniciarAlteracao() no plano CONFIRMADO cria uma versao
    // nova em EM_EDICAO, que segue o mesmo caminho acima. O confirmado continua valendo
    // ate a versao nova ser confirmada; ai ele passa por encerrarPlano() -> ENCERRADO.
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
        confirmarPlano(Instant.now(), ZoneId.of("America/Maceio"));
    }

    public void confirmarPlano(Instant agora, ZoneId fuso) {
        exigirSituacao(SituacaoPlano.EM_REVISAO, "O plano precisa ser revisado antes de ser confirmado (RN01).");
        LocalDate inicio = agora.atZone(fuso).toLocalDate();
        for (ItemDoPlano item : itens) {
            // item copiado de uma alteracao conta a duracao a partir do inicio original
            LocalDate inicioDoItem = item.getInicioTratamento() != null ? item.getInicioTratamento() : inicio;
            br.ufs.alarmed.comum.util.DuracaoTratamento.fim(item.getDuracaoTratamento(), inicioDoItem);
            if (item.getHorarios().stream().anyMatch(h -> h.getHora().getSecond() != 0 || h.getHora().getNano() != 0))
                throw new RegraNegocioException("Informe horários com precisão de minutos (HH:MM).");
        }
        for (ItemDoPlano item : itens) {
            item.iniciarTratamentoSeNovo(inicio);
        }
        this.confirmadoEm = agora;
        this.fusoHorario = fuso.getId();
        this.dataInicio = inicio;
        this.situacao = SituacaoPlano.CONFIRMADO;
    }

    // UC-04 passo 2 (SD04): abre a alteracao do plano confirmado. Devolve a versao
    // nova, em EM_EDICAO, com copia dos itens. Este plano nao muda: continua valendo
    // e gerando lembretes ate a versao nova ser revisada e confirmada (RN01).
    public PlanoMedicamentoso iniciarAlteracao() {
        exigirSituacao(SituacaoPlano.CONFIRMADO, "Só é possível alterar um plano confirmado.");
        PlanoMedicamentoso versaoNova = new PlanoMedicamentoso(pacienteId);
        versaoNova.planoAnteriorId = this.id;
        for (ItemDoPlano item : itens) {
            versaoNova.itens.add(item.copiar());
        }
        return versaoNova;
    }

    // UC-04 A3 / UC-08 A2: desiste do cadastro ou da alteracao antes de confirmar.
    // So confere a regra; quem apaga do banco e o service.
    public void cancelarAlteracao() {
        if (situacao != SituacaoPlano.EM_EDICAO && situacao != SituacaoPlano.EM_REVISAO) {
            throw new RegraNegocioException("Só é possível cancelar um cadastro ou alteração que ainda não foi confirmado.");
        }
    }

    // MOD-03: CONFIRMADO -> ENCERRADO. Chamado quando a versao nova do plano e confirmada.
    // Plano encerrado nao gera mais doses (o GeradorDoses so gera para CONFIRMADO).
    public void encerrarPlano(LocalDate dataFim) {
        exigirSituacao(SituacaoPlano.CONFIRMADO, "Só é possível encerrar um plano confirmado.");
        this.dataFim = Objects.requireNonNull(dataFim, "dataFim");
        this.situacao = SituacaoPlano.ENCERRADO;
    }

    public boolean ehAlteracao() {
        return planoAnteriorId != null;
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

    public Instant getConfirmadoEm() { return confirmadoEm; }
    public String getFusoHorario() { return fusoHorario; }
    public LocalDate getGeradoAte() { return geradoAte; }
    public void registrarGeracao(LocalDate ate) { this.geradoAte = ate; }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public SituacaoPlano getSituacao() {
        return situacao;
    }

    public UUID getPlanoAnteriorId() {
        return planoAnteriorId;
    }

    // devolve so pra leitura, pra ninguem mexer na lista por fora
    public List<ItemDoPlano> getItens() {
        return Collections.unmodifiableList(itens);
    }
}
