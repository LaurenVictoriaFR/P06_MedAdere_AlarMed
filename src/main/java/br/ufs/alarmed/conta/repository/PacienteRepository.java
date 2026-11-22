package br.ufs.alarmed.conta.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import br.ufs.alarmed.conta.model.ContaUsuario;
import br.ufs.alarmed.conta.model.Paciente;

public interface PacienteRepository extends JpaRepository<Paciente, UUID> {
	Optional<Paciente> findByConta(ContaUsuario conta);

}
