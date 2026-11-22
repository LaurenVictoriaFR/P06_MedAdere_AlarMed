package br.ufs.alarmed.comum.config;

import br.ufs.alarmed.comum.excecao.NaoAutenticadoException;
import br.ufs.alarmed.conta.controller.ContaController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.UUID;
import org.springframework.stereotype.Component;

/* Identifica o paciente pela sessao aberta em POST /contas ou POST /login (UC-05, UC-06).
 * A sessao guarda o id do PACIENTE (nao o da conta), que e o que os services usam.
 * Limitação do MVP: a sessao fica em memoria, então reiniciar o servidor exige novo login*/
@Component
public class ContextoPacienteViaSessao implements ContextoPaciente {
    private final HttpServletRequest requisicao;

    public ContextoPacienteViaSessao(HttpServletRequest requisicao) {
        this.requisicao = requisicao;
    }

    @Override
    public UUID pacienteAtual() {
        HttpSession sessao = requisicao.getSession(false);

        if (sessao == null || !(sessao.getAttribute(ContaController.CHAVE_SESSAO) instanceof UUID pacienteId)) {
            throw new NaoAutenticadoException("Paciente não identificado. Faça login.");
        }

        return pacienteId;
    }
}
