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

// O id da dose tem "@" e ":" (ex.: "i1@2026-10-17T08:00"), que não servem num id de HTML.
// Troca esses caracteres por "_" para o cartão poder ser achado e focado.
export function idDoCartao(idDose) {
  return `dose-${idDose.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

// Frase que aparece ao lado do selo, conforme o estado da dose.
function detalhe(d, agora) {
  if (d.estado === D.ESTADOS.TOMADA) {
    return `Registrada às ${horaHM(d.registradoEm)}`;
  }
  if (d.estado === D.ESTADOS.SEM_CONFIRMACAO) {
    return `Sem registro até ${horaHM(d.registrarAte)}. Não há declaração de consumo.`;
  }
  if (d.estado === D.ESTADOS.NAO_TOMADA) {
    return `Marcada às ${horaHM(d.registradoEm)}`;
  }
  if (d.estado === D.ESTADOS.PENDENTE) {
    // Mostra até que horas dá para registrar e quanto tempo falta.
    const falta = tempoRestante(d.registrarAte - agora);
    return `Registre até as ${horaHM(d.registrarAte)} · ${falta}`;
  }
  // Programada: o horário ainda não chegou.
  return `Lembrete às ${d.hora}`;
}

function cartaoDose(d, { agora, destaque, acoes }) {
  const titulo = P.tituloItem(d.item);
  const idTitulo = `${idDoCartao(d.id)}-titulo`;
  // "Corrigir registro" só aparece se a dose já tem registro e a janela ainda está aberta.
  const corrigivel = D.podeCorrigir(d, d.registro, agora);

  // Topo do cartão: horário, nome do remédio, como tomar, observação e foto (as duas últimas opcionais).
  const topo = h('div', { class: 'dose-topo' },
    h('p', { class: 'dose-hora' }, h('time', { datetime: `${d.data}T${d.hora}` }, d.hora)),
    h('div', { class: 'dose-textos' },
      h('h3', { id: idTitulo, class: 'dose-titulo' }, titulo),
      h('p', {}, P.linhaDose(d.item)),
      d.item.obs && h('p', { class: 'texto-suave' }, d.item.obs)),
    d.item.foto && h('img', { class: 'dose-foto', src: d.item.foto, alt: '', width: 64, height: 64 }));

  // Estado sempre escrito e com ícone, nunca só pela cor (RNF001).
  const estado = h('div', { class: 'dose-estado' },
    selo(d.estado),
    h('span', { class: 'dose-detalhe' }, detalhe(d, agora)));

  // Botões de registro: só para a dose pendente (dentro da janela de 2 h).
  // O rótulo completo é o que o leitor de tela fala.
  const botoesDeRegistro = d.estado === D.ESTADOS.PENDENTE && h('div', { class: 'dose-acoes' },
    botao({
      texto: 'Tomei',
      icone: 'check',
      aoClicar: () => acoes.registrar(d, 'tomada'),
      rotulo: `Tomei a dose das ${d.hora} de ${titulo}`,
      foco: `tomei-${d.id}`,
    }),
    botao({
      texto: 'Não tomei',
      icone: 'x',
      variante: 'secundario',
      aoClicar: () => acoes.registrar(d, 'nao_tomada'),
      rotulo: `Não tomei a dose das ${d.hora} de ${titulo}`,
      foco: `nao-${d.id}`,
    }));

  const botaoCorrigir = corrigivel && botaoTexto({
    texto: 'Corrigir registro',
    icone: 'desfazer',
    aoClicar: () => acoes.corrigir(d),
    rotulo: `Corrigir o registro da dose das ${d.hora} de ${titulo}`,
    foco: `corrigir-${d.id}`,
  });

  // tabindex -1 deixa o cartão receber o foco quando o usuário vem da notificação.
  const cartao = h('article', {
    id: idDoCartao(d.id),
    class: `cartao-dose estado-${d.estado}${destaque ? ' destaque' : ''}`,
    tabindex: '-1',
    'aria-labelledby': idTitulo,
  }, topo, estado, botoesDeRegistro, botaoCorrigir);

  return h('li', {}, cartao);
}

// Aviso sobre os lembretes neste aparelho. Muda conforme a permissão de notificação
// e a inscrição de push (ver notificacoes.situacao()).
function cartaoLembretes(ctx) {
  const situacao = notificacoes.situacao();
  const simulacao = h('a', { class: 'link-simulacao', href: '#/notificacao' }, 'Ver como o lembrete aparece');

  // Permissão concedida: confirma que está tudo certo, ou avisa se algum envio recente falhou.
  if (situacao === 'concedida') {
    const falha = notificacoes.houveFalhaRecente();
    let texto;
    if (falha) {
      texto = 'Um ou mais lembretes recentes não tiveram o envio confirmado pelo serviço. Confira os horários e registros abaixo.';
    } else if (ctx.api.modoReal) {
      texto = 'Este aparelho está inscrito para receber avisos mesmo com o AlarMed fechado.';
    } else {
      // No modo de demonstração não há push: o aviso só sai com o app aberto.
      texto = 'Deixe o AlarMed aberto ou em segundo plano para receber os avisos.';
    }
    return aviso({
      tipo: falha ? 'alerta' : 'sucesso',
      icone: 'sino',
      titulo: falha ? 'Confira suas doses' : 'Lembretes ativos neste aparelho',
      texto,
      filhos: simulacao,
    });
  }

  // Ainda não pediu permissão: oferece o botão para ativar.
  if (situacao === 'pendente') {
    const ativar = async () => {
      const resposta = await notificacoes.ativar(ctx.api);
      if (resposta === 'granted') {
        mostrarToast('Lembretes ativados neste aparelho.');
        notificacoes.verificarLembretes(ctx.api);
      }
      ctx.atualizar();
    };
    return aviso({
      tipo: 'info',
      icone: 'sino',
      titulo: 'Ative os lembretes',
      texto: 'Assim o aparelho avisa no horário de cada dose.',
      filhos: [
        botao({ texto: 'Ativar lembretes', icone: 'sino', largo: false, foco: 'ativar-lembretes', aoClicar: ativar }),
        simulacao,
      ],
    });
  }

  // O usuário bloqueou as notificações: só ele pode liberar, nas configurações do navegador.
  if (situacao === 'negada') {
    return aviso({
      tipo: 'alerta',
      icone: 'alerta',
      titulo: 'Lembretes bloqueados',
      texto: 'Este navegador bloqueou as notificações do AlarMed. Para receber avisos, libere as notificações nas configurações do navegador.',
      filhos: simulacao,
    });
  }

  // O servidor não tem as chaves de push configuradas, ou a inscrição falhou.
  if (situacao === 'servidor-desativado' || situacao === 'falha') {
    const texto = situacao === 'servidor-desativado'
      ? 'O envio de lembretes ainda não foi configurado. Você pode continuar registrando suas doses.'
      : 'Não foi possível inscrever este aparelho. Confira sua conexão e tente ativar os lembretes novamente.';
    const tentarDeNovo = async () => {
      await notificacoes.ativar(ctx.api);
      ctx.atualizar();
    };
    return aviso({
      tipo: 'alerta',
      icone: 'alerta',
      titulo: 'Lembretes ainda não estão ativos',
      texto,
      filhos: botao({ texto: 'Tentar ativar lembretes', aoClicar: tentarDeNovo }),
    });
  }

  // No iPhone, o push só funciona com o app instalado na Tela de Início.
  if (situacao === 'ios-instalar') {
    return aviso({
      tipo: 'info',
      icone: 'compartilhar',
      titulo: 'No iPhone, instale o AlarMed',
      texto: 'Os lembretes só funcionam com o app na Tela de Início: toque em Compartilhar e depois em “Adicionar à Tela de Início”. Requer iOS 16.4 ou mais recente.',
      filhos: simulacao,
    });
  }

  // Navegador sem suporte a notificações.
  return aviso({
    tipo: 'neutro',
    icone: 'info',
    titulo: 'Este navegador não mostra lembretes',
    texto: 'Use uma versão recente do Chrome, Edge, Firefox ou Safari.',
    filhos: simulacao,
  });
}

// Junta uma lista em português: ["a"] → "a"; ["a", "b", "c"] → "a, b e c".
function juntarComE(partes) {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
}

// Resumo do dia, embaixo do título. Ex.: "3 doses hoje: 1 tomada e 2 a registrar."
function textoResumo(r) {
  if (r.total === 0) return 'Nenhuma dose para registrar hoje.';

  // Só entram as contagens maiores que zero, para a frase ficar curta.
  const partes = [];
  if (r.tomadas) partes.push(plural(r.tomadas, 'tomada', 'tomadas'));
  if (r.naoTomadas) partes.push(plural(r.naoTomadas, 'não tomada declarada', 'não tomadas declaradas'));
  if (r.semConfirmacao) partes.push(plural(r.semConfirmacao, 'sem confirmação', 'sem confirmação'));
  // Pendentes e programadas ainda podem ser registradas.
  const abertas = r.pendentes + r.programadas;
  if (abertas) partes.push(`${abertas} a registrar`);

  return `${plural(r.total, 'dose', 'doses')} hoje: ${juntarComE(partes)}.`;
}

// No dia em que o plano é confirmado, os horários anteriores à confirmação não viram dose.
// Este aviso explica por que, por exemplo, a dose das 8h não aparece num plano confirmado às 10h.
function avisoDoInicio(plano, hoje) {
  // Itens que começam hoje e têm algum horário antes do momento da confirmação.
  const afetados = P.itensConfirmados(plano).filter((item) => {
    if (item.inicio !== hoje) return false;
    const horaDaConfirmacao = horaHM(new Date(item.vigenteDesde));
    return item.horarios.some((horario) => horario < horaDaConfirmacao);
  });
  if (!afetados.length) return null;

  // Usa a confirmação mais cedo entre os itens afetados.
  const instantes = afetados.map((item) => new Date(item.vigenteDesde).getTime());
  const inicio = new Date(Math.min(...instantes));

  return aviso({
    tipo: 'neutro',
    icone: 'info',
    texto: `O plano vale a partir da confirmação, hoje às ${horaHM(inicio)}. Os horários antes disso não entram nas doses de hoje.`,
  });
}

export default {
  titulo: () => 'Doses de hoje',
  aba: 'hoje',

  async render(ctx) {
    const { agora, plano } = ctx;
    const hoje = dataISO(agora);
    const ontem = somarDias(hoje, -1);

    // 1. Busca as doses de hoje e de ontem.
    let doses;
    let dosesDeOntem;
    if (ctx.api.modoReal) {
      // Com a API real, o servidor já devolve cada dose com o estado calculado.
      const doServidor = await ctx.api.listarDoses(ontem, hoje);
      doses = doServidor.filter((d) => d.data === hoje);
      dosesDeOntem = doServidor.filter((d) => d.data === ontem);
    } else {
      // No modo de demonstração, as doses são calculadas aqui, a partir do plano e dos registros.
      const registros = await ctx.api.listarRegistros();
      const itens = D.todosOsItens(plano);
      doses = dosesComEstado(itens, registros, hoje, agora);
      dosesDeOntem = dosesComEstado(itens, registros, ontem, agora);
    }

    // De ontem, só aparecem as doses que ainda aceitam registro ou correção (ex.: a das 23h, de madrugada).
    const deOntem = dosesDeOntem.filter((d) => d.estado === D.ESTADOS.PENDENTE || D.podeCorrigir(d, d.registro, agora));

    // Dose vinda da notificação (#/hoje?dose=...), que ganha destaque.
    const destaque = ctx.rota.consulta.get('dose');

    // 2. O que acontece ao tocar nos botões dos cartões.
    // Depois de cada ação a tela é redesenhada, e o foco volta para o mesmo cartão.
    const focoNoCartao = (d) => `#${idDoCartao(d.id)}`;

    const desfazer = async (d) => {
      try {
        await ctx.api.desfazerRegistro(d.id);
      } catch (e) {
        mostrarToast(e.message, { tipo: 'erro' });
      }
      ctx.atualizar({ focarEm: focoNoCartao(d) });
    };

    const acoes = {
      // Registra Tomei ou Não tomei e oferece "Desfazer" no aviso que aparece embaixo.
      registrar: async (d, status) => {
        try {
          await ctx.api.registrarDose(d.id, status);
          const mensagem = status === 'tomada' ? 'Dose registrada como tomada.' : 'Dose registrada como não tomada.';
          mostrarToast(mensagem, {
            acao: { rotulo: 'Desfazer', icone: 'desfazer', aoClicar: () => desfazer(d) },
          });
        } catch (e) {
          // Ex.: o prazo de 2 h terminou enquanto a tela estava aberta.
          mostrarToast(e.message, { tipo: 'erro' });
        }
        await ctx.atualizar({ focarEm: focoNoCartao(d) });
      },

      // Corrigir = apagar o registro e escolher de novo, ainda dentro da janela.
      corrigir: async (d) => {
        try {
          await ctx.api.desfazerRegistro(d.id);
          mostrarToast('Registro desfeito. Escolha de novo: Tomei ou Não tomei.');
        } catch (e) {
          mostrarToast(e.message, { tipo: 'erro' });
        }
        // O foco vai direto para o botão "Tomei" do mesmo cartão.
        await ctx.atualizar({ focarEm: `[data-foco="tomei-${CSS.escape(d.id)}"]` });
      },
    };

    const lista = (ds) => h('ul', { class: 'lista-doses' },
      ds.map((d) => cartaoDose(d, { agora, destaque: d.id === destaque, acoes })));

    // 3. Monta a tela: cabeçalho com o resumo, aviso dos lembretes, regra da janela,
    // doses de ontem ainda abertas (se houver) e doses de hoje.
    const regraDaJanela = h('p', { class: 'regra-janela' },
      icone('relogio', { tamanho: 20 }),
      h('span', {}, 'Dá para registrar até 2 horas depois do horário. Depois disso, a dose fica sem confirmação.'));

    const secaoDeOntem = deOntem.length > 0 && h('section', { class: 'secao', 'aria-labelledby': 'titulo-ontem' },
      h('h2', { id: 'titulo-ontem' }, 'Ainda de ontem'),
      lista(deOntem));

    // O título "Hoje" só aparece na tela quando há a seção "Ainda de ontem"; senão, fica só para o leitor de tela.
    const secaoDeHoje = h('section', { class: 'secao', 'aria-labelledby': 'titulo-hoje' },
      h('h2', { id: 'titulo-hoje', class: deOntem.length ? null : 'sr-only' }, 'Hoje'),
      doses.length ? lista(doses) : vazio('Nenhuma dose hoje.'));

    return h('section', { class: 'tela' },
      cabecalho({
        sobretitulo: `${diaPorExtenso(agora)} · agora ${horaHM(agora)}`,
        titulo: 'Doses de hoje',
        subtitulo: textoResumo(resumirDia(doses)),
      }),
      cartaoLembretes(ctx),
      regraDaJanela,
      avisoDoInicio(plano, hoje),
      secaoDeOntem,
      secaoDeHoje);
  },

  // Veio da notificação: rola até a dose e põe o foco nela.
  // Só faz isso se o foco ainda está no título, para não roubar o foco de quem já está usando a tela.
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
