// P01 · Cadastro do plano / Adicionar medicamento (RF002, RF008, RN01, UC-01, UC-04).
// Sem plano confirmado: cadastro inicial. Com plano: entra como alteração pendente.

import {
  h, fragmento, cabecalho, campo, grupoChips, botao, botaoTexto, cartaoItem,
  limparErroDoCampo, mensagemErro, vazio,
} from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { mostrarToast } from '../ui/toast.js';
import { reduzirFoto } from '../ui/foto.js';
import { camposDoErro } from '../api/erros.js';
import { estadoUi, limparFormularioDoCadastro, sairDaConta } from '../store.js';
import * as P from '../dominio/plano.js';
import { dataISO, horaValida } from '../dominio/tempo.js';

// Ordem dos campos na tela. Quando há erros, o foco vai para o primeiro desta lista.
const ORDEM_DOS_ERROS = ['nome', 'concentracao', 'qtd', 'horarios', 'duracao', 'obs'];

// Onde colocar o foco para cada campo com erro.
const SELETOR_DO_CAMPO = {
  nome: '#f-nome',
  concentracao: '#f-conc',
  qtd: '[data-foco="qtd-mais"]',
  horarios: '[data-foco^="horarios-"]',
  obs: '#f-obs',
};

function focoDoErro(campoComErro, form) {
  // A duração tem dois jeitos de mostrar o erro: na data ("até uma data") ou nos botões de opção.
  if (campoComErro === 'duracao') {
    return form.duracao?.tipo === 'ate' ? '#f-fim' : '[data-foco^="duracao-"]';
  }
  return SELETOR_DO_CAMPO[campoComErro];
}

// Quantidade por dose (botões − e +) e unidade (comprimido, gota, ...).
function blocoQuantidade(form, ctx) {
  // Soma ou subtrai 1, sem passar dos limites do domínio.
  const mudar = (delta) => {
    const nova = form.qtd + delta;
    form.qtd = Math.min(P.QTD_MAX, Math.max(P.QTD_MIN, nova));
    ctx.atualizar();
  };

  const contador = h('div', { class: 'contador' },
    h('button', {
      type: 'button',
      class: 'contador-botao',
      'aria-label': 'Diminuir quantidade',
      'data-foco': 'qtd-menos',
      disabled: form.qtd <= P.QTD_MIN,
      onclick: () => mudar(-1),
    }, icone('menos')),
    // aria-live faz o leitor de tela anunciar o novo número a cada toque.
    h('output', { class: 'contador-valor', 'aria-labelledby': 'qtd-rotulo', 'aria-live': 'polite' }, String(form.qtd)),
    h('button', {
      type: 'button',
      class: 'contador-botao',
      'aria-label': 'Aumentar quantidade',
      'data-foco': 'qtd-mais',
      disabled: form.qtd >= P.QTD_MAX,
      onclick: () => mudar(1),
    }, icone('mais')));

  const unidade = grupoChips({
    id: 'unidade',
    rotulo: 'Unidade',
    opcoes: P.UNIDADES,
    selecionado: (o) => o.valor === form.unidade,
    aoEscolher: (o) => {
      form.unidade = o.valor;
      ctx.atualizar();
    },
  });

  return h('div', { class: 'grupo' },
    h('p', { id: 'qtd-rotulo', class: 'campo-rotulo' }, 'Quantidade por dose'),
    contador,
    unidade);
}

