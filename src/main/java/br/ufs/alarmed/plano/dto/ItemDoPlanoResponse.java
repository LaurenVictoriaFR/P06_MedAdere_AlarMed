package br.ufs.alarmed.plano.dto;

import br.ufs.alarmed.plano.model.HorarioProgramado;
import br.ufs.alarmed.plano.model.ItemDoPlano;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

// O que a API devolve pra cada medicamento do plano.
// fotoCaixa fica de fora: so entra no P4 (RF008).
public record ItemDoPlanoResponse(
        UUID id,
        String nomeMedicamento,
        String dosagem,
        String viaAdministracao,
        String frequencia,
        String duracaoTratamento,
        List<LocalTime> horarios) {

    // converte a entidade na resposta
    public static ItemDoPlanoResponse de(ItemDoPlano item) {
        List<LocalTime> horas = item.getHorarios().stream()
                .map(HorarioProgramado::getHora)
                .toList();

        return new ItemDoPlanoResponse(
                item.getId(),
                item.getNomeMedicamento(),
                item.getDosagem(),
                item.getViaAdministracao(),
                item.getFrequencia(),
                item.getDuracaoTratamento(),
                horas);
    }
}
