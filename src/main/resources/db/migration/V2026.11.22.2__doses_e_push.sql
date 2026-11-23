ALTER TABLE plano_medicamentoso ADD COLUMN confirmado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE plano_medicamentoso ADD COLUMN fuso_horario VARCHAR(60);
ALTER TABLE plano_medicamentoso ADD COLUMN gerado_ate DATE;
-- Planos antigos não guardavam a hora da confirmação: aproximação documentada.
UPDATE plano_medicamentoso SET confirmado_em = CAST(data_inicio AS TIMESTAMP WITH TIME ZONE),
    fuso_horario = 'America/Maceio' WHERE situacao = 'CONFIRMADO';

CREATE TABLE dose (
    id VARCHAR(64) PRIMARY KEY,
    plano_id UUID NOT NULL REFERENCES plano_medicamentoso(id),
    item_id UUID NOT NULL REFERENCES item_do_plano(id),
    paciente_id UUID NOT NULL REFERENCES paciente(id),
    data_local DATE NOT NULL,
    horario TIME NOT NULL,
    programada_em TIMESTAMP WITH TIME ZONE NOT NULL,
    fim_janela TIMESTAMP WITH TIME ZONE NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PROGRAMADA','PENDENTE','TOMADA','NAO_TOMADA')),
    automatica BOOLEAN NOT NULL DEFAULT FALSE,
    registrado_em TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_dose_item_data_hora UNIQUE (item_id, data_local, horario),
    CONSTRAINT ck_dose_janela CHECK (fim_janela > programada_em),
    CONSTRAINT ck_dose_registro CHECK (
        (estado IN ('PROGRAMADA','PENDENTE') AND registrado_em IS NULL AND automatica = FALSE)
        OR (estado IN ('TOMADA','NAO_TOMADA') AND registrado_em IS NOT NULL)),
    CONSTRAINT ck_dose_automatica CHECK (automatica = FALSE OR estado = 'NAO_TOMADA')
);
CREATE INDEX idx_dose_paciente_data ON dose(paciente_id, data_local);
CREATE INDEX idx_dose_agendador ON dose(estado, programada_em);

CREATE TABLE inscricao_push (
    id UUID PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES paciente(id),
    endpoint VARCHAR(2048) NOT NULL,
    endpoint_hash VARCHAR(64) NOT NULL UNIQUE,
    p256dh VARCHAR(256) NOT NULL,
    auth VARCHAR(128) NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_push_paciente ON inscricao_push(paciente_id, ativa);

-- Uma notificação lógica por dose; uma entrega por aparelho inscrito.
CREATE TABLE lembrete (
    id VARCHAR(64) PRIMARY KEY REFERENCES dose(id),
    situacao VARCHAR(30) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE entrega_push (
    id VARCHAR(110) PRIMARY KEY,
    dose_id VARCHAR(64) NOT NULL REFERENCES dose(id),
    inscricao_id UUID NOT NULL REFERENCES inscricao_push(id),
    tentativas INTEGER NOT NULL DEFAULT 0,
    situacao VARCHAR(30) NOT NULL,
    codigo_http INTEGER,
    proxima_tentativa TIMESTAMP WITH TIME ZONE,
    primeira_tentativa_em TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_entrega_dose_inscricao UNIQUE (dose_id, inscricao_id)
);