// Horários: grade com os horários mais comuns e um campo para incluir outro.
function blocoHorarios(estado, ctx) {
  const { form } = estado;

  // Horários fora da grade, incluídos pelo usuário, aparecem no fim, em ordem.
  const extras = form.horarios.filter((hora) => !P.GRADE_HORARIOS.includes(hora)).sort();
  const opcoes = [...P.GRADE_HORARIOS, ...extras].map((hora) => ({ valor: hora, rotulo: hora }));

  // Tocar num horário marca ou desmarca.
  const alternar = (hora) => {
    if (form.horarios.includes(hora)) {
      form.horarios = form.horarios.filter((x) => x !== hora);
    } else {
      form.horarios = [...form.horarios, hora];
    }
    estado.erros.horarios = null;
    ctx.atualizar();
  };

  // "Incluir" adiciona o horário digitado em "Outro horário".
  const incluir = () => {
    const hora = estado.horaExtra;
    if (!horaValida(hora)) {
      estado.erroHoraExtra = 'Escolha um horário no campo acima.';
      ctx.atualizar({ focarEm: '#f-hora' });
      return;
    }
    // Se o horário já estava marcado, não duplica.
    if (!form.horarios.includes(hora)) {
      form.horarios = [...form.horarios, hora];
    }
    estado.horaExtra = '';
    estado.erroHoraExtra = '';
    estado.erros.horarios = null;
    ctx.atualizar({ focarEm: `[data-foco="horarios-${hora}"]` });
  };

  const grade = grupoChips({
    id: 'horarios',
    rotulo: 'Horários',
    ajuda: 'Toque nos horários indicados na receita.',
    opcoes,
    grade: true,
    selecionado: (o) => form.horarios.includes(o.valor),
    aoEscolher: (o) => alternar(o.valor),
    erro: estado.erros.horarios,
  });

  const outroHorario = h('div', { class: 'linha-outro-horario' },
    campo({
      id: 'f-hora',
      rotulo: 'Outro horário',
      tipo: 'time',
      valor: estado.horaExtra,
      erro: estado.erroHoraExtra,
      aoDigitar: (e) => { estado.horaExtra = e.target.value; },
    }),
    botao({ texto: 'Incluir', variante: 'secundario', largo: false, aoClicar: incluir, foco: 'incluir-hora' }));

  return h('div', { class: 'bloco-horarios' }, grade, outroHorario);
}

// Por quanto tempo: uso contínuo, um número de dias ou até uma data.
function blocoDuracao(estado, ctx, hoje) {
  const { form } = estado;
  const atual = P.valorDaDuracao(form.duracao);
  const ateUmaData = form.duracao.tipo === 'ate';

  const opcoes = grupoChips({
    id: 'duracao',
    rotulo: 'Por quanto tempo',
    opcoes: P.OPCOES_DURACAO,
    selecionado: (o) => o.valor === atual,
    aoEscolher: (o) => {
      form.duracao = { ...o.duracao };
      estado.erros.duracao = null;
      // Ao escolher "Até uma data", o foco vai para o campo de data que aparece.
      ctx.atualizar(o.valor === 'ate' ? { focarEm: '#f-fim' } : {});
    },
    // Com "até uma data", o erro aparece no campo de data, não nas opções.
    erro: ateUmaData ? null : estado.erros.duracao,
  });

  // A data só não pode ser antes de hoje.
  const campoDaData = ateUmaData && campo({
    id: 'f-fim',
    rotulo: 'Último dia do tratamento',
    tipo: 'date',
    valor: form.duracao.fim,
    erro: estado.erros.duracao,
    atributos: { min: hoje },
    aoDigitar: (e) => {
      form.duracao = { tipo: 'ate', fim: e.target.value };
      limparErroDoCampo(e.target);
    },
  });

  return h('div', { class: 'bloco-duracao' }, opcoes, campoDaData);
}

