// P04 · Painel do mês (RF005, UC-03).
// Taxa = tomadas ÷ (tomadas + não tomadas). Dose com 2 estados; dia com 3 agregados (F08).
// Navegação entre meses (RF005 CA02), que faltava no protótipo.

import { h, cabecalho, selo, aviso } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { mesPorExtenso, diaMesPorExtenso, diaPorExtenso, plural } from '../ui/formato.js';
import { estadoUi } from '../store.js';
import * as D from '../dominio/doses.js';
import * as P from '../dominio/plano.js';
import { calcularMes, mesesDisponiveis, textoTaxa } from '../dominio/adesao.js';
import { deDataHora, mesISO, mesValido, somarMeses } from '../dominio/tempo.js';

const SEMANA = [
  ['D', 'domingo'], ['S', 'segunda-feira'], ['T', 'terça-feira'], ['Q', 'quarta-feira'],
  ['Q', 'quinta-feira'], ['S', 'sexta-feira'], ['S', 'sábado'],
];

const AGREGADOS = {
  todas: { rotulo: 'Todas tomadas', icone: 'check' },
  parte: { rotulo: 'Parte tomada', icone: 'meio' },
  nenhuma: { rotulo: 'Nenhuma tomada', icone: 'x' },
};

function descreverDia(dia) {
  const r = dia.resumo;
  const quando = `${diaMesPorExtenso(dia.data)}${dia.hoje ? ', hoje' : ''}`;
  if (r.agregado === 'sem_doses') return `${quando}: sem doses no plano`;
  if (dia.futuro) return `${quando}: ${plural(r.total, 'dose programada', 'doses programadas')}`;
  if (r.agregado === 'em_andamento') return `${quando}: ${r.tomadas} de ${r.total} tomadas até agora`;
  if (r.agregado === 'todas') return `${quando}: todas as ${r.total} doses tomadas`;
  if (r.agregado === 'nenhuma') return `${quando}: nenhuma das ${r.total} doses tomada`;
  return `${quando}: ${r.tomadas} de ${r.total} doses tomadas`;
}

function celula(dia, selecionado, aoEscolher) {
  const tipo = dia.futuro ? 'futuro' : dia.resumo.agregado;
  const marcador = AGREGADOS[tipo];
  const classes = `dia dia-${tipo}${dia.hoje ? ' dia-hoje' : ''}${selecionado ? ' dia-selecionado' : ''}`;
  if (dia.resumo.agregado === 'sem_doses') {
    return h('td', {}, h('span', { class: classes, 'aria-label': descreverDia(dia) },
      h('span', { class: 'dia-numero', 'aria-hidden': 'true' }, String(dia.dia))));
  }
  return h('td', {}, h('button', {
    type: 'button',
    class: classes,
    'aria-label': descreverDia(dia),
    'aria-pressed': String(selecionado),
    'data-foco': `dia-${dia.data}`,
    onclick: () => aoEscolher(dia.data),
  },
  h('span', { class: 'dia-numero', 'aria-hidden': 'true' }, String(dia.dia)),
  marcador && icone(marcador.icone, { tamanho: 14, classe: 'dia-marcador' })));
}

function calendario(mes, selecionada, aoEscolher) {
  const linhas = [];
  let semana = [];
  for (let i = 0; i < mes.primeiroDiaDaSemana; i += 1) semana.push(h('td', {}));
  for (const dia of mes.dias) {
    semana.push(celula(dia, dia.data === selecionada, aoEscolher));
    if (semana.length === 7) {
      linhas.push(h('tr', {}, semana));
      semana = [];
    }
  }
  if (semana.length) {
    while (semana.length < 7) semana.push(h('td', {}));
    linhas.push(h('tr', {}, semana));
  }
  return h('table', { class: 'calendario', 'aria-label': `Calendário de ${mesPorExtenso(mes.mes)}` },
    h('thead', {}, h('tr', {}, SEMANA.map(([letra, nome]) => h('th', { scope: 'col' }, h('abbr', { title: nome }, letra))))),
    h('tbody', {}, linhas));
}

function legenda() {
  return h('ul', { class: 'legenda', 'aria-label': 'Legenda' },
    Object.entries(AGREGADOS).map(([tipo, a]) => h('li', {},
      h('span', { class: `amostra dia-${tipo}`, 'aria-hidden': 'true' }, icone(a.icone, { tamanho: 14 })),
      a.rotulo)),
    h('li', {}, h('span', { class: 'amostra dia-sem_doses', 'aria-hidden': 'true' }), 'Sem doses'),
    h('li', {}, h('span', { class: 'amostra dia-futuro dia-hoje', 'aria-hidden': 'true' }), 'Hoje'));
}

