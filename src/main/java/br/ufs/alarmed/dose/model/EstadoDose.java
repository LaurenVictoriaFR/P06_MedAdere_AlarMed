package br.ufs.alarmed.dose.model;

public enum EstadoDose {
    PROGRAMADA, PENDENTE, TOMADA, NAO_TOMADA;

    public boolean resolvida() { return this == TOMADA || this == NAO_TOMADA; }
}
