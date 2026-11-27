// Adaptador da API real. Nenhuma senha, dose ou sessão é salva no localStorage.
// As telas chamam as mesmas funções do api-mock.js; aqui elas viram chamadas ao servidor
// e as respostas são traduzidas para o formato de js/dominio/plano.js.
import { ErroApi } from './erros.js';
import * as P from '../dominio/plano.js';
import { relogio } from '../relogio.js';
import { configurarFuso, dataISO, somarDias } from '../dominio/tempo.js';

export const modoReal = true;

// Estado do plano no servidor, guardado só na memória:
// - confirmado: o plano CONFIRMADO do paciente, ou null;
// - edicao: o plano em EM_EDICAO ou EM_REVISAO, ou null. Sem plano confirmado, é o primeiro
//   cadastro; com plano confirmado, é a alteração pendente (UC-04);
// - anteriores: versões ENCERRADAS do plano, por id. Não mudam mais, então ficam guardadas.
const servidor = { confirmado: null, edicao: null, anteriores: new Map() };
let planoTraduzido = null;

function esquecerPlano() {
  servidor.confirmado = null;
  servidor.edicao = null;
  servidor.anteriores.clear();
  planoTraduzido = null;
}

// ---------- Requisições ----------

export async function requisitar(url, opcoes = {}) {
  let r;
  // Desiste depois de 20 s, para a tela não ficar presa esperando.
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 20000);
  try {
    // credentials same-origin: manda o cookie da sessão. no-store: nunca usa resposta guardada.
    r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opcoes,
      headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...opcoes.headers },
      signal: controlador.signal });
  } catch {
    throw new ErroApi('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.', { status: 0 });
  } finally { clearTimeout(limite); }
  // 204 não tem corpo. Erro do servidor vem como { mensagem, camposInvalidos } (ErroResposta).
  const dados = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ErroApi(dados?.mensagem ?? 'Não foi possível concluir a operação.',
    { status: r.status, camposInvalidos: dados?.camposInvalidos ?? {} });
  return dados;
}

const post = (url, dados) => requisitar(url, { method: 'POST', ...(dados ? { body: JSON.stringify(dados) } : {}) });

