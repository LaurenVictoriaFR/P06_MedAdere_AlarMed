// Plano medicamentoso: validação do item (RF002 CA02, Q03), textos de posologia
// e o ciclo rascunho → revisão → confirmado (RN01).
//
// Formato do plano:
// {
//   confirmado: null | { itens: [ItemVigente], confirmadoEm: ISO },
//   rascunho:   null | [Item],      // cadastro em andamento ou alteração pendente
//   encerrados: [ItemVigente]       // itens que saíram do plano (mantidos para o histórico)
// }
// ItemVigente = Item + { vigenteDesde: ISO, inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD' | null, encerradoEm?: ISO }

import { dataISO, somarDias, horaValida, dataValida, dataBR } from './tempo.js';

export const UNIDADES = [
  { valor: 'comprimido', rotulo: 'Comprimido', singular: 'comprimido', plural: 'comprimidos' },
  { valor: 'capsula', rotulo: 'Cápsula', singular: 'cápsula', plural: 'cápsulas' },
  { valor: 'gota', rotulo: 'Gotas', singular: 'gota', plural: 'gotas' },
  { valor: 'ml', rotulo: 'mL', singular: 'mL', plural: 'mL' },
];

export const VIAS = [
  { valor: 'oral', rotulo: 'Oral', texto: 'via oral' },
  { valor: 'sublingual', rotulo: 'Sublingual', texto: 'debaixo da língua' },
  { valor: 'pele', rotulo: 'Na pele', texto: 'na pele' },
  { valor: 'inalacao', rotulo: 'Inalação', texto: 'por inalação' },
];

export const GRADE_HORARIOS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

export const OPCOES_DURACAO = [
  { valor: 'continuo', rotulo: 'Uso contínuo', duracao: { tipo: 'continuo' } },
  { valor: 'd7', rotulo: '7 dias', duracao: { tipo: 'dias', dias: 7 } },
  { valor: 'd10', rotulo: '10 dias', duracao: { tipo: 'dias', dias: 10 } },
  { valor: 'd14', rotulo: '14 dias', duracao: { tipo: 'dias', dias: 14 } },
  { valor: 'd30', rotulo: '30 dias', duracao: { tipo: 'dias', dias: 30 } },
  { valor: 'ate', rotulo: 'Até uma data', duracao: { tipo: 'ate', fim: '' } },
];

export const QTD_MIN = 1;
export const QTD_MAX = 40;
export const LIMITES = { nome: 80, concentracao: 30, obs: 120 };

const FOTO_VALIDA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function formularioVazio() {
  return {
    nome: '',
    concentracao: '',
    qtd: 1,
    unidade: 'comprimido',
    via: 'oral',
    horarios: [],
    duracao: { tipo: 'continuo' },
    obs: '',
    foto: null,
  };
}

export function valorDaDuracao(duracao) {
  if (!duracao) return null;
  if (duracao.tipo === 'dias') return `d${duracao.dias}`;
  return duracao.tipo;
}

