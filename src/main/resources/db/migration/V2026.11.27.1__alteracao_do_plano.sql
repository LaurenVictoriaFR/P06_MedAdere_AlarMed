-- UC-04 Alterar plano confirmado (P2 MOD-03, SD04; P3 BL-04, TD-05).
-- A alteracao e uma versao nova do plano, ligada ao plano confirmado que ela substitui.

-- versao em edicao -> plano confirmado que ela vai substituir (null no primeiro cadastro)
ALTER TABLE plano_medicamentoso ADD COLUMN plano_anterior_id UUID;
ALTER TABLE plano_medicamentoso ADD CONSTRAINT fk_plano_anterior
    FOREIGN KEY (plano_anterior_id) REFERENCES plano_medicamentoso (id);

-- bloqueio otimista (TD-05): duas edicoes simultaneas no mesmo plano viram 409
ALTER TABLE plano_medicamentoso ADD COLUMN versao BIGINT DEFAULT 0 NOT NULL;

-- item copiado na alteracao -> item do plano anterior de onde ele veio (null pra item novo)
ALTER TABLE item_do_plano ADD COLUMN item_origem_id UUID;
ALTER TABLE item_do_plano ADD CONSTRAINT fk_item_origem
    FOREIGN KEY (item_origem_id) REFERENCES item_do_plano (id) ON DELETE SET NULL;

-- dia em que a contagem da duracao comeca. A copia mantem a do original,
-- pra alterar o plano nao reiniciar um tratamento de "7 dias".
ALTER TABLE item_do_plano ADD COLUMN inicio_tratamento DATE;

-- planos ja confirmados antes desta migration: o tratamento comecou no inicio do plano
UPDATE item_do_plano i SET inicio_tratamento =
    (SELECT p.data_inicio FROM plano_medicamentoso p WHERE p.id = i.plano_id AND p.situacao IN ('CONFIRMADO', 'ENCERRADO'));

CREATE INDEX idx_plano_anterior ON plano_medicamentoso (plano_anterior_id);
