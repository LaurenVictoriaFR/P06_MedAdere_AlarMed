// #/estilo · Guia de componentes, para conferir consistência visual e contraste.
// Não exige login.

import {
  h, cabecalho, botao, botaoTexto, campo, grupoChips, segmentado, selo, aviso, badge, cartaoItem, marca,
} from '../ui/componentes.js';
import { icone, NOMES_DE_ICONES } from '../ui/icones.js';
import { mostrarToast } from '../ui/toast.js';
import { razaoContraste, PARES_DE_COR } from '../ui/contraste.js';
import { normalizarItem, formularioVazio } from '../dominio/plano.js';

const estado = { chips: ['08:00'], modo: 'entrar' };

function valorDoToken(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

export default {
  titulo: () => 'Guia de estilo',

  async render(ctx) {
    const exemplo = normalizarItem({
      ...formularioVazio(), nome: 'Losartana', concentracao: '50 mg', horarios: ['08:00', '20:00'],
    }, 'exemplo');

    const pares = PARES_DE_COR.map(([texto, fundo, minimo]) => {
      const a = valorDoToken(texto);
      const b = valorDoToken(fundo);
      const r = razaoContraste(a, b);
      return h('tr', {},
        h('td', {}, h('span', { class: 'amostra-par', style: `color: ${a}; background: ${b}` }, 'Aa')),
        h('td', {}, h('code', {}, texto)), h('td', {}, h('code', {}, fundo)),
        h('td', { class: r >= minimo ? 'ok' : 'falha' }, `${r.toFixed(2)}:1 (mín. ${minimo})`));
    });

    return h('section', { class: 'tela tela-estilo' },
      cabecalho({ titulo: 'Guia de estilo', subtitulo: 'Componentes do AlarMed e pares de cor do RNF001.', voltar: { href: '#/', rotulo: 'Voltar' } }),
      h('section', { class: 'secao' }, h('h2', {}, 'Marca'), marca({ slogan: true })),
      h('section', { class: 'secao' }, h('h2', {}, 'Botões'),
        botao({ texto: 'Primário', icone: 'entrar' }),
        botao({ texto: 'Secundário', icone: 'mais', variante: 'secundario' }),
        botao({ texto: 'Desabilitado', desabilitado: true }),
        h('p', {}, botaoTexto({ texto: 'Botão de texto', icone: 'desfazer', aoClicar: () => {} }), ' ',
          botaoTexto({ texto: 'Remover', perigo: true, aoClicar: () => {} }))),
      h('section', { class: 'secao' }, h('h2', {}, 'Campos'),
        campo({ id: 'g-email', rotulo: 'E-mail', icone: 'email', placeholder: 'nome@exemplo.com' }),
        campo({ id: 'g-erro', rotulo: 'Campo com erro', erro: 'Escreva o nome como está na receita.', icone: 'capsula' }),
        segmentado({
          id: 'g-seg', rotulo: 'Exemplo', valor: estado.modo,
          opcoes: [{ valor: 'entrar', rotulo: 'Entrar', icone: 'usuario' }, { valor: 'criar', rotulo: 'Criar conta', icone: 'usuarioMais' }],
          aoEscolher: (v) => { estado.modo = v; ctx.atualizar(); },
        }),
        grupoChips({
          id: 'g-chips', rotulo: 'Chips', grade: true,
          opcoes: ['06:00', '08:00', '10:00'].map((v) => ({ valor: v, rotulo: v })),
          selecionado: (o) => estado.chips.includes(o.valor),
          aoEscolher: (o) => {
            estado.chips = estado.chips.includes(o.valor) ? estado.chips.filter((x) => x !== o.valor) : [...estado.chips, o.valor];
            ctx.atualizar();
          },
        })),
      h('section', { class: 'secao' }, h('h2', {}, 'Estados da dose'),
        h('p', { class: 'linha-selos' }, selo('programada'), selo('pendente'), selo('tomada'), selo('nao_tomada')),
        h('p', { class: 'linha-selos' }, badge('Novo', 'novo'), badge('Sai do plano', 'sai'))),
      h('section', { class: 'secao' }, h('h2', {}, 'Avisos'),
        aviso({ tipo: 'alerta', icone: 'alerta', texto: 'Compare cada item com a receita.' }),
        aviso({ tipo: 'sucesso', icone: 'sino', titulo: 'Lembretes ativos neste aparelho' }),
        aviso({ tipo: 'info', icone: 'info', texto: 'A taxa aparece quando as primeiras doses forem registradas.' }),
        aviso({ tipo: 'erro', icone: 'alerta', texto: 'E-mail ou senha não conferem.' }),
        aviso({ tipo: 'neutro', icone: 'info', texto: 'Aviso neutro.' })),
      h('section', { class: 'secao' }, h('h2', {}, 'Cartão de remédio'),
        cartaoItem(exemplo, { novo: true, aoRemover: () => {} }),
        cartaoItem(exemplo, { removido: true })),
      h('section', { class: 'secao' }, h('h2', {}, 'Toast'),
        botao({
          texto: 'Mostrar toast', variante: 'secundario', largo: false,
          aoClicar: () => mostrarToast('Dose registrada como tomada.', { acao: { rotulo: 'Desfazer', icone: 'desfazer', aoClicar: () => {} } }),
        })),
      h('section', { class: 'secao' }, h('h2', {}, 'Ícones'),
        h('ul', { class: 'grade-icones' }, NOMES_DE_ICONES.map((n) => h('li', {}, icone(n), h('code', {}, n))))),
      h('section', { class: 'secao' }, h('h2', {}, 'Contraste (WCAG AA)'),
        h('div', { class: 'tabela-rolavel' },
          h('table', { class: 'tabela-contraste' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Amostra'), h('th', {}, 'Texto'), h('th', {}, 'Fundo'), h('th', {}, 'Razão'))),
            h('tbody', {}, pares)))));
  },
};
