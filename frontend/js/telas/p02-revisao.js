// P02 · Revisão e confirmação (RF002, RF010, RN01, RN05, UC-08).
// O plano (ou a alteração) só passa a valer depois de "Conferi" + "Confirmar e salvar".

import { h, fragmento, cabecalho, botao, cartaoItem, aviso } from '../ui/componentes.js';
import { mostrarToast } from '../ui/toast.js';
import { estadoUi } from '../store.js';
import * as P from '../dominio/plano.js';
import * as notificacoes from '../notificacoes.js';

export default {
  titulo: (ctx) => (P.temPlanoConfirmado(ctx.plano) ? 'Revise a alteração' : 'Revise o plano'),

  async render(ctx) {
    await ctx.api.revisarPlano?.();
    const estado = estadoUi.revisao;
    const alteracao = P.temPlanoConfirmado(ctx.plano);
    const { itens, removidos } = P.compararAlteracao(ctx.plano);
    const lembretes = P.textoLembretes(itens.map((i) => i.item));
    const voltar = alteracao ? '#/plano' : '#/cadastro';

    const confirmar = async () => {
      if (!estado.conferido) return;
      try {
        await ctx.api.confirmarPlano();
        estado.conferido = false;
        mostrarToast(alteracao
          ? 'Alteração confirmada. Os lembretes foram atualizados.'
          : 'Plano confirmado. Os lembretes começam hoje.');
        ctx.navegar('/hoje');
        notificacoes.verificarLembretes(ctx.api);
      } catch (e) {
        mostrarToast(e.message, { tipo: 'erro' });
      }
    };

    const conferencia = h('label', { class: `conferencia${estado.conferido ? ' conferencia-marcada' : ''}`, for: 'f-conferi' },
      h('input', {
        id: 'f-conferi',
        type: 'checkbox',
        checked: estado.conferido,
        onchange: (e) => { estado.conferido = e.target.checked; ctx.atualizar(); },
      }),
      h('span', {}, 'Conferi cada remédio, dose e horário com a receita.'));

    return fragmento(
      h('section', { class: 'tela' },
        cabecalho({
          titulo: alteracao ? 'Revise a alteração' : 'Revise o plano',
          subtitulo: 'Último passo antes de o plano valer.',
          voltar: { href: voltar, rotulo: 'Voltar e editar' },
        }),
        aviso({
          tipo: 'alerta',
          icone: 'alerta',
          papel: 'note',
          texto: 'Compare cada item com a receita. O AlarMed guarda o que você digitou: ele não sugere nem corrige doses.',
        }),
        h('section', { class: 'secao', 'aria-labelledby': 'titulo-plano' },
          h('h2', { id: 'titulo-plano' }, `${alteracao ? 'Como o plano fica' : 'Plano completo'} (${itens.length})`),
          itens.length
            ? h('div', { class: 'lista-itens' }, itens.map(({ item, novo }) => cartaoItem(item, { novo })))
            : h('p', { class: 'vazio' }, 'O plano fica sem remédios. Nenhum lembrete será enviado.')),
        removidos.length > 0 && h('section', { class: 'secao', 'aria-labelledby': 'titulo-saem' },
          h('h2', { id: 'titulo-saem' }, 'Saem do plano'),
          h('div', { class: 'lista-itens' }, removidos.map((item) => cartaoItem(item, { removido: true })))),
        lembretes && aviso({ tipo: 'sucesso', icone: 'sino', texto: lembretes }),
        conferencia),
      h('div', { class: 'rodape-acoes' },
        h('div', { class: 'rodape-interno' },
          botao({
            texto: 'Confirmar e salvar',
            icone: 'check',
            desabilitado: !estado.conferido,
            aoClicar: confirmar,
            foco: 'confirmar',
            atributos: { 'aria-describedby': estado.conferido ? null : 'dica-confirmar' },
          }),
          !estado.conferido && h('p', { id: 'dica-confirmar', class: 'rodape-dica' }, 'Marque a conferência para liberar.'),
          botao({ texto: 'Voltar e editar', variante: 'secundario', aoClicar: () => ctx.navegar(voltar.slice(1)) }))));
  },
};
