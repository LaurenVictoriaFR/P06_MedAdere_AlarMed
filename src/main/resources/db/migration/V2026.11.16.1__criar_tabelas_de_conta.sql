-- Conta de usuario e paciente (UC-05, DM01, MOD-04).
-- A conta é quem acessa o sistema (paciente ou cuidador) e o paciente é quem tem o tratamento.
-- Relacao 1:1 no MVP: cada conta tem exatamente um paciente (UNIQUE em paciente.conta_id).
-- A senha fica sem hash por decisao do grupo (ADR-04, risco R04).

CREATE TABLE conta_usuario (
    id        UUID         NOT NULL,
    nome      VARCHAR(120) NOT NULL,
    email     VARCHAR(120) NOT NULL,
    senha     VARCHAR(100) NOT NULL,
    data_nascimento  DATE NOT NULL,
    telefone  VARCHAR(20),
    CONSTRAINT pk_conta_usuario PRIMARY KEY (id),
    CONSTRAINT uk_conta_email UNIQUE (email)
);

CREATE TABLE paciente (
    id               UUID         NOT NULL,
    conta_id         UUID         NOT NULL,
    nome             VARCHAR(120) NOT NULL,
    CONSTRAINT pk_paciente PRIMARY KEY (id),
    CONSTRAINT fk_paciente_conta FOREIGN KEY (conta_id) REFERENCES conta_usuario (id),
    CONSTRAINT uk_paciente_conta UNIQUE (conta_id)
);
