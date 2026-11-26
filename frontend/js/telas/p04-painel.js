// P04 · Painel do mês (RF005, UC-03).
// Taxa = tomadas ÷ (tomadas + não tomadas declaradas + sem confirmação).
// Sem confirmação aparece contada à parte; cada dia do calendário tem 3 agregados (F08).
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

// Cabeçalho do calendário: a letra aparece na tela e o nome completo vai para o leitor de tela.
const SEMANA = [
  ['D', 'domingo'], ['S', 'segunda-feira'], ['T', 'terça-feira'], ['Q', 'quarta-feira'],
  ['Q', 'quinta-feira'], ['S', 'sexta-feira'], ['S', 'sábado'],
];

// Como cada dia aparece no calendário e na legenda.
const AGREGADOS = {
  todas: { rotulo: 'Todas registradas como tomadas', icone: 'check' },
  parte: { rotulo: 'Parte registrada como tomada', icone: 'meio' },
  nenhuma: { rotulo: 'Nenhuma registrada como tomada', icone: 'x' },
};

// Nota que explica a fórmula embaixo do painel (também sai no relatório impresso).
const NOTA_DA_TAXA = 'Taxa = tomadas declaradas ÷ (tomadas declaradas + não tomadas declaradas + sem confirmação). '
  + 'Pendentes e futuras ficam fora. Sem confirmação significa ausência de declaração, não comprova que o remédio '
  + 'deixou de ser tomado. As taxas não comprovam adesão clínica.';

// Frase que o leitor de tela fala para cada dia do calendário, já que a cor e o ícone não bastam.
function descreverDia(dia) {
  const r = dia.resumo;
  const quando = `${diaMesPorExtenso(dia.data)}${dia.hoje ? ', hoje' : ''}`;

  if (r.agregado === 'sem_doses') return `${quando}: sem doses no plano`;
  if (dia.futuro) return `${quando}: ${plural(r.total, 'dose programada', 'doses programadas')}`;
  if (r.agregado === 'em_andamento') return `${quando}: ${r.tomadas} de ${r.total} tomadas até agora`;
  if (r.agregado === 'todas') return `${quando}: todas as ${r.total} doses tomadas`;
  if (r.agregado === 'nenhuma') {
    return `${quando}: nenhuma das ${r.total} doses registrada como tomada; ${r.semConfirmacao} sem confirmação`;
  }
  // Agregado "parte".
  return `${quando}: ${r.tomadas} de ${r.total} doses tomadas`;
}

// Uma célula do calendário. Dia sem doses é só um número; os outros viram botão,
// que abre o detalhe do dia embaixo do calendário.
function celula(dia, selecionado, aoEscolher) {
  const tipo = dia.futuro ? 'futuro' : dia.resumo.agregado;
  const marcador = AGREGADOS[tipo];

  let classes = `dia dia-${tipo}`;
  if (dia.hoje) classes += ' dia-hoje';
  if (selecionado) classes += ' dia-selecionado';

  const numero = h('span', { class: 'dia-numero', 'aria-hidden': 'true' }, String(dia.dia));

  if (dia.resumo.agregado === 'sem_doses') {
    return h('td', {}, h('span', { class: classes, 'aria-label': descreverDia(dia) }, numero));
  }

  const botaoDoDia = h('button', {
    type: 'button',
    class: classes,
    'aria-label': descreverDia(dia),
    'aria-pressed': String(selecionado),
    'data-foco': `dia-${dia.data}`,
    onclick: () => aoEscolher(dia.data),
  },
  numero,
  marcador && icone(marcador.icone, { tamanho: 14, classe: 'dia-marcador' }));

  return h('td', {}, botaoDoDia);
}

