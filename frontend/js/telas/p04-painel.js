// P04 · Painel do mês (RF005, UC-03).
// Taxa = tomadas ÷ (tomadas + não tomadas declaradas + sem confirmação). Sem confirmação contada separadamente; dia com 3 agregados (F08).
// Navegação entre meses (RF005 CA02), que faltava no protótipo.
// Duas taxas, como no protótipo do P2: a do mês do calendário e a atual, desde o
// início do plano, geral ou por medicamento (UC-03 A3 e A4).
// Exportação (RF005): "Imprimir ou salvar em PDF" usa a impressão do navegador,
// com uma folha de estilo própria que mostra o relatório para levar à consulta.

import { h, cabecalho, selo, aviso, botao } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { mesPorExtenso, diaMesPorExtenso, diaPorExtenso, plural } from '../ui/formato.js';
import { estadoUi } from '../store.js';
import * as D from '../dominio/doses.js';
import * as P from '../dominio/plano.js';
import { calcularMes, calcularTaxaAtual, medicamentosDoPlano, mesesDisponiveis, textoTaxa } from '../dominio/adesao.js';
import { dataBR, dataISO, deDataHora, horaHM, mesISO, mesValido, somarMeses } from '../dominio/tempo.js';

const SEMANA = [
  ['D', 'domingo'], ['S', 'segunda-feira'], ['T', 'terça-feira'], ['Q', 'quarta-feira'],
  ['Q', 'quinta-feira'], ['S', 'sexta-feira'], ['S', 'sábado'],
];

const AGREGADOS = {
  todas: { rotulo: 'Todas registradas como tomadas', icone: 'check' },
  parte: { rotulo: 'Parte registrada como tomada', icone: 'meio' },
  nenhuma: { rotulo: 'Nenhuma registrada como tomada', icone: 'x' },
};

function descreverDia(dia) {
  const r = dia.resumo;
  const quando = `${diaMesPorExtenso(dia.data)}${dia.hoje ? ', hoje' : ''}`;
  if (r.agregado === 'sem_doses') return `${quando}: sem doses no plano`;
  if (dia.futuro) return `${quando}: ${plural(r.total, 'dose programada', 'doses programadas')}`;
  if (r.agregado === 'em_andamento') return `${quando}: ${r.tomadas} de ${r.total} tomadas até agora`;
  if (r.agregado === 'todas') return `${quando}: todas as ${r.total} doses tomadas`;
  if (r.agregado === 'nenhuma') return `${quando}: nenhuma das ${r.total} doses registrada como tomada; ${r.semConfirmacao} sem confirmação`;
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
  return `${inicio}: ${plural(todas, 'dia', 'dias')} com todas as doses registradas como tomadas, ${parte} com parte e ${nenhuma} sem registro de tomada.`;
}

function barraDaTaxa(taxa) {
  return taxa !== null && h('div', { class: 'taxa-barra', 'aria-hidden': 'true' },
    h('span', { style: `width: ${Math.round(taxa * 100)}%` }));
}

function resumoDaTaxaDoMes(t) {
  if (t.taxa === null) return 'Ainda não há doses declaradas ou com janela encerrada.';
  return `${t.tomadas} de ${t.resolvidas} ${t.resolvidas === 1
    ? 'dose que já passou foi registrada como tomada.'
    : 'doses que já passaram foram registradas como tomadas.'}`;
}

// UC-03 A4: sem doses passadas, avisa que ainda não dá para calcular.
function resumoDaTaxaAtual(t) {
  if (t.taxa === null) return 'Ainda não há doses passadas para calcular a taxa atual.';
  return `${t.tomadas} de ${plural(t.resolvidas, 'dose passada', 'doses passadas')} desde o início do plano.`;
}

function cartaoTaxaDoMes(dados) {
  return h('section', { class: 'cartao cartao-taxa', 'aria-labelledby': 'titulo-taxa' },
    h('h2', { id: 'titulo-taxa', class: 'cartao-taxa-titulo' }, 'Taxa do mês'),
    h('p', { class: 'taxa-numero' }, textoTaxa(dados.taxa)),
    barraDaTaxa(dados.taxa),
    h('p', {}, resumoDaTaxaDoMes(dados)),
    h('p', {}, `${dados.tomadas} tomadas declaradas · ${dados.naoTomadas} não tomadas declaradas · ${dados.semConfirmacao} sem confirmação.`));
}

