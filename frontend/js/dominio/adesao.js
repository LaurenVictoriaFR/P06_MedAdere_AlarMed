// Taxa de adesão e agregados do calendário (RF005, UC-03).
// Taxa = tomadas ÷ (tomadas + não tomadas). Pendentes e programadas ficam fora.
// Sem doses resolvidas, a taxa é null e aparece como "—".
// Há duas taxas: a do mês do calendário e a atual, desde o início do plano.

import { dosesDoDia, estadoDaDose, ESTADOS } from './doses.js';
import { dataISO, diasNoMes, doisDigitos, mesISO, somarDias, somarMeses } from './tempo.js';

export function dosesComEstado(itens, registros, data, agora) {
  return dosesDoDia(itens, data).map((dose) => {
    const registro = registros[dose.id] ?? null;
    return { ...dose, registro, ...estadoDaDose(dose, registro, agora) };
  });
}

// Agregado do dia:
//  sem_doses    nenhum remédio previsto no dia
//  em_andamento ainda há dose pendente ou programada
//  todas | parte | nenhuma  conforme as tomadas entre as resolvidas
export function resumirDia(doses) {
  const r = { total: doses.length, tomadas: 0, naoTomadas: 0, pendentes: 0, programadas: 0 };
  for (const d of doses) {
    if (d.estado === ESTADOS.TOMADA) r.tomadas += 1;
    else if (d.estado === ESTADOS.NAO_TOMADA) r.naoTomadas += 1;
    else if (d.estado === ESTADOS.PENDENTE) r.pendentes += 1;
    else r.programadas += 1;
  }
  const resolvidas = r.tomadas + r.naoTomadas;
  if (r.total === 0) r.agregado = 'sem_doses';
  else if (r.pendentes + r.programadas > 0) r.agregado = 'em_andamento';
  else if (r.tomadas === resolvidas) r.agregado = 'todas';
  else if (r.tomadas === 0) r.agregado = 'nenhuma';
  else r.agregado = 'parte';
  return r;
}

export function calcularTaxa(doses) {
  let tomadas = 0;
  let naoTomadas = 0;
  for (const d of doses) {
    if (d.estado === ESTADOS.TOMADA) tomadas += 1;
    else if (d.estado === ESTADOS.NAO_TOMADA) naoTomadas += 1;
  }
  const resolvidas = tomadas + naoTomadas;
  return { tomadas, naoTomadas, resolvidas, taxa: resolvidas ? tomadas / resolvidas : null };
}

export function textoTaxa(taxa) {
  return taxa === null ? '—' : `${Math.round(taxa * 100)}%`;
}

// mes: 'AAAA-MM'
export function calcularMes(itens, registros, mes, agora) {
  const [ano, m] = mes.split('-').map(Number);
  const hoje = dataISO(agora);
  const dias = [];
  const todas = [];
  for (let d = 1; d <= diasNoMes(ano, m); d += 1) {
    const data = `${ano}-${doisDigitos(m)}-${doisDigitos(d)}`;
    const doses = dosesComEstado(itens, registros, data, agora);
    const resumo = resumirDia(doses);
    dias.push({ data, dia: d, hoje: data === hoje, futuro: data > hoje, doses, resumo });
    todas.push(...doses);
  }
  const contagem = { todas: 0, parte: 0, nenhuma: 0 };
  for (const dia of dias) {
    if (dia.resumo.agregado in contagem) contagem[dia.resumo.agregado] += 1;
  }
  return {
    mes,
    dias,
    ...calcularTaxa(todas),
    contagem,
    primeiroDiaDaSemana: new Date(ano, m - 1, 1).getDay(), // 0 = domingo
  };
}

// O mesmo remédio vira outro item quando o plano é alterado. Por isso, para a
// taxa por medicamento, a chave é o nome com a concentração, e não o id do item.
export function chaveDoMedicamento(item) {
  return `${item.nome} ${item.concentracao}`.trim().toLocaleLowerCase('pt-BR');
}

// Medicamentos do plano e do histórico, sem repetir, em ordem alfabética.
export function medicamentosDoPlano(itens) {
  const porChave = new Map();
  for (const item of itens) {
    const chave = chaveDoMedicamento(item);
    if (!porChave.has(chave)) porChave.set(chave, item);
  }
  return [...porChave].map(([chave, item]) => ({ chave, item }))
    .sort((a, b) => a.item.nome.localeCompare(b.item.nome, 'pt-BR'));
}

// Taxa de adesão atual (UC-03 A3 e A4): doses tomadas ÷ doses passadas, do início
// do plano até agora. Dose passada é a tomada ou a não tomada. Com `chave`, conta
// só um medicamento; sem ela, é a taxa geral. Trocar o mês do calendário não muda
// esta taxa (UC-03 A1).
export function calcularTaxaAtual(itens, registros, agora, chave = null) {
  const escolhidos = chave === null ? itens : itens.filter((i) => chaveDoMedicamento(i) === chave);
  const inicios = escolhidos.map((i) => i.inicio).filter(Boolean).sort();
  const doses = [];
  const hoje = dataISO(agora);
  for (let data = inicios[0]; data && data <= hoje; data = somarDias(data, 1)) {
    doses.push(...dosesComEstado(escolhidos, registros, data, agora));
  }
  return calcularTaxa(doses);
}

// Meses com plano: do mês da primeira vigência até o mês atual (RF005 CA02).
export function mesesDisponiveis(itens, agora) {
  const atual = mesISO(agora);
  const inicios = itens.map((i) => i.inicio).filter(Boolean).sort();
  const primeiro = inicios.length ? inicios[0].slice(0, 7) : atual;
  const meses = [];
  for (let mes = primeiro; mes <= atual; mes = somarMeses(mes, 1)) meses.push(mes);
  return meses;
}
