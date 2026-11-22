package br.ufs.alarmed.dose.dto;

import br.ufs.alarmed.dose.model.Dose;
import java.time.Instant;
import java.util.Locale;

public record RegistroResponse(String status, Instant em, boolean automatica) {
    public static RegistroResponse de(Dose dose) {
        return new RegistroResponse(dose.getEstado().name().toLowerCase(Locale.ROOT),
                dose.getRegistradoEm(), dose.isAutomatica());
    }
}
