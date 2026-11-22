// P03 · Doses de hoje (RF004, RN02, UC-02).
// Tomei / Não tomei só na janela de 2 h. Corrigir e Desfazer também só na janela.

import { h, cabecalho, botao, botaoTexto, selo, aviso, vazio } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { mostrarToast } from '../ui/toast.js';
import { diaPorExtenso, tempoRestante, plural } from '../ui/formato.js';
import * as P from '../dominio/plano.js';
import * as D from '../dominio/doses.js';
import { dosesComEstado, resumirDia } from '../dominio/adesao.js';
import { dataISO, horaHM, somarDias } from '../dominio/tempo.js';
import * as notificacoes from '../notificacoes.js';

export function idDoCartao(idDose) {
  return `dose-${idDose.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function detalhe(d, agora) {
  if (d.estado === D.ESTADOS.TOMADA) return `Registrada às ${horaHM(d.registradoEm)}`;
  if (d.estado === D.ESTADOS.NAO_TOMADA) {
    return d.automatica
      ? `Sem registro até ${horaHM(d.registrarAte)}. O prazo terminou.`
      : `Marcada às ${horaHM(d.registradoEm)}`;
  }
  if (d.estado === D.ESTADOS.PENDENTE) return `Registre até as ${horaHM(d.registrarAte)} · ${tempoRestante(d.registrarAte - agora)}`;
  return `Lembrete às ${d.hora}`;
}

function cartaoDose(d, { agora, destaque, acoes }) {
  const titulo = P.tituloItem(d.item);
  const idTitulo = `${idDoCartao(d.id)}-titulo`;
  const corrigivel = D.podeCorrigir(d, d.registro, agora);
  return h('li', {},
    h('article', {
      id: idDoCartao(d.id),
      class: `cartao-dose estado-${d.estado}${destaque ? ' destaque' : ''}`,
      tabindex: '-1',
      'aria-labelledby': idTitulo,
    },
    h('div', { class: 'dose-topo' },
      h('p', { class: 'dose-hora' }, h('time', { datetime: `${d.data}T${d.hora}` }, d.hora)),
      h('div', { class: 'dose-textos' },
        h('h3', { id: idTitulo, class: 'dose-titulo' }, titulo),
        h('p', {}, P.linhaDose(d.item)),
        d.item.obs && h('p', { class: 'texto-suave' }, d.item.obs)),
      d.item.foto && h('img', { class: 'dose-foto', src: d.item.foto, alt: '', width: 64, height: 64 })),
    h('div', { class: 'dose-estado' },
      selo(d.estado),
      h('span', { class: 'dose-detalhe' }, detalhe(d, agora))),
    d.estado === D.ESTADOS.PENDENTE && h('div', { class: 'dose-acoes' },
      botao({
        texto: 'Tomei', icone: 'check', aoClicar: () => acoes.registrar(d, 'tomada'),
        rotulo: `Tomei a dose das ${d.hora} de ${titulo}`, foco: `tomei-${d.id}`,
      }),
      botao({
        texto: 'Não tomei', icone: 'x', variante: 'secundario', aoClicar: () => acoes.registrar(d, 'nao_tomada'),
        rotulo: `Não tomei a dose das ${d.hora} de ${titulo}`, foco: `nao-${d.id}`,
      })),
    corrigivel && botaoTexto({
      texto: 'Corrigir registro', icone: 'desfazer', aoClicar: () => acoes.corrigir(d),
      rotulo: `Corrigir o registro da dose das ${d.hora} de ${titulo}`, foco: `corrigir-${d.id}`,
    })));
}

function cartaoLembretes(ctx) {
  const situacao = notificacoes.situacao();
  const simulacao = h('a', { class: 'link-simulacao', href: '#/notificacao' }, 'Ver como o lembrete aparece');
  if (situacao === 'concedida') {
    const falha = notificacoes.houveFalhaRecente();
    return aviso({
      tipo: falha ? 'alerta' : 'sucesso', icone: 'sino',
      titulo: falha ? 'Confira suas doses' : 'Lembretes ativos neste aparelho',
      texto: falha ? 'Um ou mais lembretes recentes não tiveram o envio confirmado pelo serviço. Confira os horários e registros abaixo.'
        : ctx.api.modoReal ? 'Este aparelho está inscrito para receber avisos mesmo com o AlarMed fechado.'
        : 'Deixe o AlarMed aberto ou em segundo plano para receber os avisos.',
      filhos: simulacao,
    });
  }
  if (situacao === 'pendente') {
    return aviso({
      tipo: 'info', icone: 'sino', titulo: 'Ative os lembretes',
      texto: 'Assim o aparelho avisa no horário de cada dose.',
      filhos: [
        botao({
          texto: 'Ativar lembretes', icone: 'sino', largo: false, foco: 'ativar-lembretes',
          aoClicar: async () => {
            const resposta = await notificacoes.ativar(ctx.api);
            if (resposta === 'granted') {
              mostrarToast('Lembretes ativados neste aparelho.');
              notificacoes.verificarLembretes(ctx.api);
            }
            ctx.atualizar();
          },
        }),
        simulacao,
      ],
    });
  }
  if (situacao === 'negada') {
    return aviso({
      tipo: 'alerta', icone: 'alerta', titulo: 'Lembretes bloqueados',
      texto: 'Este navegador bloqueou as notificações do AlarMed. Para receber avisos, libere as notificações nas configurações do navegador.',
      filhos: simulacao,
    });
  }
  if (situacao === 'servidor-desativado' || situacao === 'falha') {
    return aviso({ tipo: 'alerta', icone: 'alerta', titulo: 'Lembretes ainda não estão ativos',
      texto: situacao === 'servidor-desativado'
        ? 'O envio de lembretes ainda não foi configurado. Você pode continuar registrando suas doses.'
        : 'Não foi possível inscrever este aparelho. Confira sua conexão e tente ativar os lembretes novamente.',
      filhos: botao({ texto: 'Tentar ativar lembretes', aoClicar: async () => {
        await notificacoes.ativar(ctx.api); ctx.atualizar();
      } }) });
  }
  if (situacao === 'ios-instalar') {
    return aviso({
      tipo: 'info', icone: 'compartilhar', titulo: 'No iPhone, instale o AlarMed',
      texto: 'Os lembretes só funcionam com o app na Tela de Início: toque em Compartilhar e depois em “Adicionar à Tela de Início”. Requer iOS 16.4 ou mais recente.',
      filhos: simulacao,
    });
  }
  return aviso({
    tipo: 'neutro', icone: 'info', titulo: 'Este navegador não mostra lembretes',
    texto: 'Use uma versão recente do Chrome, Edge, Firefox ou Safari.',
    filhos: simulacao,
  });
}

function textoResumo(r) {
  if (r.total === 0) return 'Nenhuma dose para registrar hoje.';
  const partes = [plural(r.tomadas, 'tomada', 'tomadas'), plural(r.naoTomadas, 'não tomada', 'não tomadas')];
  const abertas = r.pendentes + r.programadas;
  if (abertas) partes.push(`${abertas} a registrar`);
  return `${plural(r.total, 'dose', 'doses')} hoje: ${partes.join(', ')}.`;
}

// Horários de hoje anteriores à confirmação do plano não viram dose.
function avisoDoInicio(plano, hoje) {
  const afetados = P.itensConfirmados(plano).filter((i) => i.inicio === hoje
    && i.horarios.some((hh) => hh < horaHM(new Date(i.vigenteDesde))));
  if (!afetados.length) return null;
  const inicio = new Date(Math.min(...afetados.map((i) => new Date(i.vigenteDesde).getTime())));
  return aviso({
    tipo: 'neutro', icone: 'info',
    texto: `O plano vale a partir da confirmação, hoje às ${horaHM(inicio)}. Os horários antes disso não entram nas doses de hoje.`,
  });
}

export default {
  titulo: () => 'Doses de hoje',
  aba: 'hoje',

  async render(ctx) {
    const { agora, plano } = ctx;
    const registros = ctx.api.modoReal ? null : await ctx.api.listarRegistros();
    const itens = D.todosOsItens(plano);
    const hoje = dataISO(agora);
    const reais = ctx.api.modoReal ? await ctx.api.listarDoses(somarDias(hoje, -1), hoje) : null;
    const doses = reais ? reais.filter(d => d.data === hoje) : dosesComEstado(itens, registros, hoje, agora);
    const deOntem = (reais ? reais.filter(d => d.data === somarDias(hoje, -1))
      : dosesComEstado(itens, registros, somarDias(hoje, -1), agora))
      .filter((d) => d.estado === D.ESTADOS.PENDENTE || D.podeCorrigir(d, d.registro, agora));
    const destaque = ctx.rota.consulta.get('dose');

    const acoes = {
      registrar: async (d, status) => {
        try {
          await ctx.api.registrarDose(d.id, status);
          mostrarToast(status === 'tomada' ? 'Dose registrada como tomada.' : 'Dose registrada como não tomada.', {
            acao: {
              rotulo: 'Desfazer', icone: 'desfazer',
              aoClicar: async () => {
                try {
                  await ctx.api.desfazerRegistro(d.id);
                } catch (e) {
                  mostrarToast(e.message, { tipo: 'erro' });
                }
                ctx.atualizar({ focarEm: `#${idDoCartao(d.id)}` });
              },
            },
          });
        } catch (e) {
          mostrarToast(e.message, { tipo: 'erro' });
        }
        await ctx.atualizar({ focarEm: `#${idDoCartao(d.id)}` });
      },
      corrigir: async (d) => {
        try {
          await ctx.api.desfazerRegistro(d.id);
          mostrarToast('Registro desfeito. Escolha de novo: Tomei ou Não tomei.');
        } catch (e) {
          mostrarToast(e.message, { tipo: 'erro' });
        }
        await ctx.atualizar({ focarEm: `[data-foco="tomei-${CSS.escape(d.id)}"]` });
      },
    };

    const lista = (ds) => h('ul', { class: 'lista-doses' },
      ds.map((d) => cartaoDose(d, { agora, destaque: d.id === destaque, acoes })));

    return h('section', { class: 'tela' },
      cabecalho({
        sobretitulo: `${diaPorExtenso(agora)} · agora ${horaHM(agora)}`,
        titulo: 'Doses de hoje',
        subtitulo: textoResumo(resumirDia(doses)),
      }),
      cartaoLembretes(ctx),
      h('p', { class: 'regra-janela' }, icone('relogio', { tamanho: 20 }),
        h('span', {}, 'Dá para registrar até 2 horas depois do horário. Depois disso, a dose conta como não tomada.')),
      avisoDoInicio(plano, hoje),
      deOntem.length > 0 && h('section', { class: 'secao', 'aria-labelledby': 'titulo-ontem' },
        h('h2', { id: 'titulo-ontem' }, 'Ainda de ontem'),
        lista(deOntem)),
      h('section', { class: 'secao', 'aria-labelledby': 'titulo-hoje' },
        h('h2', { id: 'titulo-hoje', class: deOntem.length ? null : 'sr-only' }, 'Hoje'),
        doses.length ? lista(doses) : vazio('Nenhuma dose hoje.')));
  },

  // Veio da notificação: rola até a dose e põe o foco nela.
  depois(ctx) {
    const id = ctx.rota.consulta.get('dose');
    if (!id) return;
    const cartao = document.getElementById(idDoCartao(id));
    if (cartao && document.activeElement?.tagName === 'H1') {
      cartao.scrollIntoView({ block: 'center' });
      cartao.focus({ preventScroll: true });
    }
  },
};
