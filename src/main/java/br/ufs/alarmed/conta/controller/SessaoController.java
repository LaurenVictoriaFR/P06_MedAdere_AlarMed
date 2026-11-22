package br.ufs.alarmed.conta.controller;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.conta.dto.ContaResponse;
import br.ufs.alarmed.conta.repository.PacienteRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.*;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

// Endpoints necessários para a PWA usar a sessão real, inclusive após recarregar.
@RestController
public class SessaoController {
    private final ContextoPaciente contexto;
    private final PacienteRepository pacientes;
    private final Clock relogio;
    private final ZoneId fuso;
    public SessaoController(ContextoPaciente contexto, PacienteRepository pacientes, Clock relogio, ZoneId fuso) {
        this.contexto = contexto; this.pacientes = pacientes; this.relogio = relogio; this.fuso = fuso;
    }
    @GetMapping("/sessao") @Transactional(readOnly = true)
    public Map<String, Object> sessao() {
        return Map.of("conta", ContaResponse.de(pacientes.findById(contexto.pacienteAtual()).orElseThrow()),
                "agora", relogio.instant(), "fuso", fuso.getId());
    }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sair(HttpServletRequest r) {
        var sessao = r.getSession(false);
        if (sessao != null) sessao.invalidate();
    }
}
