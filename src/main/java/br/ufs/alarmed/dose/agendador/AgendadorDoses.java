package br.ufs.alarmed.dose.agendador;

import br.ufs.alarmed.dose.model.EstadoDose;
import br.ufs.alarmed.dose.repository.DoseRepository;
import br.ufs.alarmed.dose.service.GeradorDoses;
import br.ufs.alarmed.notificacao.service.ProcessadorLembrete;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.time.Clock;
import java.util.List;
import org.slf4j.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "alarmed.agendador.ativo", havingValue = "true", matchIfMissing = true)
public class AgendadorDoses {
    private static final Logger LOG = LoggerFactory.getLogger(AgendadorDoses.class);
    private final PlanoMedicamentosoRepository planos;
    private final GeradorDoses gerador;
    private final DoseRepository doses;
    private final ProcessadorLembrete lembretes;
    private final Clock relogio;
    public AgendadorDoses(PlanoMedicamentosoRepository planos, GeradorDoses gerador,
                          DoseRepository doses, ProcessadorLembrete lembretes, Clock relogio) {
        this.planos = planos; this.gerador = gerador; this.doses = doses;
        this.lembretes = lembretes; this.relogio = relogio;
    }
    @Scheduled(fixedDelayString = "${alarmed.agendador.intervalo-ms:30000}",
               initialDelayString = "${alarmed.agendador.inicio-ms:2000}")
    public void executar() {
        for (var id : planos.idsConfirmados()) {
            try { gerador.gerar(id); }
            catch (Exception e) { LOG.warn("Falha na geração de doses; tipo={}", e.getClass().getSimpleName()); }
        }
        for (String id : doses.idsVencidas(relogio.instant(), List.of(EstadoDose.PROGRAMADA, EstadoDose.PENDENTE))) {
            try { lembretes.processar(id); }
            catch (Exception e) { LOG.warn("Falha no processamento de lembrete; tipo={}", e.getClass().getSimpleName()); }
        }
    }
}
