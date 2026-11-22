import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularMes, calcularTaxa, calcularTaxaAtual, chaveDoMedicamento, medicamentosDoPlano,
  textoTaxa, resumirDia, mesesDisponiveis, dosesComEstado,
} from '../js/dominio/adesao.js';
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

// Plano desde 28/09, Losartana às 08:00 e Metformina às 20:00. Hoje = 02/10 às 12:00.
function historicoDeDoisRemedios() {
  const plano = planoConfirmado([
    item({ horarios: ['08:00'] }),
    item({ nome: 'Metformina', concentracao: '850 mg', horarios: ['20:00'] }, 'i2'),
  ], em('2026-09-28', '07:00'));
  const registros = {
    [idDose('i1', '2026-09-28', '08:00')]: reg('tomada', '2026-09-28', '08:10'),
    [idDose('i1', '2026-09-29', '08:00')]: reg('tomada', '2026-09-29', '08:10'),
    // 30/09 sem registro: não tomada automática
    [idDose('i1', '2026-10-01', '08:00')]: reg('tomada', '2026-10-01', '08:10'),
    [idDose('i1', '2026-10-02', '08:00')]: reg('tomada', '2026-10-02', '08:20'),
    [idDose('i2', '2026-09-28', '20:00')]: reg('nao_tomada', '2026-09-28', '20:30'),
    [idDose('i2', '2026-09-29', '20:00')]: reg('tomada', '2026-09-29', '20:05'),
    // 30/09 e 01/10 sem registro; a de hoje às 20:00 ainda é programada
  };
  return { itens: todosOsItens(plano), registros, agora: em('2026-10-02', '12:00') };
}

test('UC-03: taxa atual geral conta todas as doses passadas desde o início, não só o mês', () => {
  const { itens, registros, agora } = historicoDeDoisRemedios();
  const atual = calcularTaxaAtual(itens, registros, agora);
  assert.equal(atual.tomadas, 5);
  assert.equal(atual.resolvidas, 9, '5 da Losartana + 4 da Metformina; a de hoje às 20:00 fica fora');
  assert.equal(textoTaxa(atual.taxa), '56%');
  const outubro = calcularMes(itens, registros, '2026-10', agora);
  assert.equal(textoTaxa(outubro.taxa), '67%', 'a taxa do mês só olha outubro');
});

test('UC-03 A3: taxa atual por medicamento', () => {
  const { itens, registros, agora } = historicoDeDoisRemedios();
  const losartana = calcularTaxaAtual(itens, registros, agora, chaveDoMedicamento(itens[0]));
  const metformina = calcularTaxaAtual(itens, registros, agora, chaveDoMedicamento(itens[1]));
  assert.equal(textoTaxa(losartana.taxa), '80%');
  assert.equal(textoTaxa(metformina.taxa), '25%');
});

test('UC-03 A4: sem doses passadas, a taxa atual fica "—"', () => {
  const plano = planoConfirmado([item({ horarios: ['20:00'] })], em('2026-10-17', '10:00'));
  assert.equal(calcularTaxaAtual(todosOsItens(plano), {}, em('2026-10-17', '10:05')).taxa, null);
  assert.equal(calcularTaxaAtual([], {}, em('2026-10-17', '10:05')).taxa, null);
});

test('o mesmo remédio em dois itens aparece uma vez só na lista de medicamentos', () => {
  const itens = [
    item({ horarios: ['08:00'] }),
    item({ nome: 'losartana', horarios: ['20:00'] }, 'i2'),
    item({ nome: 'AAS', concentracao: '100 mg' }, 'i3'),
  ];
  assert.deepEqual(medicamentosDoPlano(itens).map((m) => m.chave), ['aas 100 mg', 'losartana 50 mg']);
});

test('meses disponíveis vão da primeira vigência até o mês atual', () => {
  const plano = planoConfirmado([item()], em('2026-08-20', '07:00'));
  assert.deepEqual(mesesDisponiveis(todosOsItens(plano), em('2026-10-17', '08:00')), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(mesesDisponiveis([], em('2026-10-17', '08:00')), ['2026-10']);
});