// Calendário do mês numa tabela de 7 colunas, de domingo a sábado.
function calendario(mes, selecionada, aoEscolher) {
  const linhas = [];
  let semana = [];

  // Células vazias antes do dia 1, para ele cair no dia da semana certo.
  for (let i = 0; i < mes.primeiroDiaDaSemana; i += 1) {
    semana.push(h('td', {}));
  }

  // Preenche os dias e fecha uma linha a cada 7.
  for (const dia of mes.dias) {
    semana.push(celula(dia, dia.data === selecionada, aoEscolher));
    if (semana.length === 7) {
      linhas.push(h('tr', {}, semana));
      semana = [];
    }
  }

  // Completa a última semana com células vazias.
  if (semana.length) {
    while (semana.length < 7) semana.push(h('td', {}));
    linhas.push(h('tr', {}, semana));
  }

  const cabecalhoDaSemana = h('tr', {},
    SEMANA.map(([letra, nome]) => h('th', { scope: 'col' }, h('abbr', { title: nome }, letra))));

  return h('table', { class: 'calendario', 'aria-label': `Calendário de ${mesPorExtenso(mes.mes)}` },
    h('thead', {}, cabecalhoDaSemana),
    h('tbody', {}, linhas));
}

function legenda() {
  // Os três agregados do dia, com a mesma cor e o mesmo ícone do calendário.
  const itensDosAgregados = Object.entries(AGREGADOS).map(([tipo, agregado]) => h('li', {},
    h('span', { class: `amostra dia-${tipo}`, 'aria-hidden': 'true' }, icone(agregado.icone, { tamanho: 14 })),
    agregado.rotulo));

  return h('ul', { class: 'legenda', 'aria-label': 'Legenda' },
    itensDosAgregados,
    h('li', {}, h('span', { class: 'amostra dia-sem_doses', 'aria-hidden': 'true' }), 'Sem doses'),
    h('li', {}, h('span', { class: 'amostra dia-futuro dia-hoje', 'aria-hidden': 'true' }), 'Hoje'));
}

// Frase embaixo do calendário: quantos dias tiveram todas, parte ou nenhuma dose tomada.
function resumoDosDias(mes, atual) {
  const { todas, parte, nenhuma } = mes.contagem;
  if (todas + parte + nenhuma === 0) return 'Ainda não há dias completos neste mês.';

  // No mês corrente o resumo é parcial; nos meses passados, é do mês inteiro.
  const inicio = atual ? 'Até agora' : 'No mês';
  const diasCompletos = plural(todas, 'dia', 'dias');
  return `${inicio}: ${diasCompletos} com todas as doses registradas como tomadas, ${parte} com parte e ${nenhuma} sem registro de tomada.`;
}

// Barra horizontal com a porcentagem. Sem taxa (null), não desenha nada.
function barraDaTaxa(taxa) {
  if (taxa === null) return false;
  const largura = Math.round(taxa * 100);
  return h('div', { class: 'taxa-barra', 'aria-hidden': 'true' },
    h('span', { style: `width: ${largura}%` }));
}

function resumoDaTaxaDoMes(t) {
  if (t.taxa === null) return 'Ainda não há doses declaradas ou com janela encerrada.';
  const final = t.resolvidas === 1
    ? 'dose que já passou foi registrada como tomada.'
    : 'doses que já passaram foram registradas como tomadas.';
  return `${t.tomadas} de ${t.resolvidas} ${final}`;
}

// UC-03 A4: sem doses passadas, avisa que ainda não dá para calcular.
function resumoDaTaxaAtual(t) {
  if (t.taxa === null) return 'Ainda não há doses passadas para calcular a taxa atual.';
  return `${t.tomadas} de ${plural(t.resolvidas, 'dose passada', 'doses passadas')} desde o início do plano.`;
}

// Contagem separada por desfecho, igual nos dois cartões de taxa.
function contagemPorDesfecho(t) {
  return `${t.tomadas} tomadas declaradas · ${t.naoTomadas} não tomadas declaradas · ${t.semConfirmacao} sem confirmação.`;
}

function cartaoTaxaDoMes(dados) {
  return h('section', { class: 'cartao cartao-taxa', 'aria-labelledby': 'titulo-taxa' },
    h('h2', { id: 'titulo-taxa', class: 'cartao-taxa-titulo' }, 'Taxa do mês'),
    h('p', { class: 'taxa-numero' }, textoTaxa(dados.taxa)),
    barraDaTaxa(dados.taxa),
    h('p', {}, resumoDaTaxaDoMes(dados)),
    h('p', {}, contagemPorDesfecho(dados)));
}

