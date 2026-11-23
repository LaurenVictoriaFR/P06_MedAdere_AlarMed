package br.ufs.alarmed.notificacao.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "entrega_push")
public class EntregaPush {
    @Id @Column(length = 110) private String id;
    @Column(nullable = false, length = 64) private String doseId;
    @Column(nullable = false) private UUID inscricaoId;
    @Column(nullable = false) private int tentativas;
    @Column(nullable = false, length = 30) private String situacao;
    private Integer codigoHttp;
    private Instant proximaTentativa;
    private Instant primeiraTentativaEm;
    protected EntregaPush() { }
    public EntregaPush(String doseId, UUID inscricaoId) {
        this.id = doseId + "/" + inscricaoId; this.doseId = doseId;
        this.inscricaoId = inscricaoId; this.situacao = "AGUARDANDO";
    }
    public boolean podeTentar(Instant agora) {
        return (situacao.equals("AGUARDANDO") || situacao.equals("REPETIR"))
                && (proximaTentativa == null || !agora.isBefore(proximaTentativa));
    }
    public void resultado(int codigo, Instant agora) {
        if (primeiraTentativaEm == null) primeiraTentativaEm = agora;
        tentativas++; codigoHttp = codigo;
        if (codigo >= 200 && codigo < 300) situacao = "ACEITA_PELO_SERVICO";
        else if (codigo == 404 || codigo == 410) situacao = "INSCRICAO_EXPIRADA";
        else if ((codigo == 0 || codigo == 429 || codigo >= 500) && tentativas < 3) {
            situacao = "REPETIR";
            proximaTentativa = agora.plusSeconds(30L * tentativas);
        } else situacao = "FALHOU";
    }
    public String getSituacao() { return situacao; }
    public int getTentativas() { return tentativas; }
    public Integer getCodigoHttp() { return codigoHttp; }
    public Instant getPrimeiraTentativaEm() { return primeiraTentativaEm; }
}
