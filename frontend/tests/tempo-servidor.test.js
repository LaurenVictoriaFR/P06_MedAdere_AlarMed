import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarFuso, dataISO, horaHM, deDataHora, somarDias } from '../js/dominio/tempo.js';

test('horários do plano usam America/Maceio independentemente do fuso do aparelho', () => {
  configurarFuso('America/Maceio');
  try {
    assert.equal(horaHM(new Date('2026-11-22T11:00:00Z')), '08:00');
    assert.equal(dataISO(new Date('2026-11-23T01:00:00Z')), '2026-11-22');
    assert.equal(deDataHora('2026-11-22', '08:00').toISOString(), '2026-11-22T11:00:00.000Z');
    assert.equal(somarDias('2026-11-22', 1), '2026-11-23');
  } finally { configurarFuso(null); }
});
