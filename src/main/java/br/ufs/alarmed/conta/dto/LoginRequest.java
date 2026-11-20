package br.ufs.alarmed.conta.dto;

import jakarta.validation.constraints.NotBlank;

/*Corpo de POST /login (UC-06). Sem validar formato de e-mail nem tamanho da senha pois qualquer erro cai no mesmo 401 generico, 
 * pra nao revelar se o email existe */
public record LoginRequest(
        @NotBlank(message = "Informe o e-mail.")
        String email,

        @NotBlank(message = "Informe a senha.")
        String senha) {
}