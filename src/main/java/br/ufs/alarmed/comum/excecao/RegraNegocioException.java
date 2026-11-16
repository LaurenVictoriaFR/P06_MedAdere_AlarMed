package br.ufs.alarmed.comum.excecao;

// Erro pra quando alguem tenta fazer algo que quebra uma regra de negocio.
// Exemplo: confirmar um plano sem ele ter passado pela revisao antes (RN01).
public class RegraNegocioException extends RuntimeException {

    public RegraNegocioException(String mensagem) {
        super(mensagem);
    }
}
