package br.ufs.alarmed.dose.model;

public enum EstadoDose {
    PROGRAMADA, PENDENTE, TOMADA, NAO_TOMADA, SEM_CONFIRMACAO;

    public boolean resolvida() { return this == TOMADA || this == NAO_TOMADA || this == SEM_CONFIRMACAO; }
}
