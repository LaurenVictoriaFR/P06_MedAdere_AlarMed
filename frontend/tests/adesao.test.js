import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMes, calcularTaxa, textoTaxa, resumirDia, mesesDisponiveis, dosesComEstado } from '../js/dominio/adesao.js';
import { todosOsItens, idDose } from '../js/dominio/doses.js';
import { em, item, planoConfirmado } from './ajuda.js';

const reg = (status, data, hora) => ({ status, em: em(data, hora).toISOString() });

test('taxa = tomadas ÷ (tomadas + não tomadas)', () => {
  const t = calcularTaxa([{ estado: 'tomada' }, { estado: 'tomada' }, { estado: 'nao_tomada' }, { estado: 'pendente' }, { estado: 'programada' }]);
  assert.equal(t.resolvidas, 3);
  assert.equal(textoTaxa(t.taxa), '67%');
});

test('mês sem doses resolvidas mostra "—"', () => {
  assert.equal(textoTaxa(calcularTaxa([]).taxa), '—');
  assert.equal(textoTaxa(calcularTaxa([{ estado: 'pendente' }, { estado: 'programada' }]).taxa), '—');
});

test('agregados do dia', () => {
  const d = (...estados) => estados.map((estado) => ({ estado }));
  assert.equal(resumirDia(d()).agregado, 'sem_doses');
  assert.equal(resumirDia(d('tomada', 'tomada')).agregado, 'todas');
  assert.equal(resumirDia(d('tomada', 'nao_tomada')).agregado, 'parte');
  assert.equal(resumirDia(d('nao_tomada', 'nao_tomada')).agregado, 'nenhuma');
  assert.equal(resumirDia(d('tomada', 'pendente')).agregado, 'em_andamento');
});

test('mês com histórico: automáticas contam como não tomadas, futuro fica fora', () => {
  // Plano desde 01/10 às 07:00, uma dose às 08:00. Hoje = 05/10 às 12:00.
  const plano = planoConfirmado([item({ horarios: ['08:00'] })], em('2026-10-01', '07:00'));
  const itens = todosOsItens(plano);
  const registros = {
    [idDose('i1', '2026-10-01', '08:00')]: reg('tomada', '2026-10-01', '08:10'),
    [idDose('i1', '2026-10-02', '08:00')]: reg('tomada', '2026-10-02', '08:10'),
    [idDose('i1', '2026-10-03', '08:00')]: reg('nao_tomada', '2026-10-03', '08:30'),
    // 04/10 sem registro → não tomada automática
    [idDose('i1', '2026-10-05', '08:00')]: reg('tomada', '2026-10-05', '09:00'),
  };
  const mes = calcularMes(itens, registros, '2026-10', em('2026-10-05', '12:00'));
  assert.equal(mes.tomadas, 3);
  assert.equal(mes.naoTomadas, 2);
  assert.equal(textoTaxa(mes.taxa), '60%');
  assert.deepEqual(mes.contagem, { todas: 3, parte: 0, nenhuma: 2 });
  assert.equal(mes.dias[3].resumo.agregado, 'nenhuma');
  assert.equal(mes.dias[9].futuro, true);
  assert.equal(mes.dias.length, 31);
  assert.equal(mes.primeiroDiaDaSemana, 4, '01/10/2026 é quinta-feira');
});

test('plano que começa hoje: taxa "—" até a primeira dose resolver', () => {
  const plano = planoConfirmado([item({ horarios: ['20:00'] })], em('2026-10-17', '10:00'));
  const mes = calcularMes(todosOsItens(plano), {}, '2026-10', em('2026-10-17', '10:05'));
  assert.equal(mes.taxa, null);
  assert.equal(mes.dias[0].resumo.agregado, 'sem_doses');
});

test('dose das 23h pendente na madrugada mantém o dia anterior em andamento', () => {
  const plano = planoConfirmado([item({ horarios: ['23:00'] })], em('2026-10-01', '07:00'));
  const doses = dosesComEstado(todosOsItens(plano), {}, '2026-10-17', em('2026-10-18', '00:30'));
  assert.equal(resumirDia(doses).agregado, 'em_andamento');
});

test('meses disponíveis vão da primeira vigência até o mês atual', () => {
  const plano = planoConfirmado([item()], em('2026-08-20', '07:00'));
  assert.deepEqual(mesesDisponiveis(todosOsItens(plano), em('2026-10-17', '08:00')), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(mesesDisponiveis([], em('2026-10-17', '08:00')), ['2026-10']);
});