// GET que devolve null quando o servidor responde 404 (ex.: "ainda não há plano confirmado").
async function buscarOuNulo(url) {
  try {
    return await requisitar(url);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

// ---------- Conta e sessão ----------

export async function sessao() {
  try {
    const r = await requisitar('/sessao');
    configurarFuso(r.fuso);
    relogio.sincronizar(r.agora);
    return r.conta;
  } catch (e) {
    if (e.status === 401) { esquecerPlano(); return null; }
    throw e;
  }
}

export async function criarConta(dados) { const conta = await post('/contas', dados); await sessao(); return conta; }
export async function entrar(dados) { const conta = await post('/login', dados); await sessao(); return conta; }
export async function sair() {
  // Uma inscrição de push deve parar de receber dados desta conta ao sair.
  if ('serviceWorker' in navigator) {
    const registro = await navigator.serviceWorker.getRegistration();
    const inscricao = await registro?.pushManager?.getSubscription();
    if (inscricao) {
      await requisitar('/push/inscricoes', { method: 'DELETE', body: JSON.stringify({ endpoint: inscricao.endpoint }) });
      await inscricao.unsubscribe();
    }
  }
  await post('/logout');
  esquecerPlano();
}

// ---------- Tradução entre o servidor e as telas ----------

// "50 mg · 2 cápsulas" → concentração "50 mg", quantidade 2, unidade "capsula".
// O servidor guarda tudo junto no campo dosagem (decisão do grupo, 22/11/2026).
function lerDosagem(dosagem) {
  const [concentracao, quantidade = '1 comprimido'] = dosagem.split('·').map((s) => s.trim());
  const qtd = Number.parseInt(quantidade, 10) || 1;
  let unidade = 'comprimido';
  if (/c[áa]psula/i.test(quantidade)) unidade = 'capsula';
  else if (/gota/i.test(quantidade)) unidade = 'gota';
  else if (/ml/i.test(quantidade)) unidade = 'ml';
  return { concentracao, qtd, unidade };
}

// "uso contínuo", "7 dias" ou "até 30/11/2026" → { tipo, dias | fim }.
function lerDuracao(texto) {
  // Sem acentos e em minúsculas para comparar ("até" vira "ate").
  const t = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/^\d+ dias?$/.test(t)) return { tipo: 'dias', dias: Number.parseInt(t, 10) };
  if (t.startsWith('ate ')) {
    const data = t.slice(4);
    // Aceita "30/11/2026" e "2026-11-30".
    const fim = data.includes('/') ? data.split('/').reverse().join('-') : data;
    return { tipo: 'ate', fim };
  }
  return { tipo: 'continuo' };
}

// O caminho inverso, para enviar ao servidor.
function textoDaDuracao(duracao) {
  if (duracao.tipo === 'dias') return `${duracao.dias} dias`;
  if (duracao.tipo === 'ate') return `até ${duracao.fim.split('-').reverse().join('/')}`;
  return 'uso contínuo';
}

// Converte um item do servidor para o formato das telas. `plano` é a versão a que ele pertence.
// Na alteração (`naEdicao`), a cópia de um item usa o id do item original (itemOrigemId):
// assim as telas reconhecem o mesmo remédio no plano confirmado e na alteração.
// O id que o servidor conhece fica sempre em idServidor.
export function traduzirItem(i, plano, { naEdicao = false } = {}) {
  const { concentracao, qtd, unidade } = lerDosagem(i.dosagem);
  const duracao = lerDuracao(i.duracaoTratamento);
  // A duração conta do início do tratamento do item; a cópia mantém a data do original.
  const inicio = i.inicioTratamento ?? plano.dataInicio ?? dataISO(relogio.agora());
  return {
    id: naEdicao ? (i.itemOrigemId ?? i.id) : i.id,
    idServidor: i.id,
    nome: i.nomeMedicamento,
    concentracao,
    qtd,
    unidade,
    via: i.viaAdministracao || 'oral',
    horarios: i.horarios.map((h) => h.slice(0, 5)),
    duracao,
    obs: '',
    foto: null,
    inicio,
    fim: P.fimDoItem(duracao, inicio),
    vigenteDesde: plano.confirmadoEm ?? `${inicio}T00:00:00Z`,
  };
}

// O servidor com o UC-04 manda o campo planoAnteriorId (mesmo que null) em todo plano.
// Servidor antigo, sem esse campo: o plano confirmado fica só para leitura.
function suportaAlteracao(plano) {
  return Boolean(plano) && Object.hasOwn(plano, 'planoAnteriorId');
}

// Itens das versões anteriores do plano, para o histórico (painel e doses antigas).
// Cada versão vale até a confirmação da seguinte, que vira o encerradoEm dos itens dela.
function itensDasVersoesAnteriores() {
  const itens = [];
  const vistos = new Set();
  let sucessor = servidor.confirmado;
  let anterior = sucessor && servidor.anteriores.get(sucessor.planoAnteriorId);
  while (anterior && !vistos.has(anterior.id)) {
    vistos.add(anterior.id);
    for (const i of anterior.itens) {
      itens.push({ ...traduzirItem(i, anterior), encerradoEm: sucessor.confirmadoEm });
    }
    sucessor = anterior;
    anterior = servidor.anteriores.get(anterior.planoAnteriorId);
  }
  return itens;
}

// Monta o plano no formato das telas: confirmado, rascunho (cadastro ou alteração) e encerrados.
function traduzirPlano() {
  const { confirmado, edicao } = servidor;
  return {
    confirmado: confirmado
      ? { itens: confirmado.itens.map((i) => traduzirItem(i, confirmado)), confirmadoEm: confirmado.confirmadoEm }
      : null,
    rascunho: edicao ? edicao.itens.map((i) => traduzirItem(i, edicao, { naEdicao: true })) : null,
    encerrados: itensDasVersoesAnteriores(),
    somenteLeitura: Boolean(confirmado) && !suportaAlteracao(confirmado),
  };
}

// ---------- Plano (UC-01, UC-08 e UC-04) ----------

// Busca as versões anteriores seguindo planoAnteriorId. As já buscadas não são pedidas de novo.
async function buscarVersoesAnteriores() {
  const vistos = new Set();
  let id = servidor.confirmado?.planoAnteriorId;
  while (id && !vistos.has(id)) {
    vistos.add(id);
    if (!servidor.anteriores.has(id)) servidor.anteriores.set(id, await requisitar(`/planos/${id}`));
    id = servidor.anteriores.get(id).planoAnteriorId;
  }
}

export async function obterPlano() {
  servidor.confirmado = await buscarOuNulo('/planos/atual');
  servidor.edicao = null;

  if (!servidor.confirmado) {
    // Primeiro cadastro: retoma o rascunho ou cria um novo.
    servidor.edicao = (await buscarOuNulo('/planos/rascunho')) ?? (await post('/planos'));
  } else if (suportaAlteracao(servidor.confirmado)) {
    // Com plano confirmado, o rascunho que existir é a alteração pendente dele (UC-04).
    const rascunho = await buscarOuNulo('/planos/rascunho');
    if (rascunho?.planoAnteriorId === servidor.confirmado.id) servidor.edicao = rascunho;
    await buscarVersoesAnteriores();
  }

  planoTraduzido = traduzirPlano();
  return planoTraduzido;
}

// Garante uma versão em EM_EDICAO antes de mudar um item.
async function exigirEdicao() {
  if (!servidor.confirmado && !servidor.edicao) await obterPlano();

  if (!servidor.edicao) {
    // Plano confirmado sem alteração aberta: abre uma (UC-04). O confirmado continua valendo.
    if (!suportaAlteracao(servidor.confirmado)) {
      throw new ErroApi('Este servidor ainda não permite alterar o plano confirmado.', { status: 409 });
    }
    servidor.edicao = await post(`/planos/${servidor.confirmado.id}/alteracao`);
  } else if (servidor.edicao.situacao === 'EM_REVISAO') {
    // Voltou da revisão: o servidor só aceita mudanças em EM_EDICAO (UC-08 A1).
    servidor.edicao = await post(`/planos/${servidor.edicao.id}/editar`);
  }
}

// Chamada ao abrir o P01. Não abre alteração só por abrir a tela: isso fica para a primeira mudança.
export async function editarPlano() {
  if (!servidor.confirmado && !servidor.edicao) await obterPlano();
  if (servidor.edicao?.situacao === 'EM_REVISAO') {
    servidor.edicao = await post(`/planos/${servidor.edicao.id}/editar`);
  }
}

// Chamada ao abrir o P02. A revisão obrigatória é garantida pelo servidor (RN01, ADR-09).
export async function revisarPlano() {
  if (!servidor.confirmado && !servidor.edicao) await obterPlano();
  if (servidor.edicao?.situacao === 'EM_EDICAO') {
    servidor.edicao = await post(`/planos/${servidor.edicao.id}/revisar`);
  }
}

export async function confirmarPlano() {
  if (!servidor.edicao) throw new ErroApi('Não há alteração para confirmar.', { status: 409 });
  await post(`/planos/${servidor.edicao.id}/confirmar`);
  // Na alteração, a confirmação também encerra a versão anterior. Relê tudo do servidor.
  await obterPlano();
  // A consulta também gera imediatamente a janela inicial de doses.
  await listarDoses();
  return planoTraduzido;
}

export async function adicionarItem(f) {
  // Mesmas validações do mock, mais o limite do campo dosagem do servidor.
  const { valido, erros } = P.validarItem(f, dataISO(relogio.agora()));
  const dosagem = `${f.concentracao?.trim()} · ${P.textoQuantidade(f)}`;
  if (dosagem.length > 60) erros.concentracao = 'Concentração e quantidade juntas devem ter até 60 caracteres.';
  if (f.obs?.trim()) erros.obs = 'O servidor ainda não guarda observações.';
  if (!valido || Object.keys(erros).length) throw new ErroApi('Dados inválidos.', { camposInvalidos: erros });

  await exigirEdicao();
  servidor.edicao = await post(`/planos/${servidor.edicao.id}/itens`, {
    nomeMedicamento: f.nome.trim(),
    dosagem,
    viaAdministracao: f.via,
    frequencia: `${f.horarios.length} vezes ao dia`,
    duracaoTratamento: textoDaDuracao(f.duracao),
    horarios: [...new Set(f.horarios)].sort(),
  });
  planoTraduzido = traduzirPlano();
  // O servidor põe o item novo no fim da lista.
  return planoTraduzido.rascunho.at(-1);
}

export async function removerItem(id) {
  await exigirEdicao();
  // `id` é o id que as telas conhecem; na alteração, o da cópia é outro (idServidor).
  const itens = servidor.edicao.itens.map((i) => traduzirItem(i, servidor.edicao, { naEdicao: true }));
  const posicao = itens.findIndex((i) => i.id === id);
  if (posicao < 0) throw new ErroApi('Este remédio não está mais na lista.', { status: 404 });

  const item = itens[posicao];
  servidor.edicao = await requisitar(`/planos/${servidor.edicao.id}/itens/${item.idServidor}`, { method: 'DELETE' });
  planoTraduzido = traduzirPlano();
  return { item, posicao };
}

// "Desfazer" depois de remover um item.
export async function reinserirItem(item) {
  const { confirmado, edicao } = servidor;

  // Na alteração, se tirar um remédio do plano confirmado foi a única mudança, cancelar a
  // alteração devolve o plano exatamente como estava (o servidor não recria a ligação da
  // cópia com o item original, então reinserir faria o remédio parecer novo).
  if (confirmado && edicao) {
    const idsConfirmados = new Set(confirmado.itens.map((i) => i.id));
    const idsNaEdicao = edicao.itens.map((i) => i.itemOrigemId ?? i.id);
    const soFaltavaEste = idsConfirmados.has(item.id)
      && idsNaEdicao.length + 1 === idsConfirmados.size
      && idsNaEdicao.every((idItem) => idsConfirmados.has(idItem));
    if (soFaltavaEste) {
      await descartarAlteracao();
      return item;
    }
  }

  // Nos outros casos, o remédio volta como item novo, no fim da lista.
  return adicionarItem(item);
}

// Desiste do cadastro ou da alteração (UC-04 A3). Na alteração, o plano confirmado segue valendo.
export async function descartarAlteracao() {
  if (!servidor.edicao) return;
  await requisitar(`/planos/${servidor.edicao.id}`, { method: 'DELETE' });
  servidor.edicao = null;
  planoTraduzido = traduzirPlano();
}

// ---------- Doses e registros (UC-02, UC-03) ----------

// Do início do plano mais antigo até hoje, para o painel ter todo o histórico.
function intervaloPadrao() {
  const hoje = dataISO(relogio.agora());
  const inicios = [servidor.confirmado, servidor.edicao, ...servidor.anteriores.values()]
    .map((p) => p?.dataInicio)
    .filter(Boolean)
    .sort();
  return { de: inicios[0] ?? somarDias(hoje, -1), ate: hoje };
}

export async function listarRegistros(de, ate) {
  const padrao = intervaloPadrao();
  return requisitar(`/registros?de=${de ?? padrao.de}&ate=${ate ?? padrao.ate}`);
}

// Se a dose for de um item que o front não conhece (não deveria acontecer), mostra um nome
// genérico em vez de quebrar a tela.
function itemDesconhecido(dose) {
  return {
    id: dose.itemId, idServidor: dose.itemId, nome: 'Remédio', concentracao: '', qtd: 1, unidade: 'comprimido',
    via: 'oral', horarios: [dose.hora.slice(0, 5)], duracao: { tipo: 'continuo' }, obs: '', foto: null,
  };
}

export async function listarDoses(de, ate) {
  const hoje = dataISO(relogio.agora());
  const lista = await requisitar(`/doses?de=${de ?? somarDias(hoje, -1)}&ate=${ate ?? hoje}`);

  // A dose aponta para o item pelo id do servidor. Depois de uma alteração, as doses antigas
  // (e a pendente que ainda estava na janela) apontam para itens da versão anterior.
  const itensPorId = new Map();
  for (const item of [...P.itensConfirmados(planoTraduzido), ...(planoTraduzido?.encerrados ?? [])]) {
    itensPorId.set(item.id, item);
  }

  return lista.map((d) => {
    const fimJanela = new Date(d.fimJanela);
    return {
      ...d,
      hora: d.hora.slice(0, 5),
      item: itensPorId.get(d.itemId) ?? itemDesconhecido(d),
      t: new Date(d.t),
      fimJanela,
      // Último minuto aceito: a janela fecha no início do minuto seguinte (QS-02).
      registrarAte: new Date(fimJanela - 60000),
      registradoEm: d.registro ? new Date(d.registro.em) : null,
    };
  });
}

export async function registrarDose(id, status) {
  return requisitar(`/registros/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status }) });
}
export async function desfazerRegistro(id) { return requisitar(`/registros/${encodeURIComponent(id)}`, { method: 'DELETE' }); }

// ---------- Push (UC-07) ----------

export async function chavePush() { return requisitar('/push/chave'); }
export async function situacaoPush() { return requisitar('/push/situacao'); }
export async function inscreverPush(inscricao) { return post('/push/inscricoes', inscricao); }
export async function enviarLembreteTeste() { return post('/push/teste'); }

export async function carregarDemonstracao() {
  throw new ErroApi('Os dados de demonstração estão disponíveis em ?mock=1&demo=1.');
}
