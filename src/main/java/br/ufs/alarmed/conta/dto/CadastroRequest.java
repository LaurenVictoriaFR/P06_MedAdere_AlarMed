package br.ufs.alarmed.conta.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/*Corpo de POST /contas (UC-05). A confirmação da senha é conferida no service,
porque depende de dois campos. O aceite dos Termos só valida o cadastro ,
não é gravado no banco.*/

public record CadastroRequest(
		@NotBlank(message = "Informe o nome do usuário.") 
		@Size(max = 120, message = "O nome do usuário pode ter no máximo 120 caracteres.") 
		String nome,

		@NotBlank(message = "Informe o email do usuário.") 
		@Size(max = 120, message = "O email pode ter no máximo 120 caracteres.") 
		@Email(message = "Informe um email válido.") 
		String email,

		@NotBlank(message = "Informe a senha do usuário.") 
		@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,100}$", message = "A senha deve ter de 8 a 100 caracteres, com letras e números.") 
		String senha,

		@NotBlank(message = "Confirme a senha do usuário.") 
		String confirmacaoSenha,

		@NotNull(message = "Informe a data de nascimento do usuário.") 
		@Past(message = "A data de nascimento deve estar no passado.") 
		LocalDate dataNascimento,

		@Size(max = 20, message = "O telefone pode ter no máximo 20 caracteres.") 
		String telefone,

		@NotNull(message = "Aceite os termos de uso para finalizar o cadastro.") 
		@AssertTrue(message = "Aceite os termos de uso para finalizar o cadastro.") 
		Boolean aceiteTermos) {
}
