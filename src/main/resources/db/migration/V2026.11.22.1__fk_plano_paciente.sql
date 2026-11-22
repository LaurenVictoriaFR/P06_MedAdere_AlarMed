-- Liga o plano ao paciente dono dele (TD-04).
-- Quando a tabela do plano foi criada, a tabela paciente (Bloco B) ainda nao existia,
-- entao paciente_id ficou sem chave estrangeira. Agora o banco recusa plano de paciente inexistente.
ALTER TABLE plano_medicamentoso
    ADD CONSTRAINT fk_plano_paciente FOREIGN KEY (paciente_id) REFERENCES paciente (id);
