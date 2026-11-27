package br.ufs.alarmed.plano.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import java.util.UUID;

/**
 * Imagem da caixa de um medicamento do plano (RF008).
 *
 * <p>Fica separada do {@link ItemDoPlano} para que carregar o plano nao traga os bytes.
 * A chave e o proprio id do item; o banco apaga a foto quando o item e apagado.
 * O tipo da imagem fica no item ({@link ItemDoPlano#getFotoTipo()}).
 */
@Entity
@Table(name = "foto_caixa")
public class FotoCaixa {

    /** Tamanho maximo da foto: 2 MB (DA-02). */
    public static final int TAMANHO_MAXIMO = 2 * 1024 * 1024;

    @Id
    @Column(name = "item_id")
    private UUID itemId;

    @Column(nullable = false)
    private byte[] conteudo;

    /** Construtor vazio, exigido pelo JPA. */
    protected FotoCaixa() {
    }

    /**
     * Cria a foto de um item.
     *
     * @param itemId id do item do plano
     * @param conteudo bytes da imagem, ja conferidos pelo service
     */
    public FotoCaixa(UUID itemId, byte[] conteudo) {
        this.itemId = Objects.requireNonNull(itemId, "itemId");
        this.conteudo = Objects.requireNonNull(conteudo, "conteudo").clone();
    }

    /**
     * Id do item a que a foto pertence.
     *
     * @return o id do item
     */
    public UUID getItemId() {
        return itemId;
    }

    /**
     * Bytes da imagem.
     *
     * @return uma copia do conteudo
     */
    public byte[] getConteudo() {
        return conteudo.clone();
    }
}
