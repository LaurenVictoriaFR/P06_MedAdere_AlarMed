package br.ufs.alarmed.plano.model;

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
    // Adicionar e remover itens fica pras regras de transicao (proximo passo).
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

    //Getters 
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
