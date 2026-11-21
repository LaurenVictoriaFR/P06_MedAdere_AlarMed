import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarItem, formularioVazio, linhaPosologia, linhaDuracao, textoLembretes,
  planoVazio, comItemAdicionado, comItemRemovido, comItemReinserido, semAlteracao,
  temAlteracaoPendente, podeRevisar, confirmarPlano, compararAlteracao, normalizarItem,
} from '../js/dominio/plano.js';
import { dosesDoDia, todosOsItens } from '../js/dominio/doses.js';
import { em, item, planoConfirmado } from './ajuda.js';

const HOJE = '2026-10-17';
const completo = () => ({ ...formularioVazio(), nome: 'Losartana', concentracao: '50 mg', horarios: ['08:00'] });

test('RF002 CA02: item completo é válido', () => {
  assert.equal(validarItem(completo(), HOJE).valido, true);
});

test('RF002 CA02: cada campo obrigatório faltando, isolado', () => {
  const casos = [
    ['nome', { nome: '   ' }],
    ['concentracao', { concentracao: '' }],
    ['horarios', { horarios: [] }],
    ['duracao', { duracao: null }],
  ];
  for (const [campo, mudanca] of casos) {
    const { valido, erros } = validarItem({ ...completo(), ...mudanca }, HOJE);
    assert.equal(valido, false, campo);
    assert.deepEqual(Object.keys(erros), [campo], `só ${campo} deveria falhar`);
  }
});

test('Q03: período "até uma data" exige data válida e não passada', () => {
  assert.ok(validarItem({ ...completo(), duracao: { tipo: 'ate', fim: '' } }, HOJE).erros.duracao);
  assert.ok(validarItem({ ...completo(), duracao: { tipo: 'ate', fim: '2026-10-16' } }, HOJE).erros.duracao);
  assert.ok(validarItem({ ...completo(), duracao: { tipo: 'ate', fim: '2026-02-30' } }, HOJE).erros.duracao);
  assert.equal(validarItem({ ...completo(), duracao: { tipo: 'ate', fim: HOJE } }, HOJE).valido, true);
});

test('horário fora do formato é recusado', () => {
  assert.ok(validarItem({ ...completo(), horarios: ['25:00'] }, HOJE).erros.horarios);
});

test('normalização: horários ordenados sem repetição e foto só se for imagem em base64', () => {
  const i = normalizarItem({ ...completo(), horarios: ['20:00', '08:00', '20:00'], foto: 'javascript:alert(1)' }, 'x');
  assert.deepEqual(i.horarios, ['08:00', '20:00']);
  assert.equal(i.foto, null);
  const comFoto = normalizarItem({ ...completo(), foto: 'data:image/jpeg;base64,AAAA' }, 'y');
  assert.equal(comFoto.foto, 'data:image/jpeg;base64,AAAA');
});

test('textos de posologia seguem o protótipo', () => {
  const i = item({ horarios: ['20:00', '08:00'], qtd: 2 });
  assert.equal(linhaPosologia(i), '2 comprimidos, via oral, às 08:00 e 20:00');
  assert.equal(linhaDuracao(item({ obs: 'Depois do almoço' })), 'Uso contínuo · Depois do almoço');
  assert.equal(textoLembretes([i, item({ horarios: ['12:00'] }, 'i2')]), 'Serão 3 lembretes por dia, às 08:00, 12:00 e 20:00.');
});

test('RN01: cadastro só pode ser revisado com pelo menos um remédio', () => {
  const vazio = planoVazio();
  assert.equal(podeRevisar(vazio), false);
  assert.throws(() => confirmarPlano(vazio, em(HOJE, '09:00')));
  assert.equal(podeRevisar(comItemAdicionado(vazio, item())), true);
});

test('RN01: alteração fica pendente e não muda as doses de hoje até ser confirmada', () => {
  const plano = planoConfirmado([item()], em(HOJE, '07:00'));
  const alterado = comItemAdicionado(plano, item({ nome: 'Metformina', concentracao: '850 mg', horarios: ['12:00'] }, 'i2'));
  assert.equal(temAlteracaoPendente(alterado), true);
  assert.equal(dosesDoDia(todosOsItens(alterado), HOJE).length, 1, 'o rascunho não gera doses');

  const confirmado = confirmarPlano(alterado, em(HOJE, '09:00'));
  assert.equal(temAlteracaoPendente(confirmado), false);
  assert.equal(dosesDoDia(todosOsItens(confirmado), HOJE).length, 2);
});

test('RN01: remover e reinserir o mesmo item desfaz a pendência', () => {
  const plano = planoConfirmado([item(), item({ nome: 'B' }, 'i2')], em(HOJE, '07:00'));
  const semI1 = comItemRemovido(plano, 'i1');
  assert.equal(temAlteracaoPendente(semI1), true);
  assert.deepEqual(compararAlteracao(semI1).removidos.map((i) => i.id), ['i1']);
  const devolvido = comItemReinserido(semI1, plano.confirmado.itens[0], 0);
  assert.equal(temAlteracaoPendente(devolvido), false);
  assert.equal(devolvido.rascunho, null);
});

test('descartar alteração volta ao plano confirmado', () => {
  const plano = planoConfirmado([item()], em(HOJE, '07:00'));
  const alterado = comItemRemovido(plano, 'i1');
  assert.equal(semAlteracao(alterado).rascunho, null);
});

test('item que sai do plano fica no histórico com a data de saída', () => {
  const plano = planoConfirmado([item()], em('2026-10-01', '07:00'));
  const semItem = confirmarPlano(comItemRemovido(plano, 'i1'), em(HOJE, '09:00'));
  assert.equal(semItem.confirmado.itens.length, 0);
  assert.equal(semItem.encerrados.length, 1);
  assert.equal(dosesDoDia(todosOsItens(semItem), '2026-10-10').length, 1, 'dias anteriores continuam com a dose');
  assert.equal(dosesDoDia(todosOsItens(semItem), '2026-10-18').length, 0, 'depois da saída não há dose');
});

test('item mantido na alteração conserva a vigência original', () => {
  const plano = planoConfirmado([item()], em('2026-10-01', '07:00'));
  const alterado = confirmarPlano(comItemAdicionado(plano, item({ nome: 'B' }, 'i2')), em(HOJE, '09:00'));
  const i1 = alterado.confirmado.itens.find((i) => i.id === 'i1');
  assert.equal(i1.inicio, '2026-10-01');
});
