package br.ufs.alarmed.conta.model;

import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

//Perfil do paciente, separado da conta (DM01, UC-05)
//@OneToOne porque no MVP cada conta tem um unico paciente
@Table(name = "paciente")
@Entity
public class Paciente {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;
	
	@Column(nullable = false, length = 120)
	private String nome;
	
	@OneToOne(optional = false)
	@JoinColumn(name = "conta_id", nullable = false)
	private ContaUsuario conta;
	
	protected Paciente() {}
	
	public Paciente(ContaUsuario conta, String nome) {
		this.nome = Objects.requireNonNull(nome,"O nome não pode ser nulo");
		this.conta = Objects.requireNonNull(conta, "A conta não pode ser nula");
	}

	public String getNome() {
		return nome;
	}
	public UUID getId() {
		return id;
	}
	public ContaUsuario getConta() {
		return conta;
	}

}
