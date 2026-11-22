// Inicialização: rotas, guardas de acesso, barra de abas e relógio da tela.

import * as api from './api/api.js';
import { rotaAtual, navegar, substituir } from './router.js';
import { relogio } from './relogio.js';
import { h, marca } from './ui/componentes.js';
import { icone } from './ui/icones.js';
import { reposicionarToast } from './ui/toast.js';
import * as P from './dominio/plano.js';
import * as notificacoes from './notificacoes.js';

import p08 from './telas/p08-entrar.js';
import p01 from './telas/p01-cadastro.js';
import p02 from './telas/p02-revisao.js';
import p03 from './telas/p03-hoje.js';
import p04 from './telas/p04-painel.js';
import p07 from './telas/p07-plano.js';
import p09 from './telas/p09-notificacao.js';
import estilo from './telas/estilo.js';

const TELAS = {
  entrar: p08,
  cadastro: p01,
  revisao: p02,
  hoje: p03,
  painel: p04,
  plano: p07,
  notificacao: p09,
  estilo,
};

const PUBLICAS = new Set(['entrar', 'estilo']);
const EXIGEM_PLANO = new Set(['hoje', 'painel', 'plano', 'notificacao']);
const ATUALIZAM_COM_O_TEMPO = new Set(['hoje', 'painel', 'notificacao']);

const ABAS = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'calendario' },
  { id: 'painel', rotulo: 'Painel', icone: 'barras' },
  { id: 'plano', rotulo: 'Plano', icone: 'lista' },
];

function destinoInicial(usuario, plano) {
  if (!usuario) return 'entrar';
  return P.temPlanoConfirmado(plano) ? 'hoje' : 'cadastro';
}

// Devolve para onde redirecionar, ou null se a rota pode abrir.
function guarda(nome, usuario, plano) {
  if (!TELAS[nome]) return destinoInicial(usuario, plano);
  if (PUBLICAS.has(nome)) return nome === 'entrar' && usuario ? destinoInicial(usuario, plano) : null;
  if (!usuario) return 'entrar';
  if (EXIGEM_PLANO.has(nome) && !P.temPlanoConfirmado(plano)) return 'cadastro';
  if (nome === 'revisao' && !P.podeRevisar(plano)) return P.temPlanoConfirmado(plano) ? 'plano' : 'cadastro';
  return null;
}

// ---------- Barra de abas ----------

function montarAbas() {
  const nav = document.getElementById('abas');
  nav.replaceChildren(
    h('div', { class: 'abas-marca' }, marca({ tamanho: 'pequena' })),
    h('ul', { class: 'abas-lista' }, ABAS.map((aba) => h('li', {},
      h('a', { class: 'aba', href: `#/${aba.id}`, 'data-aba': aba.id },
        h('span', { class: 'aba-icone' }, icone(aba.icone)),
        h('span', { class: 'aba-rotulo' }, aba.rotulo))))),
  );
}

function atualizarAbas(ativa) {
  const nav = document.getElementById('abas');
  nav.hidden = !ativa;
  document.body.classList.toggle('com-abas', Boolean(ativa));
  for (const link of nav.querySelectorAll('[data-aba]')) {
    if (link.dataset.aba === ativa) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

// ---------- Foco ----------

function chaveDoFoco() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.dataset?.foco) return `[data-foco="${CSS.escape(el.dataset.foco)}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  return null;
}

function focar(seletor) {
  const el = seletor && document.querySelector(seletor);
  if (!el) return false;
  el.focus({ preventScroll: true });
  return true;
}

function telaDeErro(erroOcorrido) {
  console.error(erroOcorrido);
  return h('section', { class: 'tela' },
    h('h1', { tabindex: '-1' }, 'Algo deu errado'),
    h('p', {}, 'Não foi possível abrir esta tela. Tente recarregar a página.'),
    h('p', {}, h('a', { href: '#/' }, 'Voltar ao início')));
}

// ---------- Desenho ----------

let hashAnterior = null;
let fila = Promise.resolve();

// Os desenhos são enfileirados para nunca rodarem em paralelo.
export function renderizar(opcoes = {}) {
  fila = fila.then(() => desenhar(opcoes)).catch((e) => console.error(e));
  return fila;
}

async function desenhar({ manterFoco = false, focarEm = null } = {}) {
  const rota = rotaAtual();
  let usuario = null;
  let plano = null;
  try {
    usuario = await api.sessao();
    plano = usuario ? await api.obterPlano() : null;
    await notificacoes.preparar(api, usuario);
  } catch (e) {
    console.error(e);
  }

  const destino = guarda(rota.nome, usuario, plano);
  if (destino) {
    substituir(`/${destino}`);
    return desenhar({ focarEm });
  }

  const tela = TELAS[rota.nome];
  const mudouDeRota = hashAnterior !== window.location.hash;
  const chave = manterFoco && !mudouDeRota ? chaveDoFoco() : null;
  const rolagem = window.scrollY;
  const ctx = {
    rota,
    usuario,
    plano,
    agora: relogio.agora(),
    api,
    navegar,
    atualizar: (o = {}) => renderizar({ manterFoco: true, ...o }),
  };

  let conteudo;
  try {
    conteudo = await tela.render(ctx);
  } catch (e) {
    conteudo = telaDeErro(e);
  }

  const principal = document.getElementById('conteudo');
  principal.replaceChildren(conteudo);
  document.body.dataset.tela = rota.nome;
  document.title = `${tela.titulo(ctx)} · AlarMed`;
  atualizarAbas(tela.aba ?? null);
  reposicionarToast();
  hashAnterior = window.location.hash;

  if (mudouDeRota) {
    window.scrollTo(0, 0);
    if (!focar(focarEm)) principal.querySelector('h1')?.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, rolagem);
    if (!focar(focarEm)) focar(chave);
  }
  tela.depois?.(ctx);
}

// ---------- Início ----------

function campoEmEdicao() {
  const el = document.activeElement;
  return el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function tique() {
  if (document.hidden) return;
  if (ATUALIZAM_COM_O_TEMPO.has(rotaAtual().nome) && !campoEmEdicao()) renderizar({ manterFoco: true });
  notificacoes.verificarLembretes(api);
}

function iniciar() {
  montarAbas();
  document.querySelector('.pular')?.addEventListener('click', () => {
    const principal = document.getElementById('conteudo');
    (principal.querySelector('h1') ?? principal).focus();
  });
  window.addEventListener('hashchange', () => renderizar());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tique();
  });

  if ('serviceWorker' in navigator) {
    // Clique na notificação com o app já aberto: o service worker manda a rota.
    navigator.serviceWorker.addEventListener('message', (evento) => {
      const hash = evento.data?.hash;
      if (evento.data?.tipo === 'abrir' && typeof hash === 'string' && hash.startsWith('#/')) {
        window.location.hash = hash.slice(1);
      }
    });
  }
  notificacoes.registrarServiceWorker();

  if (relogio.simulado) document.documentElement.dataset.relogio = 'simulado';
  renderizar();
  setInterval(tique, 30 * 1000);
  setTimeout(() => notificacoes.verificarLembretes(api), 2000);
}

iniciar();
