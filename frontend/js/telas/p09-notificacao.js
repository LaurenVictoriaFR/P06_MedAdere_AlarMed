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
  return doses.find((d) => d.estado === D.ESTADOS.PENDENTE)
    ?? doses.find((d) => d.estado === D.ESTADOS.PROGRAMADA)
    ?? doses[doses.length - 1]
    ?? null;
}

export default {
  titulo: () => 'Lembrete (simulação)',

  async render(ctx) {
    const { agora, plano } = ctx;
    const registros = await ctx.api.listarRegistros();
    const doses = dosesComEstado(D.todosOsItens(plano), registros, dataISO(agora), agora);
    const dose = escolherDose(doses);
    const textos = dose && notificacoes.textosDoLembrete(dose);

    return h('section', { class: 'bloqueio' },
      h('h1', { class: 'sr-only', tabindex: '-1' }, 'Simulação do lembrete na tela de bloqueio'),
      h('p', { class: 'bloqueio-data' }, diaPorExtenso(agora)),
      h('p', { class: 'bloqueio-hora' }, h('time', {}, horaHM(agora))),
      dose
        ? h('a', { class: 'notificacao', href: `#/hoje?dose=${encodeURIComponent(dose.id)}` },
          h('img', { src: 'assets/img/simbolo.png', alt: '', width: 42, height: 42 }),
          h('span', { class: 'notificacao-textos' },
            h('span', { class: 'notificacao-app' }, `AlarMed · ${dose.hora}`),
            h('span', { class: 'notificacao-titulo' }, textos.titulo),
            h('span', {}, textos.corpo)))
        : h('p', { class: 'bloqueio-vazio' }, 'Nenhuma dose hoje para simular.'),
      h('p', { class: 'bloqueio-legenda' }, 'Simulação da notificação do sistema'),
      dose && notificacoes.situacao() === 'concedida' && botao({
        texto: 'Enviar um lembrete de teste', icone: 'sino', variante: 'secundario', largo: false,
        aoClicar: async () => {
          await notificacoes.mostrarLembrete(dose);
          mostrarToast('Lembrete de teste enviado.');
        },
      }),
      h('a', { class: 'bloqueio-voltar', href: '#/hoje' }, 'Voltar para Doses de hoje'));
  },
};
