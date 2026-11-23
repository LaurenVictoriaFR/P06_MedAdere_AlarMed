// Componentes de interface. Tudo é criado com h(), que transforma texto em
// nós de texto: o que o usuário digita nunca é interpretado como HTML (XSS).

import { icone } from './icones.js';
import { tituloItem, linhaPosologia, linhaDuracao } from '../dominio/plano.js';

export function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === 'class') el.className = valor;
    else if (chave === 'dataset') Object.assign(el.dataset, valor);
    else if (chave.startsWith('on') && typeof valor === 'function') el.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (chave === 'value') el.value = valor;
    else if (chave === 'checked') el.checked = Boolean(valor);
    else if (valor === true) el.setAttribute(chave, '');
    else el.setAttribute(chave, String(valor));
  }
  anexar(el, filhos);
  return el;
}

export function anexar(el, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false || filho === true) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

export function fragmento(...filhos) {
  return anexar(document.createDocumentFragment(), filhos);
}

// ---------- Marca ----------

export function marca({ tamanho = 'media', slogan = false, centralizada = false, curva = centralizada, nivel = 'p' } = {}) {
  return h('div', { class: `marca marca-${tamanho}${centralizada ? ' marca-centro' : ''}` },
    h('div', { class: 'marca-linha' },
      h('img', { class: 'marca-simbolo', src: 'assets/img/simbolo.png', alt: '', width: 185, height: 175 }),
      h(nivel, { class: 'marca-nome' }, 'Alar', h('span', { class: 'marca-med' }, 'Med'))),
    slogan && h('p', { class: 'marca-slogan' }, 'Seus remédios no horário certo'),
    slogan && curva && h('span', { class: 'marca-curva', 'aria-hidden': 'true' }));
}

// ---------- Botões ----------

export function botao({
  texto, icone: nomeIcone = null, variante = 'primario', tipo = 'button', aoClicar = null,
  desabilitado = false, rotulo = null, foco = null, largo = true, classe = '', atributos = {},
}) {
  return h('button', {
    type: tipo,
    class: `btn btn-${variante}${largo ? ' btn-largo' : ''}${classe ? ` ${classe}` : ''}`,
    onclick: aoClicar,
    disabled: desabilitado,
    'aria-label': rotulo,
    'data-foco': foco,
    ...atributos,
  }, nomeIcone && icone(nomeIcone), h('span', {}, texto));
}

export function botaoTexto({ texto, icone: nomeIcone = null, aoClicar, rotulo = null, foco = null, perigo = false }) {
  return h('button', {
    type: 'button',
    class: `btn-texto${perigo ? ' btn-texto-perigo' : ''}`,
    onclick: aoClicar,
    'aria-label': rotulo,
    'data-foco': foco,
  }, nomeIcone && icone(nomeIcone, { tamanho: 20 }), h('span', {}, texto));
}

export function linkIcone({ href, rotulo, icone: nomeIcone }) {
  return h('a', { class: 'btn-icone', href, 'aria-label': rotulo }, icone(nomeIcone, { tamanho: 26 }));
}

// ---------- Cabeçalho de tela ----------

export function cabecalho({ titulo, subtitulo = null, sobretitulo = null, voltar = null, acoes = null }) {
  return h('header', { class: 'cabecalho' },
    voltar && linkIcone({ href: voltar.href, rotulo: voltar.rotulo ?? 'Voltar', icone: 'voltar' }),
    h('div', { class: 'cabecalho-textos' },
      sobretitulo && h('p', { class: 'sobretitulo' }, sobretitulo),
      h('h1', { tabindex: '-1' }, titulo),
      subtitulo && h('p', { class: 'subtitulo' }, subtitulo)),
    acoes && h('div', { class: 'cabecalho-acoes' }, acoes));
}

// ---------- Campos ----------

export function campo({
  id, rotulo, ajuda = null, erro = null, icone: nomeIcone = null, tipo = 'text', valor = '',
  placeholder = null, autocomplete = null, aoDigitar = null, acessorio = null, atributos = {},
}) {
  const idAjuda = ajuda ? `${id}-ajuda` : null;
  const idErro = erro ? `${id}-erro` : null;
  const descrito = [idAjuda, idErro].filter(Boolean).join(' ') || null;
  const entrada = h('input', {
    id,
    name: id,
    type: tipo,
    value: valor,
    placeholder,
    autocomplete,
    'aria-invalid': erro ? 'true' : null,
    'aria-describedby': descrito,
    oninput: aoDigitar,
    ...atributos,
  });
  return h('div', { class: `campo${erro ? ' campo-com-erro' : ''}` },
    h('label', { for: id, class: 'campo-rotulo' }, rotulo),
    ajuda && h('p', { id: idAjuda, class: 'campo-ajuda' }, ajuda),
    h('div', { class: 'campo-caixa' },
      nomeIcone && icone(nomeIcone, { classe: 'campo-icone' }),
      entrada,
      acessorio),
    erro && mensagemErro(idErro, erro));
}

