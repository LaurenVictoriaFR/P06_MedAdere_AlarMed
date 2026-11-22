import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dosesDoDia, estadoDaDose, fimDaJanela, podeRegistrar, podeCorrigir,
  encontrarDose, motivoParaRecusarRegistro, todosOsItens, idDose, ESTADOS,
} from '../js/dominio/doses.js';
import { em, item, planoConfirmado } from './ajuda.js';

const DIA = '2026-10-17';

function doseUnica(horarios = ['08:00'], hora = '08:00', quando = em('2026-10-01', '07:00')) {
  const plano = planoConfirmado([item({ horarios })], quando);
  const itens = todosOsItens(plano);
  return { itens, dose: encontrarDose(itens, idDose('i1', DIA, hora)) };
}

test('programada antes de T, pendente a partir de T', () => {
  const { dose } = doseUnica();
  assert.equal(estadoDaDose(dose, null, em(DIA, '07:59')).estado, ESTADOS.PROGRAMADA);
  assert.equal(estadoDaDose(dose, null, em(DIA, '08:00')).estado, ESTADOS.PENDENTE);
});

// Cenário QS-02 e risco R07: com 119 e 120 minutos o registro é aceito; com 121, recusado.
test('janela de 2 h (QS-02): T+119 e T+120 ainda pendentes, T+121 vira não tomada automática', () => {
  const { dose } = doseUnica();
  for (const hora of ['09:59', '10:00']) {
    assert.equal(estadoDaDose(dose, null, em(DIA, hora)).estado, ESTADOS.PENDENTE, hora);
    assert.equal(motivoParaRecusarRegistro(dose, 'tomada', null, em(DIA, hora)), null, hora);
  }
  const fimDoMinuto120 = new Date(em(DIA, '10:00').getTime() + 59 * 1000);
  assert.equal(podeRegistrar(dose, fimDoMinuto120), true, '10:00:59 ainda conta como 120 min');
  const fim = estadoDaDose(dose, null, em(DIA, '10:01'));
  assert.equal(fim.estado, ESTADOS.NAO_TOMADA);
  assert.equal(fim.automatica, true);
  assert.equal(motivoParaRecusarRegistro(dose, 'tomada', null, em(DIA, '10:01')), 'prazo_encerrado');
});

test('a tela mostra o último minuto aceito: "Registre até as 10:00"', () => {
  const { dose } = doseUnica();
  assert.deepEqual(fimDaJanela(dose), em(DIA, '10:01'));
  assert.deepEqual(estadoDaDose(dose, null, em(DIA, '08:00')).registrarAte, em(DIA, '10:00'));
});

test('próxima dose do mesmo medicamento antes de 2 h encurta a janela', () => {
  const { dose } = doseUnica(['08:00', '09:00']);
  assert.deepEqual(fimDaJanela(dose), em(DIA, '09:00'));
  assert.deepEqual(estadoDaDose(dose, null, em(DIA, '08:00')).registrarAte, em(DIA, '08:59'));
  assert.equal(estadoDaDose(dose, null, em(DIA, '08:59')).estado, ESTADOS.PENDENTE);
  assert.equal(estadoDaDose(dose, null, em(DIA, '09:00')).estado, ESTADOS.NAO_TOMADA);
});

test('dose de outro medicamento não encurta a janela', () => {
  const plano = planoConfirmado([item({ horarios: ['08:00'] }), item({ nome: 'B', horarios: ['09:00'] }, 'i2')], em('2026-10-01', '07:00'));
  const dose = encontrarDose(todosOsItens(plano), idDose('i1', DIA, '08:00'));
  assert.deepEqual(fimDaJanela(dose), em(DIA, '10:01'));
});

test('RF004 E2: registro antes do horário é recusado', () => {
  const { dose } = doseUnica();
  assert.equal(podeRegistrar(dose, em(DIA, '07:59')), false);
  assert.equal(motivoParaRecusarRegistro(dose, 'tomada', null, em(DIA, '07:59')), 'antes_do_horario');
});

