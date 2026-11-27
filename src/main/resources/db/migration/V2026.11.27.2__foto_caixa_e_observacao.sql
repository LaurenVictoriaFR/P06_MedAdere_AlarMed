-- RF008 Foto da caixa (P3 DA-02, BL-07) e observacao do item.
-- A imagem fica numa tabela propria, ligada ao item: carregar o plano nao traz os bytes,
-- e apagar o item (ou o plano) apaga a foto junto (MOD-01).

-- a coluna reservada no P3 nunca foi usada; no lugar dela, o item guarda so o tipo da imagem
-- (null = sem foto), que vira o Content-Type na hora de devolver a foto
ALTER TABLE item_do_plano DROP COLUMN foto_caixa;
ALTER TABLE item_do_plano ADD COLUMN foto_tipo VARCHAR(20);

-- observacao livre da receita (ex.: "tomar em jejum"), opcional
ALTER TABLE item_do_plano ADD COLUMN observacao VARCHAR(500);

CREATE TABLE foto_caixa (
    item_id   UUID  NOT NULL,
    conteudo  BYTEA NOT NULL,
    CONSTRAINT pk_foto_caixa PRIMARY KEY (item_id),
    CONSTRAINT fk_foto_item FOREIGN KEY (item_id)
        REFERENCES item_do_plano (id) ON DELETE CASCADE,
    -- 2 MB, o mesmo limite que o service confere antes de gravar
    CONSTRAINT ck_foto_tamanho CHECK (OCTET_LENGTH(conteudo) <= 2097152)
);
