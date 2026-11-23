package br.ufs.alarmed.notificacao.service;

import br.ufs.alarmed.notificacao.model.InscricaoPush;

public interface EmissorPush {
    boolean configurado();
    String chavePublica();
    // 2xx significa aceito pelo provedor, não confirmação de recebimento no aparelho.
    int enviar(InscricaoPush inscricao, byte[] payload, int ttlSegundos);
}
