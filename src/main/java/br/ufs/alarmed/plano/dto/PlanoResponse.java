package br.ufs.alarmed.plano.dto;

import br.ufs.alarmed.plano.model.PlanoMedicamentoso;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// O que a API devolve sobre um plano: os dados dele e a lista completa de medicamentos.
// E essa resposta que a tela de revisao (P02) mostra pro usuario conferir (UC-08, passo 1).
// pacienteId fica de fora: o paciente ja sabe quem ele e.
public record PlanoResponse(
        UUID id,
        LocalDate dataInicio,
        LocalDate dataFim,
        SituacaoPlano situacao,
        List<ItemDoPlanoResponse> itens) {

    // converte a entidade na resposta
    public static PlanoResponse de(PlanoMedicamentoso plano) {
        List<ItemDoPlanoResponse> itens = plano.getItens().stream()
                .map(ItemDoPlanoResponse::de)
                .toList();

        return new PlanoResponse(
                plano.getId(),
                plano.getDataInicio(),
                plano.getDataFim(),
                plano.getSituacao(),
                itens);
    }
}
