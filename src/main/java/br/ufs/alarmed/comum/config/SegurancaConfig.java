package br.ufs.alarmed.comum.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/* Hash das senhas (ADR-04 revisada, RNF004). Usa só o módulo de criptografia do Spring Security,
 * sem ativar a autenticação dele: o login continua sendo o do ContaService. */
@Configuration
public class SegurancaConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
