package br.ufs.alarmed.dose.repository;

import br.ufs.alarmed.dose.model.*;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface DoseRepository extends JpaRepository<Dose, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Dose d where d.id = :id and d.pacienteId = :pacienteId")
    Optional<Dose> bloquearDoPaciente(String id, UUID pacienteId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Dose d where d.id = :id")
    Optional<Dose> bloquear(String id);

    @Query("select d.id from Dose d where d.programadaEm <= :agora and (d.estado in :estados or d.id in "
            + "(select l.id from Lembrete l where l.situacao in ('AGUARDANDO','REPETIR','PARCIAL','SEM_INSCRICAO','DESATIVADO'))) "
            + "order by d.programadaEm, d.id")
    List<String> idsVencidas(Instant agora, Collection<EstadoDose> estados);

    List<Dose> findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(UUID pacienteId, LocalDate de, LocalDate ate);
}
