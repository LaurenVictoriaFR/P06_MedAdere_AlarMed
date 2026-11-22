// P08 · Entrar / Criar conta (RF009, RF001, UC-05, UC-06).
// Ajustes em relação à imagem de referência (Plano-Frontend, seção 1):
// F03 sem "Seus dados estão seguros conosco"; F04 sem "Esqueceu sua senha?";
// F05 sem "Lembrar meu acesso"; F06 "Usar dados de demonstração" só com ?demo=1.
// "Criar conta" segue o UC-05 e o CadastroRequest do back-end. O perfil de
// cuidador (F12) saiu no P3: o P2 não o define e o back-end não o guarda.

import { h, marca, botao, campo, segmentado, limparErroDoCampo, mensagemErro, aviso } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estadoUi } from '../store.js';
import { camposDoErro } from '../api/erros.js';
import { dataISO, somarDias } from '../dominio/tempo.js';

// Ordem dos campos na tela, usada para pôr o foco no primeiro erro.
const ORDEM_DOS_CAMPOS = ['nome', 'dataNascimento', 'email', 'telefone', 'senha', 'confirmacaoSenha', 'aceiteTermos'];

// Texto curto dos termos de uso, mostrado na própria tela (UC-05).
const TERMOS = [
  'O AlarMed é um protótipo acadêmico (COMP0503, UFS). Use apenas dados fictícios.',
  'O app ajuda a lembrar e a registrar as doses. Ele não substitui a orientação de médicos e farmacêuticos e não verifica interações entre remédios.',
  'Por ser um protótipo, não use uma senha que você usa em outros serviços.',
  'Os registros mostram o que foi marcado no app. Eles não comprovam que o remédio foi tomado.',
];

function demoLiberada() {
  return new URLSearchParams(window.location.search).has('demo');
}

// Campo de senha com o botão de mostrar e ocultar. `falar` completa o rótulo
// do botão para o leitor de tela ("Mostrar senha", "Mostrar a confirmação da senha").
function campoSenha(estado, { id, rotulo, falar, ajuda = null, autocomplete }) {
  const alternar = h('button', {
    type: 'button',
    class: 'campo-acessorio',
    'aria-label': `Mostrar ${falar}`,
    'aria-pressed': 'false',
    'aria-controls': id,
  }, icone('olhoFechado'));
  alternar.addEventListener('click', () => {
    const entrada = document.getElementById(id);
    const mostrando = entrada.type === 'text';
    entrada.type = mostrando ? 'password' : 'text';
    alternar.setAttribute('aria-pressed', String(!mostrando));
    alternar.setAttribute('aria-label', `${mostrando ? 'Mostrar' : 'Ocultar'} ${falar}`);
    alternar.replaceChildren(icone(mostrando ? 'olhoFechado' : 'olho'));
  });
  return campo({
    id,
    rotulo,
    ajuda,
    tipo: 'password',
    icone: 'cadeado',
    valor: estado[id],
    autocomplete,
    erro: estado.erros[id],
    acessorio: alternar,
    atributos: { maxlength: 100 },
    aoDigitar: (e) => { estado[id] = e.target.value; limparErroDoCampo(e.target); },
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

// UC-05: o cadastro só termina com o aceite dos termos de uso.
function aceiteDosTermos(estado) {
  const erro = estado.erros.aceiteTermos;
  return h('div', { class: `campo campo-termos${erro ? ' campo-com-erro' : ''}` },
    h('details', { class: 'termos' },
      h('summary', {}, 'Ler os termos de uso'),
      h('ul', { class: 'termos-lista' }, TERMOS.map((t) => h('li', {}, t)))),
    h('label', { class: `conferencia${estado.aceiteTermos ? ' conferencia-marcada' : ''}`, for: 'aceiteTermos' },
      h('input', {
        id: 'aceiteTermos',
        name: 'aceiteTermos',
        type: 'checkbox',
        checked: estado.aceiteTermos,
        'aria-invalid': erro ? 'true' : null,
        'aria-describedby': erro ? 'aceiteTermos-erro' : null,
        onchange: (e) => {
          estado.aceiteTermos = e.target.checked;
          e.target.closest('.conferencia').classList.toggle('conferencia-marcada', e.target.checked);
          limparErroDoCampo(e.target);
        },
      }),
      h('span', {}, 'Li e aceito os termos de uso.')),
    erro && mensagemErro('aceiteTermos-erro', erro));
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
            nome: estado.nome,
            email: estado.email,
            senha: estado.senha,
            confirmacaoSenha: estado.confirmacaoSenha,
            dataNascimento: estado.dataNascimento,
            telefone: estado.telefone,
            aceiteTermos: estado.aceiteTermos,
          });
        } else {
          await ctx.api.entrar({ email: estado.email, senha: estado.senha });
        }
        estado.senha = '';
        estado.confirmacaoSenha = '';
        ctx.navegar('/');
      } catch (e) {
        const campos = camposDoErro(e);
        estado.erros = campos ?? {};
        estado.erroGeral = campos ? '' : (e.message || 'Não foi possível continuar.');
        const primeiro = ORDEM_DOS_CAMPOS.find((c) => estado.erros[c]);
        await ctx.atualizar({ focarEm: primeiro ? `#${primeiro}` : '#erro-geral' });
      }
    };

    const usarDemo = async () => {
      await ctx.api.carregarDemonstracao();
      ctx.navegar('/hoje');
    };

    const campoEmail = campoTexto(estado, 'email', {
      rotulo: 'E-mail', tipo: 'email', icone: 'email', autocomplete: 'email', placeholder: 'nome@exemplo.com',
      atributos: { maxlength: 120 },
    });

    const campos = criar
      ? [
        campoTexto(estado, 'nome', { rotulo: 'Seu nome', icone: 'usuario', autocomplete: 'name', atributos: { maxlength: 120 } }),
        campoTexto(estado, 'dataNascimento', {
          rotulo: 'Data de nascimento', tipo: 'date', icone: 'calendario', autocomplete: 'bday',
          atributos: { min: '1900-01-01', max: somarDias(dataISO(ctx.agora), -1) },
        }),
        campoEmail,
        campoTexto(estado, 'telefone', {
          rotulo: 'Telefone (opcional)', tipo: 'tel', icone: 'celular', autocomplete: 'tel', placeholder: '(79) 99999-0000',
          atributos: { maxlength: 20, inputmode: 'tel' },
        }),
        campoSenha(estado, {
          id: 'senha', rotulo: 'Senha', falar: 'senha', autocomplete: 'new-password',
          ajuda: 'De 8 a 100 caracteres, com letras e números.',
        }),
        campoSenha(estado, {
          id: 'confirmacaoSenha', rotulo: 'Confirme a senha', falar: 'a confirmação da senha', autocomplete: 'new-password',
        }),
        aceiteDosTermos(estado),
      ]
      : [
        campoEmail,
        campoSenha(estado, { id: 'senha', rotulo: 'Senha', falar: 'senha', autocomplete: 'current-password' }),
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
