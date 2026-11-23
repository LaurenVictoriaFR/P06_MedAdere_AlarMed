// Adaptador da API real. Nenhuma senha, dose ou sessão é salva no localStorage.
import { ErroApi } from './erros.js';
import * as P from '../dominio/plano.js';
import { relogio } from '../relogio.js';
import { configurarFuso, dataISO, somarDias } from '../dominio/tempo.js';

export const modoReal = true;
let planoServidor = null;
let planoTraduzido = null;

export async function requisitar(url, opcoes = {}) {
  let r;
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 20000);
  try {
    r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opcoes,
      headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...opcoes.headers },
      signal: controlador.signal });
  } catch {
    throw new ErroApi('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.', { status: 0 });
  } finally { clearTimeout(limite); }
  const dados = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ErroApi(dados?.mensagem ?? 'Não foi possível concluir a operação.',
    { status: r.status, camposInvalidos: dados?.camposInvalidos ?? {} });
  return dados;
}

const post = (url, dados) => requisitar(url, { method: 'POST', ...(dados ? { body: JSON.stringify(dados) } : {}) });

export async function sessao() {
  try {
    const r = await requisitar('/sessao');
    configurarFuso(r.fuso);
    relogio.sincronizar(r.agora);
    return r.conta;
  } catch (e) {
    if (e.status === 401) { planoServidor = null; planoTraduzido = null; return null; }
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
  planoServidor = null; planoTraduzido = null;
}

export function traduzirItem(i, plano) {
  const [concentracao, quantidade = '1 comprimido'] = i.dosagem.split('·').map(s => s.trim());
  const qtd = Number.parseInt(quantidade, 10) || 1;
  const unidade = /c[áa]psula/i.test(quantidade) ? 'capsula' : /gota/i.test(quantidade) ? 'gota'
    : /ml/i.test(quantidade) ? 'ml' : 'comprimido';
  const t = i.duracaoTratamento.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  let duracao = { tipo: 'continuo' };
  if (/^\d+ dias?$/.test(t)) duracao = { tipo: 'dias', dias: Number.parseInt(t, 10) };
  else if (t.startsWith('ate ')) {
    const v = t.slice(4);
    duracao = { tipo: 'ate', fim: v.includes('/') ? v.split('/').reverse().join('-') : v };
  }
  const inicio = plano.dataInicio;
  return { id: i.id, nome: i.nomeMedicamento, concentracao, qtd, unidade, via: i.viaAdministracao || 'oral',
    horarios: i.horarios.map(h => h.slice(0, 5)), duracao, obs: '', foto: null,
    inicio, fim: P.fimDoItem(duracao, inicio), vigenteDesde: plano.confirmadoEm ?? `${inicio}T00:00:00Z` };
}

function traduzirPlano(p) {
  const itens = p.itens.map(i => traduzirItem(i, p));
  const confirmado = p.situacao === 'CONFIRMADO';
  return { confirmado: confirmado ? { itens, confirmadoEm: p.confirmadoEm } : null,
    rascunho: confirmado ? null : itens, encerrados: [], somenteLeitura: confirmado };
}

export async function obterPlano() {
  try { planoServidor = await requisitar('/planos/atual'); }
  catch (e) {
    if (e.status !== 404) throw e;
    try { planoServidor = await requisitar('/planos/rascunho'); }
    catch (rascunhoErro) {
      if (rascunhoErro.status !== 404) throw rascunhoErro;
      planoServidor = await post('/planos');
    }
  }
  planoTraduzido = traduzirPlano(planoServidor);
  return planoTraduzido;
}

async function exigirEdicao() {
  if (!planoServidor) await obterPlano();
  if (planoServidor.situacao === 'CONFIRMADO')
    throw new ErroApi('A alteração de um plano confirmado será disponibilizada no P4.', { status: 409 });
  if (planoServidor.situacao === 'EM_REVISAO')
    planoServidor = await post(`/planos/${planoServidor.id}/editar`);
}

export async function editarPlano() { await exigirEdicao(); }
export async function revisarPlano() {
  if (!planoServidor) await obterPlano();
  if (planoServidor.situacao === 'EM_EDICAO') planoServidor = await post(`/planos/${planoServidor.id}/revisar`);
}
export async function confirmarPlano() {
  planoServidor = await post(`/planos/${planoServidor.id}/confirmar`);
  planoTraduzido = traduzirPlano(planoServidor);
  // A consulta também gera imediatamente a janela inicial de doses.
  await listarDoses();
  return planoTraduzido;
}

export async function adicionarItem(f) {
  const { valido, erros } = P.validarItem(f, dataISO(relogio.agora()));
  const dosagem = `${f.concentracao?.trim()} · ${P.textoQuantidade(f)}`;
  if (dosagem.length > 60) erros.concentracao = 'Concentração e quantidade juntas devem ter até 60 caracteres.';
  if (f.obs?.trim()) erros.obs = 'Observações da receita serão disponibilizadas no P4.';
  if (!valido || Object.keys(erros).length) throw new ErroApi('Dados inválidos.', { camposInvalidos: erros });
  await exigirEdicao();
  const duracao = f.duracao.tipo === 'dias' ? `${f.duracao.dias} dias`
    : f.duracao.tipo === 'ate' ? `até ${f.duracao.fim.split('-').reverse().join('/')}` : 'uso contínuo';
  planoServidor = await post(`/planos/${planoServidor.id}/itens`, { nomeMedicamento: f.nome.trim(), dosagem,
    viaAdministracao: f.via, frequencia: `${f.horarios.length} vezes ao dia`, duracaoTratamento: duracao,
    horarios: [...new Set(f.horarios)].sort() });
  planoTraduzido = traduzirPlano(planoServidor);
  return planoTraduzido.rascunho.at(-1);
}
export async function removerItem(id) {
  await exigirEdicao();
  const itens = planoServidor.itens.map(i => traduzirItem(i, planoServidor));
  const posicao = itens.findIndex(i => i.id === id);
  planoServidor = await requisitar(`/planos/${planoServidor.id}/itens/${id}`, { method: 'DELETE' });
  return { item: itens[posicao], posicao };
}
export async function reinserirItem(item) { return adicionarItem(item); }
export async function descartarAlteracao() {
  if (planoServidor?.situacao !== 'CONFIRMADO') {
    await requisitar(`/planos/${planoServidor.id}`, { method: 'DELETE' });
    planoServidor = null; planoTraduzido = null;
  }
}

function intervaloPadrao() {
  const hoje = dataISO(relogio.agora());
  return { de: planoServidor?.dataInicio ?? somarDias(hoje, -1), ate: hoje };
}
export async function listarRegistros(de, ate) {
  const padrao = intervaloPadrao();
  return requisitar(`/registros?de=${de ?? padrao.de}&ate=${ate ?? padrao.ate}`);
}
export async function listarDoses(de, ate) {
  const hoje = dataISO(relogio.agora());
  const lista = await requisitar(`/doses?de=${de ?? somarDias(hoje, -1)}&ate=${ate ?? hoje}`);
  const itens = P.itensConfirmados(planoTraduzido);
  return lista.map(d => ({ ...d, hora: d.hora.slice(0, 5), item: itens.find(i => i.id === d.itemId),
    t: new Date(d.t), fimJanela: new Date(d.fimJanela), registrarAte: new Date(new Date(d.fimJanela) - 60000),
    registradoEm: d.registro ? new Date(d.registro.em) : null }));
}
export async function registrarDose(id, status) {
  return requisitar(`/registros/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status }) });
}
export async function desfazerRegistro(id) { return requisitar(`/registros/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function chavePush() { return requisitar('/push/chave'); }
export async function situacaoPush() { return requisitar('/push/situacao'); }
export async function inscreverPush(inscricao) { return post('/push/inscricoes', inscricao); }
export async function enviarLembreteTeste() { return post('/push/teste'); }
export async function carregarDemonstracao() {
  throw new ErroApi('Os dados de demonstração estão disponíveis em ?mock=1&demo=1.');
}
