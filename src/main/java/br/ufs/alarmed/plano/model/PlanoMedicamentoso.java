package br.ufs.alarmed.plano.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

// Entidade principal do plano medicamentoso (UC-01).
// Por enquanto só tem os dados basicos
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SituacaoPlano situacao;

    protected PlanoMedicamentoso() {
    }

    // construtor para uso do JPA
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

    public SituacaoPlano getSituacao() {
        return situacao;
    }
}
