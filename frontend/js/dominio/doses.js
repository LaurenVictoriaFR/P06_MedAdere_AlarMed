// Doses e seus estados (regra da dose aprovada pelo grupo; RN02, RF004).
//
// Programada: antes do horário T.
// Pendente:   de T até o fim da janela.
// Fim da janela: o que vier primeiro entre T + 120 min e a próxima dose do mesmo medicamento.
// Tomada / Não tomada: registradas pelo usuário dentro da janela. O registro é final.
// Sem registro até o fim da janela: Não tomada (automática).
// A dose pertence ao dia de T, mesmo que seja resolvida depois da meia-noite.

import { deDataHora, somarDias, somarMinutos } from './tempo.js';

export const JANELA_MINUTOS = 120;

export const ESTADOS = Object.freeze({
  PROGRAMADA: 'programada',
  PENDENTE: 'pendente',
  TOMADA: 'tomada',
  NAO_TOMADA: 'nao_tomada',
});

export const STATUS_REGISTRAVEIS = [ESTADOS.TOMADA, ESTADOS.NAO_TOMADA];

// Itens atuais e os que já saíram do plano (o histórico precisa dos dois).
export function todosOsItens(plano) {
  return [...(plano?.confirmado?.itens ?? []), ...(plano?.encerrados ?? [])];
}

export function idDose(itemId, data, hora) {
  return `${itemId}@${data}T${hora}`;
}

export function lerIdDose(id) {
  const m = /^(.+)@(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(id ?? '');
  return m ? { itemId: m[1], data: m[2], hora: m[3] } : null;
}

function ativoNoDia(item, data) {
  return data >= item.inicio && (!item.fim || data <= item.fim);
}

function dentroDaVigencia(item, instante) {
  if (instante < new Date(item.vigenteDesde)) return false;
  if (item.encerradoEm && instante >= new Date(item.encerradoEm)) return false;
  return true;
}

function existeDose(item, data, hora) {
  return item.horarios.includes(hora)
    && ativoNoDia(item, data)
    && dentroDaVigencia(item, deDataHora(data, hora));
}

function montarDose(item, data, hora) {
  return { id: idDose(item.id, data, hora), itemId: item.id, item, data, hora, t: deDataHora(data, hora) };
}

export function dosesDoDia(itens, data) {
  const doses = [];
  for (const item of itens) {
    for (const hora of item.horarios) {
      if (existeDose(item, data, hora)) doses.push(montarDose(item, data, hora));
    }
  }
  return doses.sort((a, b) => a.t - b.t || a.item.nome.localeCompare(b.item.nome, 'pt-BR'));
}

// Próxima dose do mesmo item depois desta (hoje ou amanhã).
// Mais longe que isso nunca encurta a janela de 2 horas.
export function proximaDose(dose) {
  const horarios = [...dose.item.horarios].sort();
  for (let k = 0; k <= 1; k += 1) {
    const data = somarDias(dose.data, k);
    for (const hora of horarios) {
      if (k === 0 && hora <= dose.hora) continue;
      if (existeDose(dose.item, data, hora)) return deDataHora(data, hora);
    }
  }
  return null;
}

export function fimDaJanela(dose) {
  const limite = somarMinutos(dose.t, JANELA_MINUTOS);
  const proxima = proximaDose(dose);
  return proxima && proxima < limite ? proxima : limite;
}

export function estadoDaDose(dose, registro, agora) {
  const fimJanela = fimDaJanela(dose);
  if (registro) {
    return { estado: registro.status, automatica: false, registradoEm: new Date(registro.em), fimJanela };
  }
  if (agora < dose.t) return { estado: ESTADOS.PROGRAMADA, automatica: false, fimJanela };
  if (agora < fimJanela) return { estado: ESTADOS.PENDENTE, automatica: false, fimJanela };
  return { estado: ESTADOS.NAO_TOMADA, automatica: true, fimJanela };
}

export function podeRegistrar(dose, agora) {
  return agora >= dose.t && agora < fimDaJanela(dose);
}

// Corrigir e Desfazer só dentro da janela (RF004 E3).
export function podeCorrigir(dose, registro, agora) {
  return Boolean(registro) && agora < fimDaJanela(dose);
}

// Localiza a dose a partir do id e confere se ela existe no plano.
export function encontrarDose(itens, id) {
  const partes = lerIdDose(id);
  if (!partes) return null;
  const item = itens.find((i) => i.id === partes.itemId);
  if (!item || !existeDose(item, partes.data, partes.hora)) return null;
  return montarDose(item, partes.data, partes.hora);
}

// Mesma checagem que o backend deve fazer. Devolve o código do erro ou null.
export function motivoParaRecusarRegistro(dose, status, registroAtual, agora) {
  if (!dose) return 'dose_inexistente';
  if (!STATUS_REGISTRAVEIS.includes(status)) return 'status_invalido';
  if (registroAtual) return 'ja_registrada';
  if (agora < dose.t) return 'antes_do_horario';
  if (agora >= fimDaJanela(dose)) return 'prazo_encerrado';
  return null;
}
