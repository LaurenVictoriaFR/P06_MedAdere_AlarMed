package br.ufs.alarmed.plano.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Confere a duracao do tratamento ja ao adicionar o item (TD-03, UC-01 A1, UC-04 A1).
 *
 * <p>Aceita os mesmos formatos que a geracao de doses entende: "uso continuo",
 * "N dias" (1 a 365) ou "ate DD/MM/AAAA" sem data passada. Texto vazio fica para o
 * {@code @NotBlank}, que ja da a mensagem certa.
 */
@Documented
@Constraint(validatedBy = ValidadorDuracao.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DuracaoValida {

    /**
     * Mensagem devolvida em camposInvalidos.
     *
     * @return a mensagem de erro
     */
    String message() default
            "Duração inválida. Use uso contínuo, 1 a 365 dias ou até DD/MM/AAAA, sem data passada.";

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
}
