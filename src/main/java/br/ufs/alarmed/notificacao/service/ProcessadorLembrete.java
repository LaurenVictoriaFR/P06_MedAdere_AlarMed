package br.ufs.alarmed.notificacao.service;

import br.ufs.alarmed.dose.model.*;
import br.ufs.alarmed.dose.repository.DoseRepository;
import br.ufs.alarmed.notificacao.model.*;
import br.ufs.alarmed.notificacao.repository.*;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class ProcessadorLembrete {
    private final DoseRepository doses;
    private final PlanoMedicamentosoRepository planos;
    private final LembreteRepository lembretes;
    private final EntregaPushRepository entregas;
    private final InscricaoPushRepository inscricoes;
    private final EmissorPush emissor;
    private final Clock relogio;
    private final ObjectMapper json;
    public ProcessadorLembrete(DoseRepository doses, PlanoMedicamentosoRepository planos,
            LembreteRepository lembretes, EntregaPushRepository entregas, InscricaoPushRepository inscricoes,
            EmissorPush emissor, Clock relogio, ObjectMapper json) {
        this.doses = doses; this.planos = planos; this.lembretes = lembretes; this.entregas = entregas;
        this.inscricoes = inscricoes; this.emissor = emissor; this.relogio = relogio; this.json = json;
    }

    // O mesmo lock serializa registro, expiração e varreduras concorrentes.
    @Transactional
    public void processar(String id) {
        Dose dose = doses.bloquear(id).orElseThrow();
        Instant agora = relogio.instant();
        dose.atualizar(agora);
        var existente = lembretes.findById(id);
        if (dose.getEstado().resolvida()) {
            existente.ifPresent(l -> {
                if (!l.getSituacao().equals("ACEITA_PELO_SERVICO"))
                    l.atualizar(dose.isAutomatica() ? "EXPIRADO" : "CANCELADO", agora);
            });
            return;
        }
        if (dose.getEstado() != EstadoDose.PENDENTE) return;
        Lembrete lembrete = existente.orElseGet(() -> lembretes.save(new Lembrete(id, agora)));
        if (!emissor.configurado()) {
            if (!lembrete.getSituacao().equals("ACEITA_PELO_SERVICO")) lembrete.atualizar("DESATIVADO", agora);
            return;
        }
        var aparelhos = inscricoes.bloquearAtivas(dose.getPacienteId());
        if (aparelhos.isEmpty()) {
            if (!lembrete.getSituacao().equals("ACEITA_PELO_SERVICO")) lembrete.atualizar("SEM_INSCRICAO", agora);
            return;
        }
        var item = planos.findById(dose.getPlanoId()).orElseThrow().getItens().stream()
                .filter(i -> i.getId().equals(dose.getItemId())).findFirst().orElseThrow();
        byte[] payload = json.writeValueAsBytes(Map.of(
                "titulo", "Hora de tomar " + item.getNomeMedicamento(),
                "corpo", item.getDosagem() + ". Toque para registrar.",
                "hash", "#/hoje?dose=" + URLEncoder.encode(id, StandardCharsets.UTF_8),
                "doseId", id, "expiraEm", dose.getFimJanela().toString()));
        boolean aceita = false, repetir = false;
        for (var inscricao : aparelhos) {
            String entregaId = id + "/" + inscricao.getId();
            EntregaPush entrega = entregas.findById(entregaId)
                    .orElseGet(() -> entregas.save(new EntregaPush(id, inscricao.getId())));
            Instant tentativaEm = relogio.instant();
            if (!tentativaEm.isBefore(dose.getFimJanela())) break;
            if (entrega.podeTentar(tentativaEm)) {
                int ttl = (int) Math.max(0, Duration.between(tentativaEm, dose.getFimJanela()).getSeconds());
                int codigo = emissor.enviar(inscricao, payload, ttl);
                entrega.resultado(codigo, tentativaEm);
                if (codigo == 404 || codigo == 410) inscricao.desativar();
            }
            aceita |= entrega.getSituacao().equals("ACEITA_PELO_SERVICO");
            repetir |= entrega.getSituacao().equals("REPETIR") || entrega.getSituacao().equals("AGUARDANDO");
        }
        lembrete.atualizar(repetir ? (aceita ? "PARCIAL" : "REPETIR") : (aceita ? "ACEITA_PELO_SERVICO" : "FALHOU"), relogio.instant());
    }
}
