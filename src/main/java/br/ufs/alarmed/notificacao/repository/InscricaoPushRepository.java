package br.ufs.alarmed.notificacao.repository;

import br.ufs.alarmed.notificacao.model.InscricaoPush;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface InscricaoPushRepository extends JpaRepository<InscricaoPush, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InscricaoPush i where i.endpointHash = :hash")
    Optional<InscricaoPush> bloquearPorHash(String hash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InscricaoPush i where i.pacienteId = :pacienteId and i.ativa = true order by i.id")
    List<InscricaoPush> bloquearAtivas(UUID pacienteId);
    List<InscricaoPush> findByPacienteIdAndAtivaTrueOrderById(UUID pacienteId);
    Optional<InscricaoPush> findByIdAndPacienteId(UUID id, UUID pacienteId);
}
