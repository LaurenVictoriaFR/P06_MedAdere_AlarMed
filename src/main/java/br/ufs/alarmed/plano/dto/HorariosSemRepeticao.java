package br.ufs.alarmed.plano.dto;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;

/**
 * Barra o mesmo horario informado duas vezes no item, ja no corpo da requisicao (TD-03).
 *
 * <p>Assim o erro volta como 400 em camposInvalidos.horarios, como os outros campos do
 * item (contrato do Bloco C). O construtor do {@code ItemDoPlano} continua conferindo a
 * mesma regra, para quem cria o item sem passar pela API.
 */
@Documented
@Constraint(validatedBy = HorariosSemRepeticao.Validador.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface HorariosSemRepeticao {

    /**
     * Mensagem devolvida em camposInvalidos.
     *
     * @return a mensagem de erro
     */
    String message() default "O mesmo horário foi informado mais de uma vez.";

    /**
     * Grupos de validacao (padrao do Bean Validation).
     *
     * @return os grupos
     */
    Class<?>[] groups() default {};

    /**
     * Payload da validacao (padrao do Bean Validation).
     *
     * @return o payload
     */
    Class<? extends Payload>[] payload() default {};

    /**
     * Confere se a lista tem horarios repetidos. Lista nula ou vazia fica para o
     * {@code @NotEmpty}, que ja da a mensagem certa.
     */
    class Validador implements ConstraintValidator<HorariosSemRepeticao, List<LocalTime>> {

        @Override
        public boolean isValid(List<LocalTime> horarios, ConstraintValidatorContext contexto) {
            return horarios == null || new HashSet<>(horarios).size() == horarios.size();
        }
    }
}
