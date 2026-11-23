package br.ufs.alarmed.dose.model;

import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

@Entity
@Table(name = "dose")
public class Dose {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false) private UUID planoId;
    @Column(nullable = false) private UUID itemId;
    @Column(nullable = false) private UUID pacienteId;
    @Column(nullable = false) private LocalDate dataLocal;
    @Column(nullable = false) private LocalTime horario;
    @Column(nullable = false) private Instant programadaEm;
    @Column(nullable = false) private Instant fimJanela;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private EstadoDose estado;
    @Column(nullable = false) private boolean automatica;
    private Instant registradoEm;

    protected Dose() { }

    public Dose(UUID planoId, UUID itemId, UUID pacienteId, LocalDate data, LocalTime hora,
                Instant instante, Instant fimJanela) {
        this.id = itemId + "@" + data + "T" + hora.toString().substring(0, 5);
        this.planoId = planoId;
        this.itemId = itemId;
        this.pacienteId = pacienteId;
        this.dataLocal = data;
        this.horario = hora;
        this.programadaEm = instante;
        this.fimJanela = fimJanela;
        this.estado = EstadoDose.PROGRAMADA;
    }

    // O minuto 120 inteiro pertence à janela. A próxima dose pode fechá-la antes.
    public void atualizar(Instant agora) {
        if (estado.resolvida()) return;
        if (!agora.isBefore(fimJanela)) {
            estado = EstadoDose.SEM_CONFIRMACAO;
            automatica = true;
            registradoEm = null;
        } else if (!agora.isBefore(programadaEm)) {
            estado = EstadoDose.PENDENTE;
        }
    }

    public void registrar(EstadoDose resultado, Instant agora) {
        atualizar(agora);
        if (resultado != EstadoDose.TOMADA && resultado != EstadoDose.NAO_TOMADA)
            throw new RegraNegocioException("Registro inválido.");
        if (automatica) throw new RegraNegocioException("O prazo de registro terminou. A dose ficou sem confirmação.");
        if (estado.resolvida()) throw new RegraNegocioException("Esta dose já foi registrada.");
        if (estado == EstadoDose.PROGRAMADA)
            throw new RegraNegocioException("Ainda não chegou o horário desta dose.");
        estado = resultado;
        registradoEm = agora;
        automatica = false;
    }

    public void desfazer(Instant agora) {
        atualizar(agora);
        if (!agora.isBefore(fimJanela))
            throw new RegraNegocioException("O prazo para corrigir terminou. O registro ficou como está.");
        if (!estado.resolvida() || automatica)
            throw new br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException("Esta dose ainda não tem registro.");
        estado = EstadoDose.PENDENTE;
        registradoEm = null;
        automatica = false;
    }

    public String getId() { return id; }
    public UUID getPlanoId() { return planoId; }
    public UUID getItemId() { return itemId; }
    public UUID getPacienteId() { return pacienteId; }
    public LocalDate getDataLocal() { return dataLocal; }
    public LocalTime getHorario() { return horario; }
    public Instant getProgramadaEm() { return programadaEm; }
    public Instant getFimJanela() { return fimJanela; }
    public EstadoDose getEstado() { return estado; }
    public boolean isAutomatica() { return automatica; }
    public Instant getRegistradoEm() { return registradoEm; }
}
