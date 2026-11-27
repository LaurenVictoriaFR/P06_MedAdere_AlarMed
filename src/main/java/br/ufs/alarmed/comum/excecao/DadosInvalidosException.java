package br.ufs.alarmed.comum.excecao;

/**
 * Dado enviado pelo cliente que nao da para aceitar; vira 400.
 *
 * <p>Para o que a validacao do corpo (Bean Validation) nao cobre, como o arquivo da foto
 * da caixa (RF008): tamanho ou formato errado.
 */
public class DadosInvalidosException extends RuntimeException {

    /**
     * Cria o erro com a mensagem que vai para o usuario.
     *
     * @param mensagem o que esta errado no dado enviado
     */
    public DadosInvalidosException(String mensagem) {
        super(mensagem);
    }
}