// UC-03 A3: o seletor troca entre a taxa geral e a de um medicamento.
function cartaoTaxaAtual(atual, medicamentos, escolhido, aoEscolher) {
  // Nome do que está escolhido; no papel o seletor some, então o nome aparece em texto.
  let nome = 'Geral';
  if (escolhido) {
    const medicamento = medicamentos.find((m) => m.chave === escolhido);
    nome = P.tituloItem(medicamento.item);
  }

  const opcoes = [
    h('option', { value: '', selected: !escolhido }, 'Geral'),
    ...medicamentos.map((m) => h('option', { value: m.chave, selected: m.chave === escolhido }, P.tituloItem(m.item))),
  ];
  // Opção vazia ("Geral") vira null: sem filtro de medicamento.
  const seletor = h('select', {
    id: 'taxa-atual-medicamento',
    class: 'seletor nao-imprimir',
    onchange: (e) => aoEscolher(e.target.value || null),
  }, opcoes);

  return h('section', { class: 'cartao cartao-taxa', 'aria-labelledby': 'titulo-taxa-atual' },
    h('h2', { id: 'titulo-taxa-atual', class: 'cartao-taxa-titulo' }, 'Taxa atual'),
    h('label', { class: 'sr-only', for: 'taxa-atual-medicamento' }, 'Calcular a taxa atual para'),
    seletor,
    h('p', { class: 'so-impressao' }, nome),
    h('p', { class: 'taxa-numero' }, textoTaxa(atual.taxa)),
    barraDaTaxa(atual.taxa),
    h('p', {}, resumoDaTaxaAtual(atual)),
    h('p', {}, contagemPorDesfecho(atual)));
}

// Só na impressão: quem, quando e de que mês é o relatório.
function cabecalhoDoRelatorio(usuario, agora, mes) {
  return h('div', { class: 'so-impressao relatorio-cabecalho' },
    h('p', { class: 'relatorio-titulo' }, `AlarMed · Relatório de adesão · ${mesPorExtenso(mes)}`),
    h('p', {}, `Paciente: ${usuario?.nome ?? '—'}`),
    h('p', {}, `Gerado em ${dataBR(dataISO(agora))}, às ${horaHM(agora)}.`));
}

// Só na impressão: a taxa atual geral e a de cada medicamento, numa tabela.
function tabelaPorMedicamento(itens, registros, agora, medicamentos) {
  // Primeira linha: a taxa geral. Depois, uma linha por medicamento.
  const linhas = [{ nome: 'Geral', t: calcularTaxaAtual(itens, registros, agora) }];
  for (const m of medicamentos) {
    linhas.push({ nome: P.tituloItem(m.item), t: calcularTaxaAtual(itens, registros, agora, m.chave) });
  }

  const cabecalhoDaTabela = h('tr', {},
    h('th', { scope: 'col' }, 'Medicamento'),
    h('th', { scope: 'col' }, 'Taxa atual'),
    h('th', { scope: 'col' }, 'Tomadas / doses passadas'));

  const corpo = linhas.map(({ nome, t }) => h('tr', {},
    h('td', {}, nome),
    h('td', {}, textoTaxa(t.taxa)),
    h('td', {}, `${t.tomadas} / ${t.resolvidas}`)));

  return h('section', { class: 'so-impressao relatorio-tabela' },
    h('h2', {}, 'Taxa atual por medicamento'),
    h('table', {}, h('thead', {}, cabecalhoDaTabela), h('tbody', {}, corpo)));
}

// Doses do dia escolhido no calendário, com o estado de cada uma.
function detalheDoDia(dia) {
  if (!dia) return null;

  const linhas = dia.doses.map((d) => h('li', { class: 'linha-dose' },
    h('span', { class: 'linha-dose-hora' }, d.hora),
    h('span', { class: 'linha-dose-nome' }, P.tituloItem(d.item)),
    selo(d.estado)));

  return h('section', { class: 'cartao detalhe-dia', 'aria-labelledby': 'titulo-dia', tabindex: '-1', id: 'detalhe-dia' },
    h('h2', { id: 'titulo-dia' }, diaPorExtenso(deDataHora(dia.data))),
    h('ul', { class: 'lista-simples' }, linhas));
}

