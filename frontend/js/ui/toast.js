// Mensagem curta com ação opcional (ex.: Desfazer). Fica numa região role="status"
// já presente na página, para o leitor de tela anunciar. Pausa com foco ou mouse.

import { h } from './componentes.js';
import { icone } from './icones.js';

let temporizador = null;

function area() {
  return document.getElementById('toast');
}

function posicionar(el) {
  let base = 16;
  const rodape = document.querySelector('.rodape-acoes');
  const abas = document.getElementById('abas');
  if (rodape) base += rodape.getBoundingClientRect().height;
  else if (abas && !abas.hidden && window.innerWidth < 1024) base += abas.getBoundingClientRect().height;
  el.style.bottom = `${Math.round(base)}px`;
}

// Chamado depois de cada troca de tela: o rodapé ou as abas podem ter mudado de altura.
export function reposicionarToast() {
  const el = area();
  if (el && el.childElementCount) posicionar(el);
}

export function esconderToast() {
  clearTimeout(temporizador);
  area()?.replaceChildren();
}

export function mostrarToast(mensagem, { acao = null, tipo = 'info', duracao = 8000 } = {}) {
  const el = area();
  if (!el) return;
  clearTimeout(temporizador);
  const caixa = h('div', { class: `toast toast-${tipo}` },
    tipo === 'erro' && icone('alerta', { classe: 'toast-icone' }),
    h('span', { class: 'toast-texto' }, mensagem),
    acao && h('button', {
      type: 'button',
      class: 'toast-acao',
      onclick: async () => {
        esconderToast();
        await acao.aoClicar();
      },
    }, acao.icone && icone(acao.icone, { tamanho: 20 }), h('span', {}, acao.rotulo)));

  const iniciar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(esconderToast, duracao);
  };
  caixa.addEventListener('mouseenter', () => clearTimeout(temporizador));
  caixa.addEventListener('mouseleave', iniciar);
  caixa.addEventListener('focusin', () => clearTimeout(temporizador));
  caixa.addEventListener('focusout', iniciar);

  posicionar(el);
  el.replaceChildren(caixa);
  iniciar();
}