// Valida um item antes de entrar na lista. `hoje` é 'AAAA-MM-DD'.
// Devolve { valido, erros } com uma mensagem por campo.
export function validarItem(f, hoje) {
  const erros = {};
  const nome = (f.nome ?? '').trim();
  const concentracao = (f.concentracao ?? '').trim();

  if (!nome) erros.nome = 'Escreva o nome como está na receita.';
  else if (nome.length > LIMITES.nome) erros.nome = `Use no máximo ${LIMITES.nome} caracteres.`;

  if (!concentracao) erros.concentracao = 'Informe a concentração, por exemplo 50 mg.';
  else if (concentracao.length > LIMITES.concentracao) erros.concentracao = `Use no máximo ${LIMITES.concentracao} caracteres.`;

  if (!Number.isInteger(f.qtd) || f.qtd < QTD_MIN || f.qtd > QTD_MAX) {
    erros.qtd = `A quantidade vai de ${QTD_MIN} a ${QTD_MAX}.`;
  }
  if (!UNIDADES.some((u) => u.valor === f.unidade)) erros.unidade = 'Escolha a unidade.';
  if (!VIAS.some((v) => v.valor === f.via)) erros.via = 'Escolha como tomar.';

  const horarios = f.horarios ?? [];
  if (horarios.length === 0) erros.horarios = 'Escolha pelo menos um horário.';
  else if (!horarios.every(horaValida)) erros.horarios = 'Há um horário inválido.';

  const d = f.duracao;
  if (!d || !['continuo', 'dias', 'ate'].includes(d.tipo)) {
    erros.duracao = 'Escolha por quanto tempo, ou uso contínuo.';
  } else if (d.tipo === 'dias' && !(Number.isInteger(d.dias) && d.dias >= 1 && d.dias <= 365)) {
    erros.duracao = 'Escolha a quantidade de dias.';
  } else if (d.tipo === 'ate') {
    if (!dataValida(d.fim)) erros.duracao = 'Informe o último dia do tratamento.';
    else if (d.fim < hoje) erros.duracao = 'Essa data já passou. Escolha hoje ou um dia depois.';
  }

  if ((f.obs ?? '').trim().length > LIMITES.obs) erros.obs = `Use no máximo ${LIMITES.obs} caracteres.`;

  return { valido: Object.keys(erros).length === 0, erros };
}

// Copia só os campos conhecidos, já limpos. Chamar depois de validarItem.
export function normalizarItem(f, id) {
  return {
    id,
    nome: f.nome.trim(),
    concentracao: f.concentracao.trim(),
    qtd: f.qtd,
    unidade: f.unidade,
    via: f.via,
    horarios: [...new Set(f.horarios)].sort(),
    duracao: f.duracao.tipo === 'dias'
      ? { tipo: 'dias', dias: f.duracao.dias }
      : f.duracao.tipo === 'ate'
        ? { tipo: 'ate', fim: f.duracao.fim }
        : { tipo: 'continuo' },
    obs: (f.obs ?? '').trim(),
    foto: typeof f.foto === 'string' && FOTO_VALIDA.test(f.foto) ? f.foto : null,
  };
}

// ---------- Textos (mesmas regras do protótipo) ----------

const unidade = (valor) => UNIDADES.find((u) => u.valor === valor) ?? UNIDADES[0];
const via = (valor) => VIAS.find((v) => v.valor === valor) ?? VIAS[0];

export function tituloItem(item) {
  return `${item.nome} ${item.concentracao}`;
}

export function textoQuantidade(item) {
  const u = unidade(item.unidade);
  return `${item.qtd} ${item.qtd > 1 ? u.plural : u.singular}`;
}

export function textoVia(item) {
  return via(item.via).texto;
}

