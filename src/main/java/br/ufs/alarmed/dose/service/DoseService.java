package br.ufs.alarmed.dose.service;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.*;
import br.ufs.alarmed.dose.dto.*;
import br.ufs.alarmed.dose.model.*;
import br.ufs.alarmed.dose.repository.DoseRepository;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoseService {
    private final DoseRepository doses;
    private final PlanoMedicamentosoRepository planos;
    private final GeradorDoses gerador;
    private final ContextoPaciente contexto;
    private final Clock relogio;
    private final ZoneId fuso;

    public DoseService(DoseRepository doses, PlanoMedicamentosoRepository planos, GeradorDoses gerador,
                       ContextoPaciente contexto, Clock relogio, ZoneId fuso, LeitorDose leitor) {
        this.doses = doses; this.planos = planos; this.gerador = gerador;
        this.leitor = leitor; this.contexto = contexto; this.relogio = relogio; this.fuso = fuso;
    }

    public List<DoseResponse> listar(LocalDate de, LocalDate ate) {
        UUID paciente = contexto.pacienteAtual();
        LocalDate hoje = LocalDate.now(relogio.withZone(fuso));
        if (de == null) de = hoje.minusDays(1);
        if (ate == null) ate = hoje;
        if (ate.isBefore(de) || ChronoUnit.DAYS.between(de, ate) > 3660 || ate.isAfter(hoje.plusDays(31)))
            throw new RegraNegocioException("Intervalo inválido: até 10 anos de histórico e 31 dias futuros.");
        for (var p : planos.findByPacienteIdAndSituacao(paciente, SituacaoPlano.CONFIRMADO)) gerador.gerar(p.getId());
        // A atualização é feita sob lock em uma transação separada por dose.
        return doses.findByPacienteIdAndDataLocalBetweenOrderByProgramadaEm(paciente, de, ate)
                .stream().map(d -> atualizarELer(d.getId(), paciente)).toList();
    }

    // Invocado por um colaborador transacional para evitar self-invocation do Spring.
    private final LeitorDose leitor;

    private DoseResponse atualizarELer(String id, UUID paciente) { return leitor.ler(id, paciente); }

    @Transactional(noRollbackFor = RegraNegocioException.class)
    public RegistroResponse registrar(String id, String status) {
        Dose d = doses.bloquearDoPaciente(id, contexto.pacienteAtual())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Esta dose não está no plano."));
        if (!"tomada".equals(status) && !"nao_tomada".equals(status))
            throw new RegraNegocioException("Registro inválido.");
        EstadoDose estado = "tomada".equals(status) ? EstadoDose.TOMADA : EstadoDose.NAO_TOMADA;
        d.registrar(estado, relogio.instant());
        return RegistroResponse.de(d);
    }

    @Transactional(noRollbackFor = RegraNegocioException.class)
    public void desfazer(String id) {
        Dose d = doses.bloquearDoPaciente(id, contexto.pacienteAtual())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Esta dose não está no plano."));
        d.desfazer(relogio.instant());
    }
}
