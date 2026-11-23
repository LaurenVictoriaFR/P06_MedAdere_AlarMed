package br.ufs.alarmed.dose;
import java.time.*;

public class RelogioTeste extends Clock {
    private volatile Instant agora = Instant.parse("2026-11-22T10:00:00Z");
    public void fixar(String valor) { agora = Instant.parse(valor); }
    public void fixar(Instant valor) { agora = valor; }
    public ZoneId getZone() { return ZoneOffset.UTC; }
    public Clock withZone(ZoneId zone) { return Clock.fixed(agora, zone); }
    public Instant instant() { return agora; }
}
