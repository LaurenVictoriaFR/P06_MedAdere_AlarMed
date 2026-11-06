package br.ufs.alarmed.comum.excecao;

// Erro pra quando alguem pede um plano (ou item) que nao existe no banco.
public class RecursoNaoEncontradoException extends RuntimeException {

    public RecursoNaoEncontradoException(String mensagem) {
        super(mensagem);
    }
}
