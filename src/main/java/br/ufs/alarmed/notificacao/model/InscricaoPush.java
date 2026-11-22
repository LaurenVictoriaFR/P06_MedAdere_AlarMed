package br.ufs.alarmed.notificacao.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "inscricao_push")
public class InscricaoPush {
    @Id private UUID id;
    @Column(nullable = false) private UUID pacienteId;
    @Column(nullable = false, length = 2048) private String endpoint;
    @Column(nullable = false, unique = true, length = 64) private String endpointHash;
    @Column(nullable = false, length = 256) private String p256dh;
    @Column(nullable = false, length = 128) private String auth;
    @Column(nullable = false) private boolean ativa;
    protected InscricaoPush() { }
    public InscricaoPush(UUID pacienteId, String endpoint, String hash, String p256dh, String auth) {
        id = UUID.randomUUID(); this.endpoint = endpoint; this.endpointHash = hash;
        atualizar(pacienteId, p256dh, auth);
    }
    public void atualizar(UUID pacienteId, String p256dh, String auth) {
        this.pacienteId = pacienteId; this.p256dh = p256dh; this.auth = auth; this.ativa = true;
    }
    public void desativar() { ativa = false; }
    public UUID getId() { return id; }
    public UUID getPacienteId() { return pacienteId; }
    public String getEndpoint() { return endpoint; }
    public String getEndpointHash() { return endpointHash; }
    public String getP256dh() { return p256dh; }
    public String getAuth() { return auth; }
    public boolean isAtiva() { return ativa; }
}
