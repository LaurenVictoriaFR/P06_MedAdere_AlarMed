package br.ufs.alarmed.plano.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

// Um horario do dia em que o medicamento deve ser tomado (ex.: 08:00).
// Cada item do plano tem um ou mais horarios. As doses (Bloco D) sao geradas a partir deles.
@Entity
@Table(name = "horario_programado")
public class HorarioProgramado {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private LocalTime hora;

    // construtor vazio, exigido pelo JPA
    protected HorarioProgramado() {
    }

    public HorarioProgramado(LocalTime hora) {
        this.hora = Objects.requireNonNull(hora, "hora");
    }

    // Getters
    public UUID getId() {
        return id;
    }

    public LocalTime getHora() {
        return hora;
    }
}
