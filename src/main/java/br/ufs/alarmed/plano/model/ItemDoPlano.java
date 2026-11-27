package br.ufs.alarmed.plano.model;

import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

// Um medicamento dentro do plano, com a dosagem e os horarios em que deve ser tomado.
@Entity
@Table(name = "item_do_plano")
public class ItemDoPlano {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "nome_medicamento", nullable = false, length = 120)
    private String nomeMedicamento;

    // texto livre, do jeito que esta na receita (ex.: "500 mg", "1 comprimido")
    @Column(nullable = false, length = 60)
    private String dosagem;

    // opcional, porque nem toda receita informa a via (DM12). Ex.: "oral"
    @Column(name = "via_administracao", length = 60)
    private String viaAdministracao;

    // texto livre, ex.: "8 em 8 horas", "1 vez ao dia"
    @Column(nullable = false, length = 60)
    private String frequencia;

    // texto livre, ex.: "7 dias" ou "uso continuo"
    @Column(name = "duracao_tratamento", nullable = false, length = 60)
    private String duracaoTratamento;

    // Reservado pra foto da caixa (RF008). Fica vazio nesta entrega, so vai ser usado no P4.
    @Column(name = "foto_caixa")
    private String fotoCaixa;

    // UC-04: item do plano anterior de onde esta copia veio. Null pra item novo.
    @Column(name = "item_origem_id")
    private UUID itemOrigemId;

    // dia em que a contagem da duracao comeca. Preenchido na confirmacao;
    // a copia da alteracao mantem a do original, pra nao reiniciar o tratamento.
    @Column(name = "inicio_tratamento")
    private LocalDate inicioTratamento;

    // Os horarios pertencem ao item: se o item sai do plano, os horarios saem junto.
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "item_id", nullable = false)
    @OrderBy("hora")
    private List<HorarioProgramado> horarios = new ArrayList<>();

    // construtor vazio, exigido pelo JPA
    protected ItemDoPlano() {
    }

    // viaAdministracao pode vir null, o resto e obrigatorio
    public ItemDoPlano(String nomeMedicamento, String dosagem, String viaAdministracao,
            String frequencia, String duracaoTratamento, List<LocalTime> horarios) {
        this.nomeMedicamento = Objects.requireNonNull(nomeMedicamento, "nomeMedicamento");
        this.dosagem = Objects.requireNonNull(dosagem, "dosagem");
        this.viaAdministracao = viaAdministracao;
        this.frequencia = Objects.requireNonNull(frequencia, "frequencia");
        this.duracaoTratamento = Objects.requireNonNull(duracaoTratamento, "duracaoTratamento");
        Objects.requireNonNull(horarios, "horarios");

        // todo medicamento precisa de pelo menos um horario (UC-01, fluxo A1)
        if (horarios.isEmpty()) {
            throw new RegraNegocioException("Informe ao menos um horário para o medicamento.");
        }

        // o mesmo horario duas vezes geraria dose repetida
        if (new HashSet<>(horarios).size() != horarios.size()) {
            throw new RegraNegocioException("O mesmo horário foi informado mais de uma vez.");
        }

        for (LocalTime hora : horarios) {
            this.horarios.add(new HorarioProgramado(hora));
        }
    }

    // UC-04: copia o item pra versao em edicao do plano. A copia ganha id novo,
    // lembra de qual item veio e continua a contagem da duracao de onde o original estava.
    public ItemDoPlano copiar() {
        List<LocalTime> horas = horarios.stream().map(HorarioProgramado::getHora).toList();
        ItemDoPlano copia = new ItemDoPlano(nomeMedicamento, dosagem, viaAdministracao,
                frequencia, duracaoTratamento, horas);
        copia.itemOrigemId = this.id;
        copia.inicioTratamento = this.inicioTratamento;
        copia.fotoCaixa = this.fotoCaixa;
        return copia;
    }

    // na confirmacao: item novo comeca o tratamento no dia da confirmacao;
    // item copiado ja tem a data do original e fica como esta.
    void iniciarTratamentoSeNovo(LocalDate dia) {
        if (inicioTratamento == null) {
            inicioTratamento = dia;
        }
    }

    // Getters
    public UUID getId() {
        return id;
    }

    public String getNomeMedicamento() {
        return nomeMedicamento;
    }

    public String getDosagem() {
        return dosagem;
    }

    public String getViaAdministracao() {
        return viaAdministracao;
    }

    public String getFrequencia() {
        return frequencia;
    }

    public String getDuracaoTratamento() {
        return duracaoTratamento;
    }

    public String getFotoCaixa() {
        return fotoCaixa;
    }

    public UUID getItemOrigemId() {
        return itemOrigemId;
    }

    public LocalDate getInicioTratamento() {
        return inicioTratamento;
    }

    // devolve so pra leitura, pra ninguem mexer na lista por fora
    public List<HorarioProgramado> getHorarios() {
        return Collections.unmodifiableList(horarios);
    }
}
