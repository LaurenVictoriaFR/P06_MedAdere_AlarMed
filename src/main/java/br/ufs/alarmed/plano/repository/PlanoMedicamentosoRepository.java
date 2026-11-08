package br.ufs.alarmed.plano.repository;

import br.ufs.alarmed.plano.model.PlanoMedicamentoso;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Acesso ao banco pro plano medicamentoso.
// Itens e horarios nao tem repository proprio: eles sao salvos e apagados junto com o plano (composicao, DM07).
// O Spring monta as consultas sozinho a partir do nome de cada metodo.
public interface PlanoMedicamentosoRepository extends JpaRepository<PlanoMedicamentoso, UUID> {

    // Busca um plano so se ele for do paciente informado.
    // Assim um paciente nunca abre o plano de outro, mesmo sabendo o id (UC-06, pos-condicao).
    Optional<PlanoMedicamentoso> findByIdAndPacienteId(UUID id, UUID pacienteId);

    // Planos de um paciente numa situacao. Ex.: o plano CONFIRMADO dele,
    // ou um cadastro EM_EDICAO que ficou pela metade.
    List<PlanoMedicamentoso> findByPacienteIdAndSituacao(UUID pacienteId, SituacaoPlano situacao);

    // Todos os planos numa situacao. Pensado pro Bloco D, que gera as doses
    // a partir dos planos CONFIRMADOS (DM02).
    List<PlanoMedicamentoso> findBySituacao(SituacaoPlano situacao);
}
