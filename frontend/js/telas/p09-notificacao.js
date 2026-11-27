// P09 · Notificação (RF003, UC-07). Esta rota é a SIMULAÇÃO da tela de bloqueio,
// para demonstração e testes de usabilidade. O lembrete de verdade é a
// notificação do sistema (notificacoes.js); ao tocar nela, abre o P03 com a dose em destaque.

import { h, botao } from '../ui/componentes.js';
import { mostrarToast } from '../ui/toast.js';
import { diaPorExtenso } from '../ui/formato.js';
import * as D from '../dominio/doses.js';
import { dosesComEstado } from '../dominio/adesao.js';
import { dataISO, horaHM } from '../dominio/tempo.js';
import * as notificacoes from '../notificacoes.js';

// A dose mais útil para mostrar: a pendente, senão a próxima, senão a última do dia.
function escolherDose(doses) {
  const pendente = doses.find((d) => d.estado === D.ESTADOS.PENDENTE);
  if (pendente) return pendente;

  const proxima = doses.find((d) => d.estado === D.ESTADOS.PROGRAMADA);
  if (proxima) return proxima;

  if (doses.length) return doses[doses.length - 1];
  return null;
}

export default {
  titulo: () => 'Lembrete (simulação)',

  async render(ctx) {
    const { agora, plano } = ctx;
    const registros = await ctx.api.listarRegistros();
    const doses = dosesComEstado(D.todosOsItens(plano), registros, dataISO(agora), agora);
    const dose = escolherDose(doses);
    // Título e texto iguais aos da notificação de verdade.
    const textos = dose && notificacoes.textosDoLembrete(dose);

    // A "notificação" simulada é um link: tocar nela faz o mesmo que tocar na real.
    let notificacao;
    if (dose) {
      notificacao = h('a', { class: 'notificacao', href: `#/hoje?dose=${encodeURIComponent(dose.id)}` },
        h('img', { src: 'assets/img/simbolo.png', alt: '', width: 42, height: 42 }),
        h('span', { class: 'notificacao-textos' },
          h('span', { class: 'notificacao-app' }, `AlarMed · ${dose.hora}`),
          h('span', { class: 'notificacao-titulo' }, textos.titulo),
          h('span', {}, textos.corpo)));
    } else {
      notificacao = h('p', { class: 'bloqueio-vazio' }, 'Nenhuma dose hoje para simular.');
    }

    // "Enviar um lembrete de teste": com a API real, o servidor manda um push de verdade;
    // no modo de demonstração, o próprio aparelho mostra a notificação.
    const enviarTeste = async () => {
      try {
        if (ctx.api.modoReal) {
          const resultado = await ctx.api.enviarLembreteTeste();
          const mensagem = resultado.solicitacoesAceitas > 0
            ? 'Envio aceito pelo serviço de push. Verifique o aparelho.'
            : 'O serviço de push recusou o teste. Tente ativar os lembretes novamente.';
          mostrarToast(mensagem);
        } else {
          await notificacoes.mostrarLembrete(dose);
          mostrarToast('Lembrete local de teste enviado.');
        }
      } catch (e) {
        mostrarToast(e.message, { tipo: 'erro' });
      }
    };
    // O botão só aparece com uma dose para mostrar e com a permissão de notificação concedida.
    const botaoDeTeste = dose && notificacoes.situacao() === 'concedida' && botao({
      texto: 'Enviar um lembrete de teste',
      icone: 'sino',
      variante: 'secundario',
      largo: false,
      aoClicar: enviarTeste,
    });

    return h('section', { class: 'bloqueio' },
      h('h1', { class: 'sr-only', tabindex: '-1' }, 'Simulação do lembrete na tela de bloqueio'),
      h('p', { class: 'bloqueio-data' }, diaPorExtenso(agora)),
      h('p', { class: 'bloqueio-hora' }, h('time', {}, horaHM(agora))),
      notificacao,
      h('p', { class: 'bloqueio-legenda' }, 'Simulação da notificação do sistema'),
      botaoDeTeste,
      h('a', { class: 'bloqueio-voltar', href: '#/hoje' }, 'Voltar para Doses de hoje'));
  },
};
