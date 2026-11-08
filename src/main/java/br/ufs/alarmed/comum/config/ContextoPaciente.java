package br.ufs.alarmed.comum.config;

import java.util.UUID;

// Diz quem e o paciente da requisicao atual.
// Os services so conversam com esta interface, nunca com o login diretamente.
// Hoje quem responde e o ContextoPacienteViaCabecalho (provisorio).
// Quando o login do Bloco B (UC-06) ficar pronto, basta criar outra classe que
// implemente esta interface lendo a sessao de verdade, e apagar a provisoria.
public interface ContextoPaciente {

    // devolve o id do paciente logado, ou lanca NaoAutenticadoException se nao houver
    UUID pacienteAtual();
}
