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
    const { plano } = ctx;
    // Há mudanças ainda não revisadas?
    const pendente = P.temAlteracaoPendente(plano);
    const { itens, removidos } = P.compararAlteracao(plano);
    // Só fica só para leitura com um servidor antigo, que ainda não tem o UC-04 (alteração do plano).
    const somenteLeitura = plano.somenteLeitura;

    // Remover um remédio: entra na alteração pendente, com "Desfazer" no aviso.
    const remover = async (item) => {
      const { posicao } = await ctx.api.removerItem(item.id);
      const desfazer = async () => {
        await ctx.api.reinserirItem(item, posicao);
        ctx.atualizar();
      };
      mostrarToast(`${P.tituloItem(item)} vai sair do plano depois da revisão.`, {
        acao: { rotulo: 'Desfazer', icone: 'desfazer', aoClicar: desfazer },
      });
      await ctx.atualizar({ focarEm: '#titulo-remedios' });
    };

    // Descartar: joga fora a alteração pendente; o plano confirmado continua igual.
    const descartar = async () => {
      await ctx.api.descartarAlteracao();
      mostrarToast('Alteração descartada. O plano confirmado continua valendo.');
      await ctx.atualizar({ focarEm: 'h1' });
    };

    // Selo com a situação do plano, escrito e não só pela cor.
    const selo = h('p', {},
      h('span', { class: `selo ${pendente ? 'selo-pendente' : 'selo-tomada'}` }, pendente ? 'Alteração pendente' : 'Confirmado'));

    // Com alteração pendente: explica que ainda não vale e oferece revisar ou descartar.
    const avisoDaAlteracao = pendente && aviso({
      tipo: 'alerta',
      icone: 'alerta',
      texto: 'Estas mudanças ainda não valem. Até você revisar, os lembretes seguem o plano confirmado.',
      filhos: h('div', { class: 'aviso-acoes' },
        botao({ texto: 'Revisar alteração', aoClicar: () => ctx.navegar('/revisao'), foco: 'revisar' }),
        botaoTexto({ texto: 'Descartar alteração', aoClicar: descartar, foco: 'descartar' })),
    });

    // Remédios do plano. Sem o botão "Remover" quando o plano é só de leitura.
    const cartoes = itens.map(({ item, novo }) => cartaoItem(item, {
      novo,
      aoRemover: somenteLeitura ? null : () => remover(item),
      foco: `remover-${item.id}`,
    }));
    const secaoDosRemedios = h('section', { class: 'secao', 'aria-labelledby': 'titulo-remedios' },
      h('h2', { id: 'titulo-remedios', tabindex: '-1' }, `Remédios (${itens.length})`),
      itens.length ? h('div', { class: 'lista-itens' }, cartoes) : vazio('Nenhum remédio no plano.'));

    // Remédios que vão sair quando a alteração for confirmada.
    const secaoDosRemovidos = removidos.length > 0 && h('section', { class: 'secao', 'aria-labelledby': 'titulo-saem' },
      h('h2', { id: 'titulo-saem' }, 'Vão sair do plano'),
      h('div', { class: 'lista-itens' }, removidos.map((item) => cartaoItem(item, { removido: true }))));

    // "Adicionar medicamento" abre o P01 com o formulário limpo.
    const adicionar = () => {
      limparFormularioDoCadastro();
      ctx.navegar('/cadastro');
    };
    const rodape = somenteLeitura
      ? aviso({ tipo: 'info', texto: 'Este servidor ainda não permite alterar o plano confirmado.' })
      : botao({ texto: 'Adicionar medicamento', icone: 'mais', variante: 'secundario', foco: 'adicionar', aoClicar: adicionar });

    return h('section', { class: 'tela' },
      cabecalho({
        titulo: 'Meu plano',
        acoes: botaoTexto({ texto: 'Sair', icone: 'sair', foco: 'sair', aoClicar: () => sairDaConta(ctx) }),
      }),
      selo,
      avisoDaAlteracao,
      secaoDosRemedios,
      secaoDosRemovidos,
      rodape);
  },
};
