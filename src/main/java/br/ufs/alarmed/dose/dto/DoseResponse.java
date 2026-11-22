package br.ufs.alarmed.dose.dto;

import br.ufs.alarmed.dose.model.Dose;
import java.time.*;
import java.util.*;

public record DoseResponse(String id, UUID itemId, LocalDate data, LocalTime hora,
                           Instant t, Instant fimJanela, String estado, boolean automatica,
                           RegistroResponse registro) {
    public static DoseResponse de(Dose d) {
        return new DoseResponse(d.getId(), d.getItemId(), d.getDataLocal(), d.getHorario(),
                d.getProgramadaEm(), d.getFimJanela(), d.getEstado().name().toLowerCase(Locale.ROOT),
                d.isAutomatica(), d.getEstado().resolvida() ? RegistroResponse.de(d) : null);
    }
}
