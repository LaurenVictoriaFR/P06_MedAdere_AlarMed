package br.ufs.alarmed.plano.dto;

import br.ufs.alarmed.plano.model.HorarioProgramado;
import br.ufs.alarmed.plano.model.ItemDoPlano;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

// O que a API devolve pra cada medicamento do plano.
// A foto nao vem aqui (RF008): temFoto so diz se existe; a imagem tem rota propria.
public record ItemDoPlanoResponse(
        UUID id,
        String nomeMedicamento,
        String dosagem,
        String viaAdministracao,
        String frequencia,
        String duracaoTratamento,
        List<LocalTime> horarios,
        // UC-04: item do plano anterior de onde a copia veio; null pra item novo
        UUID itemOrigemId,
        // inicio da contagem da duracao; null antes de confirmar
        LocalDate inicioTratamento,
        boolean temFoto) {

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
                horas,
                item.getItemOrigemId(),
                item.getInicioTratamento(),
                item.getFotoCaixa() != null);
    }
}
