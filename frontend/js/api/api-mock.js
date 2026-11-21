// Implementação SIMULADA da API, guardada no localStorage deste navegador.
// Serve para fazer e testar as telas enquanto o backend não existe.
//
// ATENÇÃO: a senha fica em texto puro, sem hash nem bloqueio de tentativas.
// O RNF004 foi adiado por decisão registrada em ADR. Use só dados fictícios.
//
// Todas as funções são assíncronas, como serão as chamadas HTTP de verdade.

import { relogio } from '../relogio.js';
import * as P from '../dominio/plano.js';
import * as D from '../dominio/doses.js';
import { dataISO, deDataHora, somarDias, somarMinutos } from '../dominio/tempo.js';
import { ErroApi, MENSAGENS } from './erros.js';

const CHAVE = 'alarmed:v1';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let emMemoria = null; // usado quando o navegador bloqueia o localStorage

function bancoVazio() {
  return { versao: 1, usuarios: [], sessao: null, dados: {} };
}

function ler() {
  try {
    const texto = localStorage.getItem(CHAVE);
    if (texto) return JSON.parse(texto);
  } catch {
    // sem acesso ao armazenamento: segue com a cópia em memória
  }
  return emMemoria ? structuredClone(emMemoria) : bancoVazio();
}

function gravar(db) {
  emMemoria = structuredClone(db);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') throw new ErroApi('armazenamento_cheio', MENSAGENS.armazenamento_cheio);
  }
}

function erro(codigo, campos = null) {
  return new ErroApi(codigo, MENSAGENS[codigo] ?? codigo, campos);
}

function gerarId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function publico(u) {
  return u ? { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, nomePaciente: u.nomePaciente ?? null } : null;
}

function usuarioDaSessao(db) {
  const u = db.usuarios.find((x) => x.id === db.sessao);
  if (!u) throw erro('sem_sessao');
  return u;
}

function dadosDe(db, idUsuario) {
  db.dados[idUsuario] ??= { plano: P.planoVazio(), registros: {} };
  return db.dados[idUsuario];
}

// Lê, aplica a mudança e grava. Se a função lançar erro, nada é gravado.
function transacao(fn) {
  const db = ler();
  const resultado = fn(db);
  gravar(db);
  return resultado;
}

function dadosDaSessao(fn) {
  return transacao((db) => fn(dadosDe(db, usuarioDaSessao(db).id), db));
}

// ---------- Conta (RF009, RF001, UC05) ----------

export async function sessao() {
  const db = ler();
  return publico(db.usuarios.find((u) => u.id === db.sessao));
}

export async function criarConta({ nome = '', email = '', senha = '', perfil = '', nomePaciente = '' }) {
  const limpo = {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    perfil,
    nomePaciente: nomePaciente.trim(),
  };
  const campos = {};
  if (!limpo.nome) campos.nome = 'Escreva seu nome.';
  if (!['paciente', 'cuidador'].includes(perfil)) campos.perfil = 'Escolha quem vai usar o AlarMed.';
  if (perfil === 'cuidador' && !limpo.nomePaciente) campos.nomePaciente = 'Escreva o nome de quem você cuida.';
  if (!EMAIL.test(limpo.email)) campos.email = 'Escreva um e-mail válido, como nome@exemplo.com.';
  if (senha.length < 6) campos.senha = 'Use pelo menos 6 caracteres.';
  if (Object.keys(campos).length) throw erro('dados_invalidos', campos);

  return transacao((db) => {
    if (db.usuarios.some((u) => u.email === limpo.email)) {
      throw erro('email_em_uso', { email: 'Já existe uma conta com este e-mail. Use “Entrar”.' });
    }
    const usuario = {
      id: gerarId('u'),
      nome: limpo.nome,
      email: limpo.email,
      senha, // texto puro: ver aviso no topo do arquivo
      perfil,
      nomePaciente: perfil === 'cuidador' ? limpo.nomePaciente : null,
      criadoEm: relogio.agora().toISOString(),
    };
    db.usuarios.push(usuario);
    db.sessao = usuario.id;
    dadosDe(db, usuario.id);
    return publico(usuario);
  });
}

export async function entrar({ email = '', senha = '' }) {
  const campos = {};
  if (!email.trim()) campos.email = 'Escreva o e-mail da conta.';
  if (!senha) campos.senha = 'Escreva a senha.';
  if (Object.keys(campos).length) throw erro('dados_invalidos', campos);
  return transacao((db) => {
    const u = db.usuarios.find((x) => x.email === email.trim().toLowerCase() && x.senha === senha);
    if (!u) throw erro('credenciais');
    db.sessao = u.id;
    return publico(u);
  });
}

export async function sair() {
  transacao((db) => {
    db.sessao = null;
  });
}

// ---------- Plano (RF002, RF008, RF010, RN01) ----------

export async function obterPlano() {
  const db = ler();
  return structuredClone(dadosDe(db, usuarioDaSessao(db).id).plano);
}

