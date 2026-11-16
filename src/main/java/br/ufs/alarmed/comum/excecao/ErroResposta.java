package br.ufs.alarmed.comum.excecao;

import java.util.Map;

// Formato padrao da resposta quando um endpoint da erro.
public record ErroResposta(String mensagem, Map<String, String> camposInvalidos) {

    public static ErroResposta de(String mensagem) {
        return new ErroResposta(mensagem, Map.of());
    }

    public static ErroResposta de(String mensagem, Map<String, String> camposInvalidos) {
        return new ErroResposta(mensagem, camposInvalidos);
    }
}
