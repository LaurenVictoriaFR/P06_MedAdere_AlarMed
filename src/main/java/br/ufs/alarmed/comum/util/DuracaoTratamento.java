package br.ufs.alarmed.comum.util;

import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import java.text.Normalizer;
import java.time.*;
import java.time.format.*;
import java.util.Locale;

// Compatibilidade com o contrato existente do Bloco C. Texto desconhecido é recusado.
public final class DuracaoTratamento {
    private DuracaoTratamento() { }

    public static LocalDate fim(String texto, LocalDate inicio) {
        String t = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        try {
            if (t.equals("uso continuo")) return null;
            if (t.matches("[1-9][0-9]{0,2} dias?")) {
                int dias = Integer.parseInt(t.split(" ")[0]);
                if (dias <= 365) return inicio.plusDays(dias - 1L);
            }
            if (t.startsWith("ate ")) {
                String data = t.substring(4);
                LocalDate fim = data.contains("/")
                        ? LocalDate.parse(data, DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT))
                        : LocalDate.parse(data);
                if (!fim.isBefore(inicio)) return fim;
            }
        } catch (DateTimeException | NumberFormatException ignored) { }
        throw new RegraNegocioException("Duração inválida. Use uso contínuo, 1 a 365 dias ou até DD/MM/AAAA, sem data passada.");
    }
}
