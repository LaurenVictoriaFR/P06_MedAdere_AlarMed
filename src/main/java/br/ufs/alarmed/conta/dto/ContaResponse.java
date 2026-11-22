package br.ufs.alarmed.conta.dto;

import java.util.UUID;
import br.ufs.alarmed.conta.model.Paciente;

//Resposta de POST /contas e POST /login. A senha nunca sai da API (contrato, seção 1)
public record ContaResponse(UUID id, String nome, String email) {
	// Cnverte a entidade na resposta
	public static ContaResponse de(Paciente paciente) {
	    return new ContaResponse(
	            paciente.getId(),
	            paciente.getNome(),
	            paciente.getConta().getEmail());
	}
}