function resumoDosDias(mes, atual) {
  const { todas, parte, nenhuma } = mes.contagem;
  if (todas + parte + nenhuma === 0) return 'Ainda não há dias completos neste mês.';
  const inicio = atual ? 'Até agora' : 'No mês';
  return `${inicio}: ${plural(todas, 'dia', 'dias')} com todas as doses tomadas, ${parte} com parte e ${nenhuma} sem nenhuma tomada.`;
}

function detalheDoDia(dia) {
  if (!dia) return null;
  return h('section', { class: 'cartao detalhe-dia', 'aria-labelledby': 'titulo-dia', tabindex: '-1', id: 'detalhe-dia' },
    h('h2', { id: 'titulo-dia' }, diaPorExtenso(deDataHora(dia.data))),
    h('ul', { class: 'lista-simples' }, dia.doses.map((d) => h('li', { class: 'linha-dose' },
      h('span', { class: 'linha-dose-hora' }, d.hora),
      h('span', { class: 'linha-dose-nome' }, P.tituloItem(d.item)),
      selo(d.estado)))));
}

export default {
  titulo: () => 'Painel do mês',
  aba: 'painel',

  async render(ctx) {
    const { agora, plano } = ctx;
    const registros = await ctx.api.listarRegistros();
    const itens = D.todosOsItens(plano);
    const meses = mesesDisponiveis(itens, agora);
    const pedido = ctx.rota.consulta.get('mes');
    const mesAtual = mesISO(agora);
    const mes = mesValido(pedido) && meses.includes(pedido) ? pedido : mesAtual;
    const dados = calcularMes(itens, registros, mes, agora);
    const ehAtual = mes === mesAtual;
    const estado = estadoUi.painel;
    if (estado.diaSelecionado && !estado.diaSelecionado.startsWith(mes)) estado.diaSelecionado = null;
    const diaEscolhido = dados.dias.find((d) => d.data === estado.diaSelecionado);

    const anterior = somarMeses(mes, -1);
    const seguinte = somarMeses(mes, 1);
    const irPara = (m) => ctx.navegar(m === mesAtual ? '/painel' : `/painel?mes=${m}`);

    const resumoTaxa = dados.taxa === null
      ? 'Ainda não há doses que passaram do prazo.'
      : `${dados.tomadas} de ${dados.resolvidas} ${dados.resolvidas === 1
        ? 'dose que já passou foi registrada como tomada.'
        : 'doses que já passaram foram registradas como tomadas.'}`;

    const escolherDia = (data) => {
      estado.diaSelecionado = estado.diaSelecionado === data ? null : data;
      ctx.atualizar();
    };

    return h('section', { class: 'tela' },
      cabecalho({ titulo: 'Painel do mês' }),
      h('nav', { class: 'mes-nav', 'aria-label': 'Escolher o mês' },
        h('button', {
          type: 'button', class: 'btn-icone', 'aria-label': `Mês anterior, ${mesPorExtenso(anterior)}`,
          disabled: !meses.includes(anterior), 'data-foco': 'mes-anterior', onclick: () => irPara(anterior),
        }, icone('voltar')),
        h('p', { class: 'mes-atual', 'aria-live': 'polite' }, mesPorExtenso(mes)),
        h('button', {
          type: 'button', class: 'btn-icone', 'aria-label': `Próximo mês, ${mesPorExtenso(seguinte)}`,
          disabled: !meses.includes(seguinte), 'data-foco': 'mes-seguinte', onclick: () => irPara(seguinte),
        }, icone('avancar'))),
      h('section', { class: 'cartao cartao-taxa', 'aria-labelledby': 'titulo-taxa' },
        h('h2', { id: 'titulo-taxa', class: 'cartao-taxa-titulo' }, 'Taxa de adesão registrada'),
        h('p', { class: 'taxa-numero' }, textoTaxa(dados.taxa)),
        dados.taxa !== null && h('div', { class: 'taxa-barra', 'aria-hidden': 'true' },
          h('span', { style: `width: ${Math.round(dados.taxa * 100)}%` })),
        h('p', {}, resumoTaxa)),
      dados.taxa === null && ehAtual && aviso({
        tipo: 'info', icone: 'info',
        texto: 'A taxa aparece quando as primeiras doses forem registradas ou passarem do prazo de 2 horas.',
      }),
      h('section', { class: 'cartao cartao-calendario', 'aria-label': 'Dias do mês' },
        calendario(dados, estado.diaSelecionado, escolherDia),
        legenda()),
      h('p', {}, resumoDosDias(dados, ehAtual)),
      detalheDoDia(diaEscolhido),
      h('p', { class: 'nota' }, 'A taxa considera o que foi marcado no AlarMed. Ela não comprova que o remédio foi tomado.'));
  },
};
