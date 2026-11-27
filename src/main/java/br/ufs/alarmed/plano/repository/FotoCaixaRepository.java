package br.ufs.alarmed.plano.repository;

import br.ufs.alarmed.plano.model.FotoCaixa;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/**
 * Acesso as fotos da caixa (RF008). A chave da foto e o id do item.
 */
public interface FotoCaixaRepository extends JpaRepository<FotoCaixa, UUID> {

    /**
     * Copia a foto de um item para outro direto no banco, sem trazer os bytes para a
     * aplicacao. Usado na alteracao do plano (UC-04): a copia do item mantem a foto.
     *
     * @param origem item de onde a foto vem
     * @param destino item que recebe a copia
     * @return quantas fotos foram copiadas (0 se a origem nao tinha foto)
     */
    @Modifying(flushAutomatically = true)
    @Query(value = "insert into foto_caixa (item_id, conteudo) "
            + "select :destino, conteudo from foto_caixa where item_id = :origem",
            nativeQuery = true)
    int copiar(UUID origem, UUID destino);
}
