package br.ufs.alarmed.plano.model;

import java.util.Arrays;
import java.util.Optional;

/**
 * Formatos aceitos para a foto da caixa do medicamento (RF008, DA-02).
 *
 * <p>O formato e reconhecido pelos primeiros bytes do arquivo, e nao pelo nome ou pelo
 * Content-Type que o navegador informa: assim um arquivo renomeado para .png nao passa.
 */
public enum FormatoImagem {

    /** JPEG: comeca com FF D8 FF. */
    JPEG("image/jpeg"),

    /** PNG: comeca com a assinatura de 8 bytes do formato. */
    PNG("image/png"),

    /** WebP: "RIFF", 4 bytes de tamanho e "WEBP". */
    WEBP("image/webp");

    private static final byte[] ASSINATURA_PNG = {
        (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'
    };

    private final String tipoMime;

    FormatoImagem(String tipoMime) {
        this.tipoMime = tipoMime;
    }

    /**
     * Tipo MIME do formato, usado como Content-Type ao devolver a foto.
     *
     * @return o tipo MIME, por exemplo "image/png"
     */
    public String tipoMime() {
        return tipoMime;
    }

    /**
     * Reconhece o formato pelo conteudo do arquivo.
     *
     * @param conteudo bytes do arquivo enviado
     * @return o formato, ou vazio se nao for JPEG, PNG nem WebP
     */
    public static Optional<FormatoImagem> detectar(byte[] conteudo) {
        if (conteudo == null) {
            return Optional.empty();
        }
        if (conteudo.length >= 3 && (conteudo[0] & 0xFF) == 0xFF
                && (conteudo[1] & 0xFF) == 0xD8 && (conteudo[2] & 0xFF) == 0xFF) {
            return Optional.of(JPEG);
        }
        if (conteudo.length >= ASSINATURA_PNG.length
                && Arrays.equals(conteudo, 0, ASSINATURA_PNG.length,
                        ASSINATURA_PNG, 0, ASSINATURA_PNG.length)) {
            return Optional.of(PNG);
        }
        if (conteudo.length >= 12 && textoEm(conteudo, 0, "RIFF") && textoEm(conteudo, 8, "WEBP")) {
            return Optional.of(WEBP);
        }
        return Optional.empty();
    }

    private static boolean textoEm(byte[] conteudo, int posicao, String texto) {
        for (int i = 0; i < texto.length(); i++) {
            if (conteudo[posicao + i] != texto.charAt(i)) {
                return false;
            }
        }
        return true;
    }
}
