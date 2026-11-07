package br.ufs.alarmed.plano.model;

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
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
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
        for (LocalTime hora : horarios) {
            this.horarios.add(new HorarioProgramado(hora));
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

    // devolve so pra leitura, pra ninguem mexer na lista por fora
    public List<HorarioProgramado> getHorarios() {
        return Collections.unmodifiableList(horarios);
    }
}
