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
    // Com a API real, abrir a revisão passa o plano para EM_REVISAO no servidor.
    // É o servidor que garante a revisão obrigatória (RN01, ADR-09); o mock não tem essa função.
    await ctx.api.revisarPlano?.();

    const estado = estadoUi.revisao;
    const alteracao = P.temPlanoConfirmado(ctx.plano);
    // itens = como o plano fica; removidos = o que sai (só existe na alteração).
    const { itens, removidos } = P.compararAlteracao(ctx.plano);
    // Frase com quantos lembretes por dia o plano vai gerar.
    const lembretes = P.textoLembretes(itens.map((i) => i.item));
    // "Voltar e editar" leva para onde a pessoa estava editando.
    const voltar = alteracao ? '#/plano' : '#/cadastro';

    // "Confirmar e salvar": só funciona com a caixa "Conferi" marcada.
    const confirmar = async () => {
      if (!estado.conferido) return;
      try {
        await ctx.api.confirmarPlano();
        estado.conferido = false;
        const mensagem = alteracao
          ? 'Alteração confirmada. Os lembretes foram atualizados.'
          : 'Plano confirmado. Os lembretes começam hoje.';
        mostrarToast(mensagem);
        ctx.navegar('/hoje');
        // Reagenda os lembretes deste aparelho com o plano novo.
        notificacoes.verificarLembretes(ctx.api);
      } catch (e) {
        mostrarToast(e.message, { tipo: 'erro' });
      }
    };

    // Caixa "Conferi": marcar ou desmarcar redesenha a tela para liberar ou travar o botão.
    const marcadaOuNao = estado.conferido ? ' conferencia-marcada' : '';
    const conferencia = h('label', { class: `conferencia${marcadaOuNao}`, for: 'f-conferi' },
      h('input', {
        id: 'f-conferi',
        type: 'checkbox',
        checked: estado.conferido,
        onchange: (e) => {
          estado.conferido = e.target.checked;
          ctx.atualizar();
        },
      }),
      h('span', {}, 'Conferi cada remédio, dose e horário com a receita.'));

    // Aviso do RN05: o app não confere doses nem interações; quem confere é a pessoa.
    const avisoDaReceita = aviso({
      tipo: 'alerta',
      icone: 'alerta',
      papel: 'note',
      texto: 'Compare cada item com a receita. O AlarMed guarda o que você digitou: ele não sugere nem corrige doses.',
    });

    // Lista de como o plano fica (com os itens novos marcados).
    const tituloDoPlano = `${alteracao ? 'Como o plano fica' : 'Plano completo'} (${itens.length})`;
    const conteudoDoPlano = itens.length
      ? h('div', { class: 'lista-itens' }, itens.map(({ item, novo }) => cartaoItem(item, { novo })))
      : h('p', { class: 'vazio' }, 'O plano fica sem remédios. Nenhum lembrete será enviado.');
    const secaoDoPlano = h('section', { class: 'secao', 'aria-labelledby': 'titulo-plano' },
      h('h2', { id: 'titulo-plano' }, tituloDoPlano),
      conteudoDoPlano);

    // Na alteração, os remédios que saem aparecem à parte.
    const secaoDosRemovidos = removidos.length > 0 && h('section', { class: 'secao', 'aria-labelledby': 'titulo-saem' },
      h('h2', { id: 'titulo-saem' }, 'Saem do plano'),
      h('div', { class: 'lista-itens' }, removidos.map((item) => cartaoItem(item, { removido: true }))));

    // Rodapé fixo. Enquanto "Conferi" não estiver marcado, o botão fica travado e a dica explica por quê.
    const rodape = h('div', { class: 'rodape-acoes' },
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
        // voltar começa com "#", que o navegar() não usa.
        botao({ texto: 'Voltar e editar', variante: 'secundario', aoClicar: () => ctx.navegar(voltar.slice(1)) })));

    return fragmento(
      h('section', { class: 'tela' },
        cabecalho({
          titulo: alteracao ? 'Revise a alteração' : 'Revise o plano',
          subtitulo: 'Último passo antes de o plano valer.',
          voltar: { href: voltar, rotulo: 'Voltar e editar' },
        }),
        avisoDaReceita,
        secaoDoPlano,
        secaoDosRemovidos,
        lembretes && aviso({ tipo: 'sucesso', icone: 'sino', texto: lembretes }),
        conferencia),
      rodape);
  },
};
