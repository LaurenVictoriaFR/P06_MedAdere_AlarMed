package br.ufs.alarmed.plano.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;
import java.util.List;

// O que o front manda pra adicionar um medicamento ao plano (UC-01, passos 2 a 4).
// Se faltar algo obrigatorio, o tratador global devolve 400 com o nome do campo (UC-01, fluxo A1).
// Exemplo de JSON:
// {
//   "nomeMedicamento": "Losartana",
//   "dosagem": "50 mg",
//   "viaAdministracao": "oral",
//   "frequencia": "12 em 12 horas",
//   "duracaoTratamento": "uso continuo",
//   "horarios": ["08:00", "20:00"]
// }
public record ItemDoPlanoRequest(

        @NotBlank(message = "Informe o nome do medicamento.")
        @Size(max = 120, message = "O nome do medicamento pode ter no máximo 120 caracteres.")
        String nomeMedicamento,

        @NotBlank(message = "Informe a dosagem.")
        @Size(max = 60, message = "A dosagem pode ter no máximo 60 caracteres.")
        String dosagem,

        // opcional (DM12)
        @Size(max = 60, message = "A via de administração pode ter no máximo 60 caracteres.")
        String viaAdministracao,

        @NotBlank(message = "Informe a frequência.")
        @Size(max = 60, message = "A frequência pode ter no máximo 60 caracteres.")
        String frequencia,

        @NotBlank(message = "Informe a duração do tratamento ou \"uso contínuo\".")
        @Size(max = 60, message = "A duração do tratamento pode ter no máximo 60 caracteres.")
        String duracaoTratamento,

        @NotEmpty(message = "Informe ao menos um horário.")
        List<@NotNull(message = "Horário inválido.") LocalTime> horarios) {
}
