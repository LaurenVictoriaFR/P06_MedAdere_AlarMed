// Doses e seus estados (regra da dose aprovada pelo grupo; RN02, RF004).
//
// Programada: antes do horário T.
// Pendente:   de T até o fim da janela.
// Fim da janela: o que vier primeiro entre T + 120 min e a próxima dose do mesmo medicamento.
//   O limite de 2 h é inclusivo (cenário QS-02): com 120 min ainda dá para registrar; com 121, não.
// Tomada / Não tomada: registradas pelo usuário dentro da janela. Podem ser desfeitas dentro da janela.
// Sem registro até o fim da janela: Sem confirmação, sem declaração de consumo.
// A dose pertence ao dia de T, mesmo que seja resolvida depois da meia-noite.

import { deDataHora, somarDias, somarMinutos } from './tempo.js';

export const JANELA_MINUTOS = 120;

export const ESTADOS = Object.freeze({
  PROGRAMADA: 'programada',
  PENDENTE: 'pendente',
  TOMADA: 'tomada',
  NAO_TOMADA: 'nao_tomada',
  SEM_CONFIRMACAO: 'sem_confirmacao',
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

// Instante em que a janela fecha (a partir dele, não dá mais para registrar).
// O relógio da tela anda em minutos, então "120 min" vale até o fim do minuto 120:
// a janela fecha no início do minuto 121. A próxima dose do mesmo remédio fecha
// a janela no horário dela.
export function fimDaJanela(dose) {
  if (dose.fimJanela instanceof Date) return dose.fimJanela;
  const limite = somarMinutos(dose.t, JANELA_MINUTOS + 1);
  const proxima = proximaDose(dose);
  return proxima && proxima < limite ? proxima : limite;
}

// Último minuto em que ainda dá para registrar, para mostrar na tela ("Registre até as 10:00").
export function registrarAte(dose) {
  return somarMinutos(fimDaJanela(dose), -1);
}

export function estadoDaDose(dose, registro, agora) {
  const fimJanela = fimDaJanela(dose);
  const ate = registrarAte(dose);
  if (registro?.automatica) {
    return { estado: ESTADOS.SEM_CONFIRMACAO, automatica: true, registradoEm: null, fimJanela, registrarAte: ate };
  }
  if (registro) {
    return { estado: registro.status, automatica: Boolean(registro.automatica), registradoEm: new Date(registro.em), fimJanela, registrarAte: ate };
  }
  if (agora < dose.t) return { estado: ESTADOS.PROGRAMADA, automatica: false, fimJanela, registrarAte: ate };
  if (agora < fimJanela) return { estado: ESTADOS.PENDENTE, automatica: false, fimJanela, registrarAte: ate };
  return { estado: ESTADOS.SEM_CONFIRMACAO, automatica: true, fimJanela, registrarAte: ate };
}

export function podeRegistrar(dose, agora) {
  return agora >= dose.t && agora < fimDaJanela(dose);
}

// Corrigir e Desfazer só dentro da janela (RF004 E3).
export function podeCorrigir(dose, registro, agora) {
  return Boolean(registro) && !registro.automatica && agora >= dose.t && agora < fimDaJanela(dose);
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
