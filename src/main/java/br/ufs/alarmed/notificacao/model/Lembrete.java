package br.ufs.alarmed.notificacao.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "lembrete")
public class Lembrete {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 30) private String situacao;
    @Column(nullable = false) private Instant atualizadoEm;
    protected Lembrete() { }
    public Lembrete(String dose, Instant agora) { id = dose; atualizar("AGUARDANDO", agora); }
    public void atualizar(String situacao, Instant agora) { this.situacao = situacao; this.atualizadoEm = agora; }
    public String getId() { return id; }
    public String getSituacao() { return situacao; }
    public Instant getAtualizadoEm() { return atualizadoEm; }
}