export default {
  titulo: () => 'Painel do mês',
  aba: 'painel',

  async render(ctx) {
    const { agora, plano } = ctx;
    const registros = await ctx.api.listarRegistros();
    const itens = D.todosOsItens(plano);
    const estado = estadoUi.painel;

    // 1. Mês mostrado: o da URL (?mes=AAAA-MM), se for válido e tiver plano; senão, o mês atual.
    const meses = mesesDisponiveis(itens, agora);
    const pedido = ctx.rota.consulta.get('mes');
    const mesAtual = mesISO(agora);
    const mes = mesValido(pedido) && meses.includes(pedido) ? pedido : mesAtual;
    const ehAtual = mes === mesAtual;
    const dados = calcularMes(itens, registros, mes, agora);

    // 2. Dia aberto no detalhe. Ao trocar de mês, o dia escolhido antes é esquecido.
    if (estado.diaSelecionado && !estado.diaSelecionado.startsWith(mes)) {
      estado.diaSelecionado = null;
    }
    const diaEscolhido = dados.dias.find((d) => d.data === estado.diaSelecionado);

    // 3. Taxa atual, geral ou do medicamento escolhido.
    // Se o medicamento escolhido saiu da lista (outra conta, por exemplo), volta para "Geral".
    const medicamentos = medicamentosDoPlano(itens);
    const aindaExiste = medicamentos.some((m) => m.chave === estado.medicamento);
    if (estado.medicamento && !aindaExiste) estado.medicamento = null;
    const atual = calcularTaxaAtual(itens, registros, agora, estado.medicamento);

    // 4. Ações: trocar de mês, abrir ou fechar um dia, trocar o medicamento da taxa atual.
    const anterior = somarMeses(mes, -1);
    const seguinte = somarMeses(mes, 1);
    const irPara = (m) => ctx.navegar(m === mesAtual ? '/painel' : `/painel?mes=${m}`);

    const escolherDia = (data) => {
      // Tocar de novo no mesmo dia fecha o detalhe.
      estado.diaSelecionado = estado.diaSelecionado === data ? null : data;
      ctx.atualizar();
    };

    const escolherMedicamento = (chave) => {
      estado.medicamento = chave;
      ctx.atualizar({ focarEm: '#taxa-atual-medicamento' });
    };

    // 5. Monta a tela. Os botões de mês ficam desativados quando não há plano naquele mês.
    const navegacaoDeMes = h('nav', { class: 'mes-nav', 'aria-label': 'Escolher o mês' },
      h('button', {
        type: 'button',
        class: 'btn-icone',
        'aria-label': `Mês anterior, ${mesPorExtenso(anterior)}`,
        disabled: !meses.includes(anterior),
        'data-foco': 'mes-anterior',
        onclick: () => irPara(anterior),
      }, icone('voltar')),
      h('p', { class: 'mes-atual', 'aria-live': 'polite' }, mesPorExtenso(mes)),
      h('button', {
        type: 'button',
        class: 'btn-icone',
        'aria-label': `Próximo mês, ${mesPorExtenso(seguinte)}`,
        disabled: !meses.includes(seguinte),
        'data-foco': 'mes-seguinte',
        onclick: () => irPara(seguinte),
      }, icone('avancar')));

    // No mês corrente, sem nenhuma dose resolvida ainda, explica quando a taxa aparece.
    const avisoSemTaxa = dados.taxa === null && ehAtual && aviso({
      tipo: 'info',
      icone: 'info',
      texto: 'A taxa aparece quando as primeiras doses forem registradas ou passarem do prazo de 2 horas.',
    });

    return h('section', { class: 'tela tela-painel' },
      cabecalhoDoRelatorio(ctx.usuario, agora, mes),
      cabecalho({ titulo: 'Painel do mês' }),
      navegacaoDeMes,
      h('div', { class: 'taxas' },
        cartaoTaxaDoMes(dados),
        cartaoTaxaAtual(atual, medicamentos, estado.medicamento, escolherMedicamento)),
      avisoSemTaxa,
      h('section', { class: 'cartao cartao-calendario', 'aria-label': 'Dias do mês' },
        calendario(dados, estado.diaSelecionado, escolherDia),
        legenda()),
      h('p', {}, resumoDosDias(dados, ehAtual)),
      detalheDoDia(diaEscolhido),
      tabelaPorMedicamento(itens, registros, agora, medicamentos),
      h('p', { class: 'nota' }, NOTA_DA_TAXA),
      // window.print() abre a impressão do navegador, onde dá para salvar em PDF.
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
