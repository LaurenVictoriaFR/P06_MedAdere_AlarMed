package br.ufs.alarmed.notificacao.controller;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import br.ufs.alarmed.notificacao.dto.InscricaoRequest;
import br.ufs.alarmed.notificacao.repository.*;
import br.ufs.alarmed.notificacao.service.*;
import jakarta.validation.Valid;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;

@RestController @RequestMapping("/push")
public class PushController {
    private final InscricaoService servico;
    private final InscricaoPushRepository inscricoes;
    private final ContextoPaciente contexto;
    private final EmissorPush emissor;
    private final Clock relogio;
    private final ObjectMapper json;
    private final LembreteRepository lembretes;
    public PushController(InscricaoService servico, InscricaoPushRepository inscricoes,
                          ContextoPaciente contexto, EmissorPush emissor, Clock relogio, ObjectMapper json,
                          LembreteRepository lembretes) {
        this.servico = servico; this.inscricoes = inscricoes; this.contexto = contexto;
        this.emissor = emissor; this.relogio = relogio; this.json = json;
        this.lembretes = lembretes;
    }
    @GetMapping("/chave")
    public Map<String, Object> chave() {
        return Map.of("chavePublica", emissor.chavePublica(), "configurado", emissor.configurado());
    }
    @PostMapping("/inscricoes") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> inscrever(@Valid @RequestBody InscricaoRequest r) { return Map.of("id", servico.inscrever(r)); }
    @DeleteMapping("/inscricoes/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) { servico.remover(id); }
    public record EndpointRequest(@jakarta.validation.constraints.NotBlank String endpoint) { }
    @DeleteMapping("/inscricoes") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerAparelho(@Valid @RequestBody EndpointRequest r) { servico.removerEndpoint(r.endpoint()); }
    @GetMapping("/situacao")
    public Map<String, Object> situacao() {
        var paciente = contexto.pacienteAtual();
        var aparelhos = inscricoes.findByPacienteIdAndAtivaTrueOrderById(paciente);
        return Map.of("configurado", emissor.configurado(), "inscricoesAtivas", aparelhos.stream().map(i -> i.getId()).toList(),
                "falhasRecentes", lembretes.contarProblemas(paciente,relogio.instant().minusSeconds(86400)));
    }
    @PostMapping("/teste") @Transactional
    public Map<String, Object> testar() {
        var aparelhos = inscricoes.bloquearAtivas(contexto.pacienteAtual());
        if (!emissor.configurado() || aparelhos.isEmpty())
            throw new RegraNegocioException("Ative os lembretes neste aparelho antes de testar.");
        byte[] payload = json.writeValueAsBytes(Map.of("titulo", "Teste do AlarMed", "corpo", "Os lembretes estão configurados.",
                "hash", "#/hoje", "doseId", "teste", "expiraEm", relogio.instant().plusSeconds(60).toString()));
        int aceitas = 0;
        for (var i : aparelhos) {
            int codigo = emissor.enviar(i, payload, 60);
            if (codigo >= 200 && codigo < 300) aceitas++;
            if (codigo == 404 || codigo == 410) i.desativar();
        }
        return Map.of("solicitacoesAceitas", aceitas, "aparelhos", aparelhos.size());
    }
}
