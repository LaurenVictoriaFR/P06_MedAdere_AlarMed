// P08 · Entrar / Criar conta (RF009, RF001, UC05).
// Ajustes em relação à imagem de referência (Plano-Frontend, seção 1):
// F03 sem "Seus dados estão seguros conosco"; F04 sem "Esqueceu sua senha?";
// F05 sem "Lembrar meu acesso"; F06 "Usar dados de demonstração" só com ?demo=1.

import { h, marca, botao, campo, segmentado, grupoChips, limparErroDoCampo, aviso } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estadoUi } from '../store.js';

const PERFIS = [
  { valor: 'paciente', rotulo: 'Sou o paciente' },
  { valor: 'cuidador', rotulo: 'Cuido de um paciente' },
];

function demoLiberada() {
  return new URLSearchParams(window.location.search).has('demo');
}

function campoSenha(estado, { novaSenha }) {
  const alternar = h('button', {
    type: 'button',
    class: 'campo-acessorio',
    'aria-label': 'Mostrar senha',
    'aria-pressed': 'false',
    'aria-controls': 'senha',
  }, icone('olhoFechado'));
  alternar.addEventListener('click', () => {
    const entrada = document.getElementById('senha');
    const mostrando = entrada.type === 'text';
    entrada.type = mostrando ? 'password' : 'text';
    alternar.setAttribute('aria-pressed', String(!mostrando));
    alternar.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
    alternar.replaceChildren(icone(mostrando ? 'olhoFechado' : 'olho'));
  });
  return campo({
    id: 'senha',
    rotulo: 'Senha',
    ajuda: novaSenha ? 'Pelo menos 6 caracteres.' : null,
    tipo: 'password',
    icone: 'cadeado',
    valor: estado.senha,
    autocomplete: novaSenha ? 'new-password' : 'current-password',
    erro: estado.erros.senha,
    acessorio: alternar,
    aoDigitar: (e) => { estado.senha = e.target.value; limparErroDoCampo(e.target); },
  });
}

function campoTexto(estado, chave, opcoes) {
  return campo({
    id: chave,
    valor: estado[chave],
    erro: estado.erros[chave],
    aoDigitar: (e) => { estado[chave] = e.target.value; limparErroDoCampo(e.target); },
    ...opcoes,
  });
}

// Desktop: foto do casal de fundo, textos por cima e faixa de destaques na base,
// como na imagem de referência. No celular e no tablet, só o cartão.
function hero() {
  return h('section', { class: 'entrar-hero', 'aria-label': 'Sobre o AlarMed' },
    h('div', { class: 'hero-topo' },
      marca({ tamanho: 'grande', slogan: true, curva: true }),
      h('p', { class: 'hero-frase' }, 'Mais cuidado, mais tranquilidade para você e sua família.'),
      icone('coracao', { classe: 'hero-coracao' })),
    h('ul', { class: 'hero-destaques' },
      h('li', {}, icone('sino'), h('span', {}, 'Receba lembretes no horário certo')),
      h('li', {}, icone('barras'), h('span', {}, 'Acompanhe sua adesão ao tratamento')),
      h('li', {}, icone('coracao'), h('span', {}, 'Mostre o painel do mês na consulta'))));
}

