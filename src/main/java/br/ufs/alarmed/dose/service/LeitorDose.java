package br.ufs.alarmed.dose.service;

import br.ufs.alarmed.dose.dto.DoseResponse;
import br.ufs.alarmed.dose.repository.DoseRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeitorDose {
    private final DoseRepository doses;
    private final Clock relogio;
    public LeitorDose(DoseRepository doses, Clock relogio) { this.doses = doses; this.relogio = relogio; }
    @Transactional
    public DoseResponse ler(String id, UUID paciente) {
        var d = doses.bloquearDoPaciente(id, paciente).orElseThrow();
        d.atualizar(relogio.instant());
        return DoseResponse.de(d);
    }
}
