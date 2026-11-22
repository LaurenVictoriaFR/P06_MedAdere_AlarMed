package br.ufs.alarmed.conta.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import br.ufs.alarmed.conta.model.ContaUsuario;

public interface ContaUsuarioRepository extends JpaRepository<ContaUsuario, UUID> {
   boolean existsByEmail(String email);
   Optional<ContaUsuario> findByEmail(String email);
}
