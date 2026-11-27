package br.ufs.alarmed.plano.dto;

import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import br.ufs.alarmed.comum.util.DuracaoTratamento;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Valida a anotacao {@link DuracaoValida} com a mesma regra da confirmacao do plano.
 *
 * <p>Usa o relogio e o fuso do servidor (T-03), como o resto do sistema.
 */
public class ValidadorDuracao implements ConstraintValidator<DuracaoValida, String> {

    private final Clock relogio;
    private final ZoneId fuso;

    /**
     * Recebe o relogio e o fuso configurados na aplicacao (TempoConfig).
     *
     * @param relogio relogio do servidor
     * @param fuso fuso dos horarios do plano
     */
    public ValidadorDuracao(Clock relogio, ZoneId fuso) {
        this.relogio = relogio;
        this.fuso = fuso;
    }

    @Override
    public boolean isValid(String texto, ConstraintValidatorContext contexto) {
        if (texto == null || texto.isBlank()) {
            return true;
        }
        try {
            DuracaoTratamento.fim(texto, LocalDate.now(relogio.withZone(fuso)));
            return true;
        } catch (RegraNegocioException e) {
            return false;
        }
    }
}
