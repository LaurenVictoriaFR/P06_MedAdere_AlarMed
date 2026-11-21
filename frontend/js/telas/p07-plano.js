// P07 · Meu plano (RF010, RN01, UC-04).
// Remover e adicionar viram uma alteração pendente; os lembretes seguem o plano
// confirmado até a revisão no P02. F11: botão "Sair" no cabeçalho.

import { h, cabecalho, botao, botaoTexto, cartaoItem, aviso, vazio } from '../ui/componentes.js';
import { mostrarToast } from '../ui/toast.js';
import { sairDaConta, limparFormularioDoCadastro } from '../store.js';
import * as P from '../dominio/plano.js';

export default {
  titulo: () => 'Meu plano',
  aba: 'plano',

  async render(ctx) {
    const { plano, usuario } = ctx;
    const pendente = P.temAlteracaoPendente(plano);
    const { itens, removidos } = P.compararAlteracao(plano);

    const remover = async (item) => {
      const { posicao } = await ctx.api.removerItem(item.id);
      mostrarToast(`${P.tituloItem(item)} vai sair do plano depois da revisão.`, {
        acao: {
          rotulo: 'Desfazer', icone: 'desfazer',
          aoClicar: async () => { await ctx.api.reinserirItem(item, posicao); ctx.atualizar(); },
        },
      });
      await ctx.atualizar({ focarEm: '#titulo-remedios' });
    };

    const descartar = async () => {
      await ctx.api.descartarAlteracao();
      mostrarToast('Alteração descartada. O plano confirmado continua valendo.');
      await ctx.atualizar({ focarEm: 'h1' });
    };

    return h('section', { class: 'tela' },
      cabecalho({
        sobretitulo: usuario.perfil === 'cuidador' && usuario.nomePaciente ? `Paciente: ${usuario.nomePaciente}` : null,
        titulo: 'Meu plano',
        acoes: botaoTexto({ texto: 'Sair', icone: 'sair', foco: 'sair', aoClicar: () => sairDaConta(ctx) }),
      }),
      h('p', {}, h('span', { class: `selo ${pendente ? 'selo-pendente' : 'selo-tomada'}` }, pendente ? 'Alteração pendente' : 'Confirmado')),
      pendente && aviso({
        tipo: 'alerta', icone: 'alerta',
        texto: 'Estas mudanças ainda não valem. Até você revisar, os lembretes seguem o plano confirmado.',
        filhos: h('div', { class: 'aviso-acoes' },
          botao({ texto: 'Revisar alteração', aoClicar: () => ctx.navegar('/revisao'), foco: 'revisar' }),
          botaoTexto({ texto: 'Descartar alteração', aoClicar: descartar, foco: 'descartar' })),
      }),
      h('section', { class: 'secao', 'aria-labelledby': 'titulo-remedios' },
        h('h2', { id: 'titulo-remedios', tabindex: '-1' }, `Remédios (${itens.length})`),
        itens.length
          ? h('div', { class: 'lista-itens' }, itens.map(({ item, novo }) => cartaoItem(item, {
            novo, aoRemover: () => remover(item), foco: `remover-${item.id}`,
          })))
          : vazio('Nenhum remédio no plano.')),
      removidos.length > 0 && h('section', { class: 'secao', 'aria-labelledby': 'titulo-saem' },
        h('h2', { id: 'titulo-saem' }, 'Vão sair do plano'),
        h('div', { class: 'lista-itens' }, removidos.map((item) => cartaoItem(item, { removido: true })))),
      botao({
        texto: 'Adicionar medicamento', icone: 'mais', variante: 'secundario', foco: 'adicionar',
        aoClicar: () => { limparFormularioDoCadastro(); ctx.navegar('/cadastro'); },
      }));
  },
};