test('registro dentro da janela é aceito; depois do prazo, recusado', () => {
  const { dose } = doseUnica();
  assert.equal(motivoParaRecusarRegistro(dose, 'tomada', null, em(DIA, '08:30')), null);
  assert.equal(motivoParaRecusarRegistro(dose, 'tomada', null, em(DIA, '12:00')), 'prazo_encerrado');
});

test('registro é final: não aceita segundo registro nem status desconhecido', () => {
  const { dose } = doseUnica();
  const reg = { status: 'tomada', em: em(DIA, '08:05').toISOString() };
  assert.equal(motivoParaRecusarRegistro(dose, 'nao_tomada', reg, em(DIA, '08:10')), 'ja_registrada');
  assert.equal(motivoParaRecusarRegistro(dose, 'ignorada', null, em(DIA, '08:10')), 'status_invalido');
});

test('RF004 E3: corrigir só dentro da janela', () => {
  const { dose } = doseUnica();
  const reg = { status: 'tomada', em: em(DIA, '08:05').toISOString() };
  assert.equal(podeCorrigir(dose, reg, em(DIA, '10:00')), true);
  assert.equal(podeCorrigir(dose, reg, em(DIA, '10:01')), false);
  assert.equal(estadoDaDose(dose, reg, em(DIA, '23:00')).estado, ESTADOS.TOMADA, 'registro continua valendo');
});

test('a dose pertence ao dia de T: a das 23h resolvida à 1h segue no dia anterior', () => {
  const { itens, dose } = doseUnica(['23:00'], '23:00');
  assert.equal(estadoDaDose(dose, null, em('2026-10-18', '00:30')).estado, ESTADOS.PENDENTE);
  assert.equal(podeRegistrar(dose, em('2026-10-18', '01:00')), true);
  assert.equal(estadoDaDose(dose, null, em('2026-10-18', '01:01')).estado, ESTADOS.NAO_TOMADA);
  assert.equal(dosesDoDia(itens, DIA).length, 1);
  assert.equal(dosesDoDia(itens, DIA)[0].data, DIA);
});

test('plano que começa hoje: horários anteriores à confirmação não geram dose', () => {
  const plano = planoConfirmado([item({ horarios: ['08:00', '20:00'] })], em(DIA, '10:30'));
  const doses = dosesDoDia(todosOsItens(plano), DIA);
  assert.deepEqual(doses.map((d) => d.hora), ['20:00']);
  assert.equal(encontrarDose(todosOsItens(plano), idDose('i1', DIA, '08:00')), null);
});

test('plano de 7 dias termina no 7º dia', () => {
  const plano = planoConfirmado([item({ duracao: { tipo: 'dias', dias: 7 } })], em('2026-10-01', '07:00'));
  const itens = todosOsItens(plano);
  assert.equal(dosesDoDia(itens, '2026-10-07').length, 1);
  assert.equal(dosesDoDia(itens, '2026-10-08').length, 0);
});

test('"até uma data" inclui o último dia', () => {
  const plano = planoConfirmado([item({ duracao: { tipo: 'ate', fim: '2026-10-05' } })], em('2026-10-01', '07:00'));
  const itens = todosOsItens(plano);
  assert.equal(dosesDoDia(itens, '2026-10-05').length, 1);
  assert.equal(dosesDoDia(itens, '2026-10-06').length, 0);
});

test('id de dose inventado ou de horário fora do plano não é encontrado', () => {
  const { itens } = doseUnica();
  assert.equal(encontrarDose(itens, 'qualquer-coisa'), null);
  assert.equal(encontrarDose(itens, idDose('i1', DIA, '09:00')), null);
  assert.equal(encontrarDose(itens, idDose('outro', DIA, '08:00')), null);
});
