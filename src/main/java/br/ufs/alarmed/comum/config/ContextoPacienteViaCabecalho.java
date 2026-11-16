package br.ufs.alarmed.comum.config;

import br.ufs.alarmed.comum.excecao.NaoAutenticadoException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.stereotype.Component;

// PROVISORIO: so existe pra nao travar o desenvolvimento enquanto o login (Bloco B) nao fica pronto.
// O id do paciente vem no cabecalho "X-Paciente-Id" de cada requisicao.
// Nao e seguro: qualquer um pode mandar o id que quiser. Serve so pra testes e dados sinteticos.
// Ver debito tecnico na nota final do plano.
@Component
public class ContextoPacienteViaCabecalho implements ContextoPaciente {

    public static final String CABECALHO = "X-Paciente-Id";

    // o Spring injeta aqui a requisicao que esta sendo atendida no momento
    private final HttpServletRequest requisicao;

    public ContextoPacienteViaCabecalho(HttpServletRequest requisicao) {
        this.requisicao = requisicao;
    }

    @Override
    public UUID pacienteAtual() {
        String valor = requisicao.getHeader(CABECALHO);

        if (valor == null || valor.isBlank()) {
            throw new NaoAutenticadoException("Paciente não identificado. Envie o cabeçalho " + CABECALHO + ".");
        }

        try {
            return UUID.fromString(valor.trim());
        } catch (IllegalArgumentException e) {
            throw new NaoAutenticadoException("O cabeçalho " + CABECALHO + " não contém um id válido.");
        }
    }
}
