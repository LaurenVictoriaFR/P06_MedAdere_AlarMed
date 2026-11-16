package br.ufs.alarmed.comum.excecao;

// Erro pra quando a requisicao chega sem dizer quem e o paciente (sem login).
public class NaoAutenticadoException extends RuntimeException {

    public NaoAutenticadoException(String mensagem) {
        super(mensagem);
    }
}
