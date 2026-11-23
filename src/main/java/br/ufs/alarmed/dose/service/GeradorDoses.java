package br.ufs.alarmed.dose.service;

import br.ufs.alarmed.dose.model.Dose;
import br.ufs.alarmed.comum.util.DuracaoTratamento;
import br.ufs.alarmed.dose.repository.DoseRepository;
import br.ufs.alarmed.plano.model.*;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GeradorDoses {
    private final PlanoMedicamentosoRepository planos;
    private final DoseRepository doses;
    private final Clock relogio;
    private final int horizonte;

    public GeradorDoses(PlanoMedicamentosoRepository planos, DoseRepository doses, Clock relogio,
                        @Value("${alarmed.doses.horizonte-dias:7}") int horizonte) {
        this.planos = planos; this.doses = doses; this.relogio = relogio;
        if (horizonte < 1 || horizonte > 31) throw new IllegalArgumentException("Horizonte deve estar entre 1 e 31 dias.");
        this.horizonte = horizonte;
    }

    // Lock no plano + cursor persistido: duas varreduras não geram a mesma dose.
    // Recupera todo o intervalo desde o último cursor após reinício.
    @Transactional
    public void gerar(UUID planoId) {
        PlanoMedicamentoso plano = planos.bloquear(planoId).orElseThrow();
        if (plano.getSituacao() != SituacaoPlano.CONFIRMADO) return;
        ZoneId fuso = ZoneId.of(plano.getFusoHorario());
        LocalDate ate = relogio.instant().atZone(fuso).toLocalDate().plusDays(horizonte);
        LocalDate de = plano.getGeradoAte() == null ? plano.getDataInicio() : plano.getGeradoAte().plusDays(1);
        if (de.isAfter(ate)) return;
        for (ItemDoPlano item : plano.getItens()) {
            LocalDate fim = DuracaoTratamento.fim(item.getDuracaoTratamento(), plano.getDataInicio());
            if (plano.getDataFim() != null && (fim == null || plano.getDataFim().isBefore(fim))) fim = plano.getDataFim();
            List<LocalTime> horarios = item.getHorarios().stream().map(HorarioProgramado::getHora).sorted().toList();
            for (LocalDate dia = de; !dia.isAfter(ate) && (fim == null || !dia.isAfter(fim)); dia = dia.plusDays(1)) {
                for (int i = 0; i < horarios.size(); i++) {
                    LocalTime hora = horarios.get(i);
                    Instant instante = dia.atTime(hora).atZone(fuso).toInstant();
                    if (instante.isBefore(plano.getConfirmadoEm())) continue;
                    Instant fecha = instante.plusSeconds(121 * 60);
                    LocalDate proximoDia = i + 1 < horarios.size() ? dia : dia.plusDays(1);
                    LocalTime proximaHora = horarios.get((i + 1) % horarios.size());
                    if (fim == null || !proximoDia.isAfter(fim)) {
                        Instant proxima = proximoDia.atTime(proximaHora).atZone(fuso).toInstant();
                        if (proxima.isBefore(fecha)) fecha = proxima;
                    }
                    doses.save(new Dose(planoId, item.getId(), plano.getPacienteId(), dia, hora, instante, fecha));
                }
            }
        }
        plano.registrarGeracao(ate);
    }
}