export function mensagemErro(id, texto) {
  return h('p', { id, class: 'campo-erro' }, icone('alerta', { tamanho: 18 }), h('span', {}, texto));
}

// Remove o erro de um campo assim que a pessoa volta a digitar (sem redesenhar a tela).
export function limparErroDoCampo(entrada) {
  const caixa = entrada.closest('.campo');
  if (!caixa) return;
  caixa.classList.remove('campo-com-erro');
  entrada.removeAttribute('aria-invalid');
  const erro = caixa.querySelector('.campo-erro');
  if (erro) {
    const resto = (entrada.getAttribute('aria-describedby') ?? '').split(' ').filter((i) => i && i !== erro.id);
    if (resto.length) entrada.setAttribute('aria-describedby', resto.join(' '));
    else entrada.removeAttribute('aria-describedby');
    erro.remove();
  }
}

// Grupo de opções como botões com aria-pressed (padrão do protótipo).
export function grupoChips({ id, rotulo, ajuda = null, opcoes, selecionado, aoEscolher, grade = false, erro = null }) {
  const idRotulo = `${id}-rotulo`;
  const idAjuda = ajuda ? `${id}-ajuda` : null;
  const idErro = erro ? `${id}-erro` : null;
  return h('div', { class: `grupo${erro ? ' campo-com-erro' : ''}`, id: `${id}-grupo` },
    h('p', { id: idRotulo, class: 'campo-rotulo' }, rotulo),
    ajuda && h('p', { id: idAjuda, class: 'campo-ajuda' }, ajuda),
    h('div', {
      role: 'group',
      'aria-labelledby': idRotulo,
      'aria-describedby': [idAjuda, idErro].filter(Boolean).join(' ') || null,
      class: `chips${grade ? ' chips-grade' : ''}`,
    }, opcoes.map((opcao) => {
      const ativo = selecionado(opcao);
      return h('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(ativo),
        'data-foco': `${id}-${opcao.valor}`,
        onclick: () => aoEscolher(opcao),
      }, ativo && icone('check', { tamanho: 18 }), h('span', {}, opcao.rotulo));
    })),
    erro && mensagemErro(idErro, erro));
}

export function segmentado({ rotulo, opcoes, valor, aoEscolher, id }) {
  return h('div', { class: 'segmentado', role: 'group', 'aria-label': rotulo },
    opcoes.map((o) => h('button', {
      type: 'button',
      class: 'segmento',
      'aria-pressed': String(o.valor === valor),
      'data-foco': `${id}-${o.valor}`,
      onclick: () => aoEscolher(o.valor),
    }, o.icone && icone(o.icone), h('span', {}, o.rotulo))));
}

// ---------- Estados, avisos e cartões ----------

const SELOS = {
  programada: { texto: 'Programada', icone: 'relogio' },
  pendente: { texto: 'Pendente', icone: 'sino' },
  tomada: { texto: 'Tomada', icone: 'check' },
  nao_tomada: { texto: 'Não tomada', icone: 'x' },
  sem_confirmacao: { texto: 'Sem confirmação', icone: 'info' },
};

// O estado vai sempre escrito, nunca só pela cor (RNF001).
export function selo(estado) {
  const s = SELOS[estado];
  return h('span', { class: `selo selo-${estado}` }, icone(s.icone, { tamanho: 18 }), h('span', {}, s.texto));
}

export function aviso({ tipo = 'info', icone: nomeIcone = 'info', titulo = null, texto = null, filhos = null, papel = null }) {
  return h('div', { class: `aviso aviso-${tipo}`, role: papel },
    icone(nomeIcone, { classe: 'aviso-icone' }),
    h('div', { class: 'aviso-corpo' },
      titulo && h('p', { class: 'aviso-titulo' }, titulo),
      texto && h('p', {}, texto),
      filhos));
}

export function badge(texto, tipo) {
  return h('span', { class: `badge badge-${tipo}` }, texto);
}

export function cartaoItem(item, { novo = false, removido = false, aoRemover = null, foco = null } = {}) {
  const titulo = tituloItem(item);
  return h('article', { class: `cartao-item${removido ? ' cartao-item-removido' : ''}` },
    item.foto && h('img', { class: 'cartao-item-foto', src: item.foto, alt: '', width: 64, height: 64 }),
    h('div', { class: 'cartao-item-textos' },
      h('h3', { class: 'cartao-item-titulo' }, removido ? h('del', {}, titulo) : titulo),
      h('p', {}, removido ? h('del', {}, linhaPosologia(item)) : linhaPosologia(item)),
      !removido && h('p', { class: 'texto-suave' }, linhaDuracao(item)),
      (novo || removido) && h('p', { class: 'cartao-item-badges' },
        novo && badge('Novo', 'novo'),
        removido && badge('Sai do plano', 'sai'))),
    aoRemover && botaoTexto({ texto: 'Remover', aoClicar: aoRemover, rotulo: `Remover ${titulo}`, foco, perigo: true }));
}

export function vazio(texto) {
  return h('p', { class: 'vazio' }, texto);
}