// Foto da caixa (RF008), opcional. Fica guardada só no navegador, já reduzida.
function blocoFoto(estado, ctx) {
  const { form } = estado;

  // Reduz a foto escolhida antes de guardar, para não ocupar muito espaço.
  const escolher = async (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    try {
      form.foto = await reduzirFoto(arquivo);
      estado.erroFoto = '';
    } catch {
      estado.erroFoto = 'Não foi possível usar este arquivo. Escolha uma foto.';
    }
    ctx.atualizar({ focarEm: '#f-foto' });
  };

  // O campo de arquivo fica escondido; os botões visíveis são <label> ligados a ele.
  // capture="environment" abre a câmera traseira no celular.
  const entrada = h('input', {
    id: 'f-foto',
    class: 'sr-only',
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    'aria-describedby': 'foto-ajuda',
    onchange: escolher,
  });

  let conteudo;
  if (form.foto) {
    // Já tem foto: mostra a prévia, com "Trocar" e "Remover".
    const remover = () => {
      form.foto = null;
      ctx.atualizar({ focarEm: '#f-foto' });
    };
    conteudo = h('div', { class: 'foto-previa' },
      h('img', { src: form.foto, alt: 'Prévia da foto da caixa', width: 96, height: 96 }),
      h('div', { class: 'foto-acoes' },
        h('label', { class: 'btn btn-secundario seletor-foto', for: 'f-foto' }, icone('camera'), h('span', {}, 'Trocar foto')),
        entrada,
        botaoTexto({ texto: 'Remover foto', perigo: true, foco: 'remover-foto', aoClicar: remover })));
  } else {
    // Ainda sem foto: só o botão para tirar ou escolher.
    conteudo = h('div', {},
      h('label', { class: 'btn btn-secundario btn-largo seletor-foto', for: 'f-foto' },
        icone('camera'), h('span', {}, 'Tirar ou escolher foto')),
      entrada);
  }

  return h('div', { class: 'grupo bloco-foto' },
    h('p', { class: 'campo-rotulo', id: 'foto-rotulo' }, 'Foto da caixa (opcional)'),
    h('p', { class: 'campo-ajuda', id: 'foto-ajuda' }, 'Ajuda a reconhecer o remédio na hora da dose.'),
    conteudo,
    estado.erroFoto && mensagemErro('foto-erro', estado.erroFoto));
}