// UC-03 A3: o seletor troca entre a taxa geral e a de um medicamento.
function cartaoTaxaAtual(atual, medicamentos, escolhido, aoEscolher) {
  const nome = escolhido ? P.tituloItem(medicamentos.find((m) => m.chave === escolhido).item) : 'Geral';
  return h('section', { class: 'cartao cartao-taxa', 'aria-labelledby': 'titulo-taxa-atual' },
    h('h2', { id: 'titulo-taxa-atual', class: 'cartao-taxa-titulo' }, 'Taxa atual'),
    h('label', { class: 'sr-only', for: 'taxa-atual-medicamento' }, 'Calcular a taxa atual para'),
    h('select', {
      id: 'taxa-atual-medicamento',
      class: 'seletor nao-imprimir',
      onchange: (e) => aoEscolher(e.target.value || null),
    },
    h('option', { value: '', selected: !escolhido }, 'Geral'),
    medicamentos.map((m) => h('option', { value: m.chave, selected: m.chave === escolhido }, P.tituloItem(m.item)))),
    h('p', { class: 'so-impressao' }, nome),
    h('p', { class: 'taxa-numero' }, textoTaxa(atual.taxa)),
    barraDaTaxa(atual.taxa),
    h('p', {}, resumoDaTaxaAtual(atual)),
    h('p', {}, `${atual.tomadas} tomadas declaradas · ${atual.naoTomadas} não tomadas declaradas · ${atual.semConfirmacao} sem confirmação.`));
}

// Só na impressão: quem, quando e a taxa atual de cada medicamento.
function cabecalhoDoRelatorio(usuario, agora, mes) {
  return h('div', { class: 'so-impressao relatorio-cabecalho' },
    h('p', { class: 'relatorio-titulo' }, `AlarMed · Relatório de adesão · ${mesPorExtenso(mes)}`),
    h('p', {}, `Paciente: ${usuario?.nome ?? '—'}`),
    h('p', {}, `Gerado em ${dataBR(dataISO(agora))}, às ${horaHM(agora)}.`));
}

function tabelaPorMedicamento(itens, registros, agora, medicamentos) {
  const linhas = [{ nome: 'Geral', t: calcularTaxaAtual(itens, registros, agora) },
    ...medicamentos.map((m) => ({ nome: P.tituloItem(m.item), t: calcularTaxaAtual(itens, registros, agora, m.chave) }))];
  return h('section', { class: 'so-impressao relatorio-tabela' },
    h('h2', {}, 'Taxa atual por medicamento'),
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Medicamento'), h('th', { scope: 'col' }, 'Taxa atual'),
        h('th', { scope: 'col' }, 'Tomadas / doses passadas'))),
      h('tbody', {}, linhas.map(({ nome, t }) => h('tr', {},
        h('td', {}, nome), h('td', {}, textoTaxa(t.taxa)), h('td', {}, `${t.tomadas} / ${t.resolvidas}`))))));
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

    const medicamentos = medicamentosDoPlano(itens);
    if (estado.medicamento && !medicamentos.some((m) => m.chave === estado.medicamento)) estado.medicamento = null;
    const atual = calcularTaxaAtual(itens, registros, agora, estado.medicamento);

    const anterior = somarMeses(mes, -1);
    const seguinte = somarMeses(mes, 1);
    const irPara = (m) => ctx.navegar(m === mesAtual ? '/painel' : `/painel?mes=${m}`);

    const escolherDia = (data) => {
      estado.diaSelecionado = estado.diaSelecionado === data ? null : data;
      ctx.atualizar();
    };

    const escolherMedicamento = (chave) => {
      estado.medicamento = chave;
      ctx.atualizar({ focarEm: '#taxa-atual-medicamento' });
    };

    return h('section', { class: 'tela tela-painel' },
      cabecalhoDoRelatorio(ctx.usuario, agora, mes),
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
      h('div', { class: 'taxas' },
        cartaoTaxaDoMes(dados),
        cartaoTaxaAtual(atual, medicamentos, estado.medicamento, escolherMedicamento)),
      dados.taxa === null && ehAtual && aviso({
        tipo: 'info', icone: 'info',
        texto: 'A taxa aparece quando as primeiras doses forem registradas ou passarem do prazo de 2 horas.',
      }),
      h('section', { class: 'cartao cartao-calendario', 'aria-label': 'Dias do mês' },
        calendario(dados, estado.diaSelecionado, escolherDia),
        legenda()),
      h('p', {}, resumoDosDias(dados, ehAtual)),
      detalheDoDia(diaEscolhido),
      tabelaPorMedicamento(itens, registros, agora, medicamentos),
      h('p', { class: 'nota' }, 'Taxa = tomadas declaradas ÷ (tomadas declaradas + não tomadas declaradas + sem confirmação). Pendentes e futuras ficam fora. Sem confirmação significa ausência de declaração, não comprova que o remédio deixou de ser tomado. As taxas não comprovam adesão clínica.'),
      botao({
        texto: 'Imprimir ou salvar em PDF',
        icone: 'compartilhar',
        variante: 'secundario',
        classe: 'nao-imprimir',
        foco: 'exportar',
        aoClicar: () => window.print(),
      }));
  },
};
