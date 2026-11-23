package br.ufs.alarmed.comum.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class TempoConfig {
    @Bean
    Clock relogioServidor() { return Clock.systemUTC(); }

    @Bean
    ZoneId fusoAplicacao(@Value("${alarmed.fuso:America/Maceio}") String fuso) {
        return ZoneId.of(fuso);
    }
}
