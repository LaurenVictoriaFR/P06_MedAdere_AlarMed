-- Tabelas do plano medicamentoso (UC-01, UC-08).
-- Composicao do P2 (DM07, MOD-01): plano -> itens -> horarios.
-- Apagar o plano apaga os itens, e apagar o item apaga os horarios (ON DELETE CASCADE).

CREATE TABLE plano_medicamentoso (
    id           UUID        NOT NULL,
    -- ainda sem chave estrangeira: a tabela de paciente e do Bloco B e ainda nao existe
    paciente_id  UUID        NOT NULL,
    data_inicio  DATE        NOT NULL,
    data_fim     DATE,
    situacao     VARCHAR(20) NOT NULL,
    CONSTRAINT pk_plano_medicamentoso PRIMARY KEY (id),
    CONSTRAINT ck_plano_situacao CHECK (situacao IN ('EM_EDICAO', 'EM_REVISAO', 'CONFIRMADO', 'ENCERRADO'))
);

CREATE TABLE item_do_plano (
    id                  UUID         NOT NULL,
    plano_id            UUID         NOT NULL,
    nome_medicamento    VARCHAR(120) NOT NULL,
    dosagem             VARCHAR(60)  NOT NULL,
    via_administracao   VARCHAR(60),
    frequencia          VARCHAR(60)  NOT NULL,
    duracao_tratamento  VARCHAR(60)  NOT NULL,
    -- reservado pra foto da caixa (RF008), usado so no P4
    foto_caixa          VARCHAR(255),
    CONSTRAINT pk_item_do_plano PRIMARY KEY (id),
    CONSTRAINT fk_item_plano FOREIGN KEY (plano_id)
        REFERENCES plano_medicamentoso (id) ON DELETE CASCADE
);

CREATE TABLE horario_programado (
    id       UUID NOT NULL,
    item_id  UUID NOT NULL,
    hora     TIME NOT NULL,
    CONSTRAINT pk_horario_programado PRIMARY KEY (id),
    CONSTRAINT fk_horario_item FOREIGN KEY (item_id)
        REFERENCES item_do_plano (id) ON DELETE CASCADE,
    -- o mesmo horario nao pode aparecer duas vezes no mesmo item
    CONSTRAINT uk_horario_item_hora UNIQUE (item_id, hora)
);

-- indices pras buscas mais comuns: planos de um paciente, itens de um plano, horarios de um item
CREATE INDEX idx_plano_paciente ON plano_medicamentoso (paciente_id);
CREATE INDEX idx_item_plano ON item_do_plano (plano_id);
CREATE INDEX idx_horario_item ON horario_programado (item_id);