export default {
  titulo: () => 'Entrar',

  async render(ctx) {
    const estado = estadoUi.entrar;
    const criar = estado.modo === 'criar';

    const enviar = async (evento) => {
      evento.preventDefault();
      estado.erros = {};
      estado.erroGeral = '';
      try {
        if (criar) {
          await ctx.api.criarConta({
            nome: estado.nome, email: estado.email, senha: estado.senha,
            perfil: estado.perfil, nomePaciente: estado.nomePaciente,
          });
        } else {
          await ctx.api.entrar({ email: estado.email, senha: estado.senha });
        }
        estado.senha = '';
        ctx.navegar('/');
      } catch (e) {
        estado.erros = e.campos ?? {};
        estado.erroGeral = e.campos ? '' : (e.message || 'Não foi possível continuar.');
        const primeiro = ['perfil', 'nome', 'nomePaciente', 'email', 'senha'].find((c) => estado.erros[c]);
        await ctx.atualizar({ focarEm: primeiro ? (primeiro === 'perfil' ? '[data-foco^="perfil-"]' : `#${primeiro}`) : '#erro-geral' });
      }
    };

    const usarDemo = async () => {
      await ctx.api.carregarDemonstracao();
      ctx.navegar('/hoje');
    };

    const campos = criar
      ? [
        grupoChips({
          id: 'perfil',
          rotulo: 'Quem vai usar o AlarMed?',
          opcoes: PERFIS,
          selecionado: (o) => o.valor === estado.perfil,
          aoEscolher: (o) => { estado.perfil = o.valor; estado.erros.perfil = null; ctx.atualizar(); },
          erro: estado.erros.perfil,
        }),
        campoTexto(estado, 'nome', { rotulo: 'Seu nome', icone: 'usuario', autocomplete: 'name' }),
        estado.perfil === 'cuidador' && campoTexto(estado, 'nomePaciente', {
          rotulo: 'Nome de quem você cuida', icone: 'coracao', autocomplete: 'off',
          ajuda: 'Aparece no painel que você mostra para a equipe de saúde.',
        }),
        campoTexto(estado, 'email', { rotulo: 'E-mail', tipo: 'email', icone: 'email', autocomplete: 'email', placeholder: 'nome@exemplo.com' }),
        campoSenha(estado, { novaSenha: true }),
      ]
      : [
        campoTexto(estado, 'email', { rotulo: 'E-mail', tipo: 'email', icone: 'email', autocomplete: 'email', placeholder: 'nome@exemplo.com' }),
        campoSenha(estado, { novaSenha: false }),
      ];

    const cartao = h('section', { class: 'entrar-cartao', 'aria-labelledby': 'titulo-entrar' },
      marca({ tamanho: 'media', slogan: true, centralizada: true }),
      h('h1', { id: 'titulo-entrar', class: 'sr-only', tabindex: '-1' }, criar ? 'Criar conta no AlarMed' : 'Entrar no AlarMed'),
      segmentado({
        id: 'modo',
        rotulo: 'Como você quer continuar',
        valor: estado.modo,
        opcoes: [
          { valor: 'entrar', rotulo: 'Entrar', icone: 'usuario' },
          { valor: 'criar', rotulo: 'Criar conta', icone: 'usuarioMais' },
        ],
        aoEscolher: (modo) => {
          estado.modo = modo;
          estado.erros = {};
          estado.erroGeral = '';
          ctx.atualizar();
        },
      }),
      h('form', { class: 'entrar-form', novalidate: true, onsubmit: enviar },
        estado.erroGeral && h('div', { id: 'erro-geral', tabindex: '-1' },
          aviso({ tipo: 'erro', icone: 'alerta', texto: estado.erroGeral, papel: 'alert' })),
        campos,
        criar && h('p', { class: 'texto-suave pequeno' }, 'A conta pode ser criada pelo paciente ou por quem cuida dele.'),
        botao({
          texto: criar ? 'Criar conta e começar' : 'Entrar',
          icone: criar ? 'usuarioMais' : 'entrar',
          tipo: 'submit',
          foco: 'enviar',
        })),
      demoLiberada() && h('div', { class: 'entrar-demo' },
        h('p', { class: 'divisor' }, h('span', {}, 'ou')),
        botao({ texto: 'Usar dados de demonstração', icone: 'play', variante: 'secundario', aoClicar: usarDemo })),
      h('p', { class: 'entrar-nota' }, icone('info', { tamanho: 20 }),
        h('span', {}, 'Versão de demonstração: use dados fictícios.')));

    return h('div', { class: 'entrar' },
      h('div', { class: 'entrar-foto', 'aria-hidden': 'true' },
        h('img', { src: 'assets/img/login-fundo.webp', alt: '', width: 2192, height: 1732, loading: 'lazy', decoding: 'async' })),
      icone('coracaoCruz', { classe: 'entrar-enfeite enfeite-coracao' }),
      icone('folhas', { classe: 'entrar-enfeite enfeite-folhas' }),
      h('div', { class: 'entrar-conteudo' }, hero(), cartao));
  },
};
