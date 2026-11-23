package br.ufs.alarmed.notificacao.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record InscricaoRequest(@NotBlank @Size(max = 2048) String endpoint,
                                @NotNull @Valid Chaves keys) {
    public record Chaves(@NotBlank @Size(max = 256) String p256dh,
                         @NotBlank @Size(max = 128) String auth) { }
}
