package br.ufs.alarmed.notificacao.repository;
import br.ufs.alarmed.notificacao.model.Lembrete;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.UUID;
public interface LembreteRepository extends JpaRepository<Lembrete, String> {
    @Query("select count(l) from Lembrete l, Dose d where l.id = d.id and d.pacienteId = :pacienteId "
            + "and l.atualizadoEm >= :desde and l.situacao in ('FALHOU','EXPIRADO','SEM_INSCRICAO','DESATIVADO','PARCIAL','REPETIR')")
    long contarProblemas(UUID pacienteId, Instant desde);
}