export function textoHorarios(horarios) {
  const lista = [...horarios].sort();
  if (lista.length === 0) return '';
  if (lista.length === 1) return `às ${lista[0]}`;
  return `às ${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

export function linhaDose(item) {
  return `${textoQuantidade(item)}, ${textoVia(item)}`;
}

export function linhaPosologia(item) {
  return `${linhaDose(item)}, ${textoHorarios(item.horarios)}`;
}

export function textoDuracao(item) {
  const d = item.duracao;
  if (d.tipo === 'dias') return item.fim ? `Por ${d.dias} dias, até ${dataBR(item.fim)}` : `Por ${d.dias} dias`;
  if (d.tipo === 'ate') return `Até ${dataBR(d.fim)}`;
  return 'Uso contínuo';
}

export function linhaDuracao(item) {
  return item.obs ? `${textoDuracao(item)} · ${item.obs}` : textoDuracao(item);
}

export function resumoLembretes(itens) {
  const horarios = [...new Set(itens.flatMap((i) => i.horarios))].sort();
  const porDia = itens.reduce((n, i) => n + i.horarios.length, 0);
  return { porDia, horarios };
}

export function textoLembretes(itens) {
  const { porDia, horarios } = resumoLembretes(itens);
  if (porDia === 0) return '';
  const inicio = porDia === 1 ? 'Será 1 lembrete por dia' : `Serão ${porDia} lembretes por dia`;
  return `${inicio}, ${textoHorarios(horarios)}.`;
}

// ---------- Ciclo do plano (RN01) ----------

export function planoVazio() {
  return { confirmado: null, rascunho: null, encerrados: [] };
}

export function temPlanoConfirmado(plano) {
  return Boolean(plano && plano.confirmado);
}

export function itensConfirmados(plano) {
  return plano?.confirmado?.itens ?? [];
}

// O que aparece na edição: o rascunho, se houver; senão, o plano confirmado.
export function itensEmEdicao(plano) {
  return plano.rascunho ?? itensConfirmados(plano);
}

function mesmosIds(a, b) {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((i) => i.id));
  return b.every((i) => ids.has(i.id));
}

export function temAlteracaoPendente(plano) {
  return temPlanoConfirmado(plano)
    && plano.rascunho !== null
    && !mesmosIds(plano.rascunho, itensConfirmados(plano));
}

export function podeRevisar(plano) {
  if (temPlanoConfirmado(plano)) return temAlteracaoPendente(plano);
  return (plano.rascunho?.length ?? 0) > 0;
}

// Se o rascunho voltou a ser igual ao confirmado, não há alteração pendente.
function comRascunho(plano, rascunho) {
  if (temPlanoConfirmado(plano) && mesmosIds(rascunho, itensConfirmados(plano))) {
    return { ...plano, rascunho: null };
  }
  return { ...plano, rascunho };
}

export function comItemAdicionado(plano, item) {
  return comRascunho(plano, [...itensEmEdicao(plano), item]);
}

export function comItemRemovido(plano, id) {
  return comRascunho(plano, itensEmEdicao(plano).filter((i) => i.id !== id));
}

export function comItemReinserido(plano, item, posicao) {
  const lista = itensEmEdicao(plano).filter((i) => i.id !== item.id);
  lista.splice(Math.max(0, Math.min(posicao, lista.length)), 0, item);
  return comRascunho(plano, lista);
}

export function semAlteracao(plano) {
  return { ...plano, rascunho: temPlanoConfirmado(plano) ? null : plano.rascunho };
}

// Para a revisão (P02) e para "Meu plano" (P07).
export function compararAlteracao(plano) {
  const confirmados = itensConfirmados(plano);
  const idsConfirmados = new Set(confirmados.map((i) => i.id));
  const edicao = itensEmEdicao(plano);
  const idsEdicao = new Set(edicao.map((i) => i.id));
  return {
    itens: edicao.map((item) => ({ item, novo: temPlanoConfirmado(plano) && !idsConfirmados.has(item.id) })),
    removidos: confirmados.filter((i) => !idsEdicao.has(i.id)),
  };
}

export function fimDoItem(duracao, inicio) {
  if (duracao.tipo === 'dias') return somarDias(inicio, duracao.dias - 1);
  if (duracao.tipo === 'ate') return duracao.fim;
  return null;
}

// Aplica a revisão: o rascunho vira o plano confirmado a partir de `agora`.
// Itens que já estavam no plano mantêm a vigência original.
// Itens que saíram vão para `encerrados`, para o histórico do painel.
export function confirmarPlano(plano, agora) {
  if (!podeRevisar(plano)) throw new Error('nada_a_confirmar');
  const instante = agora.toISOString();
  const hoje = dataISO(agora);
  const anteriores = new Map(itensConfirmados(plano).map((i) => [i.id, i]));

  const itens = plano.rascunho.map((i) => anteriores.get(i.id) ?? {
    ...i,
    vigenteDesde: instante,
    inicio: hoje,
    fim: fimDoItem(i.duracao, hoje),
  });

  const ficam = new Set(itens.map((i) => i.id));
  const saem = itensConfirmados(plano)
    .filter((i) => !ficam.has(i.id))
    .map((i) => ({ ...i, encerradoEm: instante }));

  return {
    confirmado: { itens, confirmadoEm: instante },
    rascunho: null,
    encerrados: [...(plano.encerrados ?? []), ...saem],
  };
}