export async function adicionarItem(formulario) {
  const { valido, erros } = P.validarItem(formulario, dataISO(relogio.agora()));
  if (!valido) throw erro('dados_invalidos', erros);
  return dadosDaSessao((d) => {
    const item = P.normalizarItem(formulario, gerarId('m'));
    d.plano = P.comItemAdicionado(d.plano, item);
    return item;
  });
}

export async function removerItem(id) {
  return dadosDaSessao((d) => {
    const lista = P.itensEmEdicao(d.plano);
    const posicao = lista.findIndex((i) => i.id === id);
    if (posicao < 0) throw erro('item_inexistente');
    const item = lista[posicao];
    d.plano = P.comItemRemovido(d.plano, id);
    return { item, posicao };
  });
}

// Usado pelo "Desfazer" depois de remover.
export async function reinserirItem(item, posicao) {
  return dadosDaSessao((d) => {
    d.plano = P.comItemReinserido(d.plano, item, posicao);
  });
}

export async function descartarAlteracao() {
  return dadosDaSessao((d) => {
    d.plano = P.semAlteracao(d.plano);
  });
}

export async function confirmarPlano() {
  return dadosDaSessao((d) => {
    if (!P.podeRevisar(d.plano)) throw erro('nada_a_confirmar');
    d.plano = P.confirmarPlano(d.plano, relogio.agora());
    return structuredClone(d.plano);
  });
}

// ---------- Registros de dose (RF004, RN02) ----------

export async function listarRegistros() {
  const db = ler();
  return dadosDe(db, usuarioDaSessao(db).id).registros;
}

export async function registrarDose(idDose, status) {
  return dadosDaSessao((d) => {
    const agora = relogio.agora();
    const dose = D.encontrarDose(D.todosOsItens(d.plano), idDose);
    const motivo = D.motivoParaRecusarRegistro(dose, status, d.registros[idDose], agora);
    if (motivo) throw erro(motivo);
    d.registros[idDose] = { status, em: agora.toISOString() };
    return d.registros[idDose];
  });
}

export async function desfazerRegistro(idDose) {
  return dadosDaSessao((d) => {
    const agora = relogio.agora();
    const registro = d.registros[idDose];
    if (!registro) throw erro('sem_registro');
    const dose = D.encontrarDose(D.todosOsItens(d.plano), idDose);
    if (!dose || !D.podeCorrigir(dose, registro, agora)) throw erro('prazo_correcao');
    delete d.registros[idDose];
  });
}

// ---------- Demonstração (?demo=1) ----------
// Conta fictícia com 45 dias de histórico, para os testes de usabilidade.
// As pessoas são as personas da jornada (Antônio, paciente; Juliana, cuidadora).

const PADRAO_DEMO = 'TTTPTTTTNTTPTTTT'; // T: todas tomadas; P: parte; N: nenhuma

function montarDemonstracao(agora) {
  const hoje = dataISO(agora);
  const inicio = somarDias(hoje, -45);
  const vigenteDesde = deDataHora(inicio, '07:00').toISOString();
  const base = { qtd: 1, unidade: 'comprimido', via: 'oral', duracao: { tipo: 'continuo' }, foto: null, vigenteDesde, inicio, fim: null };
  const itens = [
    { ...base, id: 'demo-losartana', nome: 'Losartana', concentracao: '50 mg', horarios: ['08:00', '20:00'], obs: '' },
    { ...base, id: 'demo-metformina', nome: 'Metformina', concentracao: '850 mg', horarios: ['12:00'], obs: 'Depois do almoço' },
  ];
  const registros = {};
  for (let i = 0; ; i += 1) {
    const data = somarDias(inicio, i);
    if (data > hoje) break;
    const tipo = PADRAO_DEMO[i % PADRAO_DEMO.length];
    if (tipo === 'N') continue; // sem registro: todas viram não tomadas automáticas
    for (const dose of D.dosesDoDia(itens, data)) {
      if (D.fimDaJanela(dose) > agora) continue; // hoje: deixa abertas as doses ainda no prazo
      const em = somarMinutos(dose.t, 4 + ((i * 7 + dose.hora.charCodeAt(1)) % 30)).toISOString();
      const status = tipo === 'P' && dose.hora === '12:00' ? 'nao_tomada' : 'tomada';
      registros[dose.id] = { status, em };
    }
  }
  return { plano: { confirmado: { itens, confirmadoEm: vigenteDesde }, rascunho: null, encerrados: [] }, registros };
}

export async function carregarDemonstracao() {
  return transacao((db) => {
    const id = 'demo';
    db.usuarios = db.usuarios.filter((u) => u.id !== id);
    db.usuarios.push({
      id,
      nome: 'Juliana',
      email: 'demo@alarmed.test',
      senha: 'demo1234',
      perfil: 'cuidador',
      nomePaciente: 'Antônio',
      criadoEm: relogio.agora().toISOString(),
    });
    db.dados[id] = montarDemonstracao(relogio.agora());
    db.sessao = id;
    return publico(db.usuarios.find((u) => u.id === id));
  });
}