export default {
  titulo: (ctx) => (P.temPlanoConfirmado(ctx.plano) ? 'Adicionar medicamento' : 'Cadastro do plano'),

  async render(ctx) {
    // Com a API real, abrir o cadastro volta o plano do servidor para edição (EM_EDICAO).
    if (ctx.api.modoReal) await ctx.api.editarPlano();

    const estado = estadoUi.cadastro;
    const { form } = estado;
    // Com plano já confirmado, o que se adiciona aqui vira alteração pendente (UC-04).
    const alteracao = P.temPlanoConfirmado(ctx.plano);
    const hoje = dataISO(ctx.agora);
    const { itens } = P.compararAlteracao(ctx.plano);

    // "Adicionar à lista": envia o formulário; se algum campo estiver errado, mostra o erro nele.
    const adicionar = async () => {
      try {
        const item = await ctx.api.adicionarItem(form);
        limparFormularioDoCadastro();
        mostrarToast(`${P.tituloItem(item)} entrou na lista.`);
        await ctx.atualizar({ focarEm: '#titulo-lista' });
      } catch (e) {
        const campos = camposDoErro(e);
        // Erro que não é de campo (ex.: sem conexão): aparece num aviso.
        if (!campos) {
          mostrarToast(e.message, { tipo: 'erro' });
          return;
        }
        estado.erros = campos;
        const primeiro = ORDEM_DOS_ERROS.find((c) => campos[c]);
        await ctx.atualizar({ focarEm: focoDoErro(primeiro, form) });
      }
    };

    // Remover um remédio da lista, com "Desfazer" que o devolve à mesma posição.
    const remover = async (id) => {
      const { item, posicao } = await ctx.api.removerItem(id);
      const desfazer = async () => {
        await ctx.api.reinserirItem(item, posicao);
        ctx.atualizar();
      };
      mostrarToast(`${P.tituloItem(item)} saiu da lista.`, {
        acao: { rotulo: 'Desfazer', icone: 'desfazer', aoClicar: desfazer },
      });
      await ctx.atualizar({ focarEm: '#titulo-lista' });
    };

    // Formulário de um remédio. novalidate: as mensagens de erro são as nossas, não as do navegador.
    // Foto e observação só aparecem no modo de demonstração: o back-end ainda não tem esses campos.
    const formulario = h('form', {
      class: 'formulario',
      novalidate: true,
      'aria-label': 'Dados do remédio',
      onsubmit: (e) => {
        e.preventDefault();
        adicionar();
      },
    },
    campo({
      id: 'f-nome',
      rotulo: 'Nome do remédio',
      valor: form.nome,
      placeholder: 'Ex.: Losartana',
      icone: 'capsula',
      autocomplete: 'off',
      erro: estado.erros.nome,
      atributos: { maxlength: P.LIMITES.nome },
      aoDigitar: (e) => { form.nome = e.target.value; limparErroDoCampo(e.target); },
    }),
    campo({
      id: 'f-conc',
      rotulo: 'Concentração',
      ajuda: 'Fica ao lado do nome, na receita ou na caixa.',
      valor: form.concentracao,
      placeholder: 'Ex.: 50 mg',
      autocomplete: 'off',
      erro: estado.erros.concentracao,
      atributos: { maxlength: P.LIMITES.concentracao },
      aoDigitar: (e) => { form.concentracao = e.target.value; limparErroDoCampo(e.target); },
    }),
    blocoQuantidade(form, ctx),
    grupoChips({
      id: 'via',
      rotulo: 'Como tomar',
      opcoes: P.VIAS,
      selecionado: (o) => o.valor === form.via,
      aoEscolher: (o) => { form.via = o.valor; ctx.atualizar(); },
    }),
    blocoHorarios(estado, ctx),
    blocoDuracao(estado, ctx, hoje),
    !ctx.api.modoReal && blocoFoto(estado, ctx),
    !ctx.api.modoReal && campo({
      id: 'f-obs',
      rotulo: 'Observação da receita (opcional)',
      valor: form.obs,
      placeholder: 'Ex.: em jejum',
      autocomplete: 'off',
      erro: estado.erros.obs,
      atributos: { maxlength: P.LIMITES.obs },
      aoDigitar: (e) => { form.obs = e.target.value; limparErroDoCampo(e.target); },
    }),
    botao({ texto: 'Adicionar à lista', icone: 'mais', variante: 'secundario', tipo: 'submit', foco: 'adicionar' }));

    // Lista dos remédios já adicionados. Na alteração, mostra como o plano vai ficar.
    const tituloDaLista = `${alteracao ? 'Como o plano fica' : 'No plano'} (${itens.length})`;
    let conteudoDaLista;
    if (itens.length === 0) {
      conteudoDaLista = vazio('Nenhum remédio ainda. Preencha os campos acima e toque em “Adicionar à lista”.');
    } else {
      const cartoes = itens.map(({ item, novo }) => cartaoItem(item, {
        novo,
        aoRemover: () => remover(item.id),
        foco: `remover-${item.id}`,
      }));
      conteudoDaLista = h('div', { class: 'lista-itens' }, cartoes);
    }
    const lista = h('section', { class: 'secao', 'aria-labelledby': 'titulo-lista' },
      h('h2', { id: 'titulo-lista', tabindex: '-1' }, tituloDaLista),
      conteudoDaLista);

    // Rodapé fixo com "Revisar". Só libera com pelo menos um remédio (RN01);
    // na alteração, só quando algo mudou. A dica explica por que está desativado.
    const revisavel = P.podeRevisar(ctx.plano);
    const rotuloRevisar = alteracao ? 'Revisar alteração' : `Revisar plano (${itens.length})`;
    const dica = alteracao ? 'Inclua ou remova um remédio para revisar.' : 'Adicione pelo menos um remédio para revisar.';
    const rodape = h('div', { class: 'rodape-acoes' },
      h('div', { class: 'rodape-interno' },
        botao({
          texto: rotuloRevisar,
          desabilitado: !revisavel,
          aoClicar: () => ctx.navegar('/revisao'),
          atributos: { 'aria-describedby': revisavel ? null : 'dica-revisar' },
        }),
        !revisavel && h('p', { id: 'dica-revisar', class: 'rodape-dica' }, dica)));

    // No cadastro inicial há "Sair" no cabeçalho; na alteração, "Voltar para Meu plano".
    const cabecalhoDaTela = cabecalho({
      titulo: alteracao ? 'Adicionar medicamento' : 'Cadastro do plano',
      subtitulo: 'Copie da receita, um remédio por vez.',
      voltar: alteracao ? { href: '#/plano', rotulo: 'Voltar para Meu plano' } : null,
      acoes: alteracao ? null : botaoTexto({ texto: 'Sair', icone: 'sair', foco: 'sair', aoClicar: () => sairDaConta(ctx) }),
    });

    return fragmento(
      h('section', { class: 'tela' }, cabecalhoDaTela, formulario, lista),
      rodape);
  },
};
