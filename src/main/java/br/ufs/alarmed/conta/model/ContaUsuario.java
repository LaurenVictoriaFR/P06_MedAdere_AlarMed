package br.ufs.alarmed.conta.model;

import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//UC-05: quem acessa o sistema (paciente ou cuidador).
//A senha fica sem hash por decisao do grupo (ADR-04, risco R04).
@Entity
@Table(name = "conta_usuario")

public class ContaUsuario {
	
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;
	
	@Column(nullable = false, length = 120)
	private String nome;
	
	@Column(nullable = false, length = 120)
	private String email;
	
	@Column(nullable = false, length = 100)
	private String senha;
	
	@Column(name = "data_nascimento", nullable = false)
	private LocalDate dataNascimento;
	
	@Column(length = 20)
	private String telefone;
	
	protected ContaUsuario() {}
	
	public ContaUsuario( String nome, String email, String senha, LocalDate dataNascimento, String telefone) {
		this.nome = Objects.requireNonNull(nome, "O nome não pode ser nulo");
		this.email = Objects.requireNonNull(email, "O email não pode ser nulo");
		this.senha = Objects.requireNonNull(senha, "A senha não pode ser nulo");
		this.dataNascimento = Objects.requireNonNull(dataNascimento, "A data de nascimento não pode ser nulo");
		this.telefone = telefone;
	}
	
	public UUID getId() {
		return id;
	}
	public String getNome() {
		return nome;
	}
	public String getEmail() {
		return email;
	}
	public String getSenha() {
		return senha;
	}
	public LocalDate getDataNascimento() {
		return dataNascimento;
	}
	public String getTelefone() {
		return telefone;
	}

}
