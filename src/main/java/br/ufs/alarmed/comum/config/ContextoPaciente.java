package br.ufs.alarmed.comum.config;

import java.util.UUID;

// Diz quem e o paciente da requisicao atual.
// Os services so conversam com esta interface, nunca com o login diretamente.
// Quem responde e o ContextoPacienteViaSessao, que le a sessao aberta no login (UC-06).
// Trocar a implementacao nao exige mexer nos services.
public interface ContextoPaciente {

    // devolve o id do paciente logado, ou lanca NaoAutenticadoException se nao houver
    UUID pacienteAtual();
}
