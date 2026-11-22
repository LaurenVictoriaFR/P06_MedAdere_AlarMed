// Estado de interface que precisa sobreviver a um redesenho da tela,
// mas não precisa ir para a API (formulário em edição, aba do login etc.).

import { formularioVazio } from './dominio/plano.js';

function inicial() {
  return {
    entrar: {
      modo: 'entrar', email: '', senha: '',
      // Só em "Criar conta" (UC-05)
      nome: '', dataNascimento: '', telefone: '', confirmacaoSenha: '', aceiteTermos: false,
      erros: {}, erroGeral: '',
    },
    cadastro: { form: formularioVazio(), erros: {}, horaExtra: '', erroHoraExtra: '', erroFoto: '' },
    revisao: { conferido: false },
    painel: { diaSelecionado: null, medicamento: null },
  };
}

export const estadoUi = inicial();

export function limparFormularioDoCadastro() {
  estadoUi.cadastro = inicial().cadastro;
}

export function limparEstadoUi() {
  Object.assign(estadoUi, inicial());
}

// F11: sair da conta e limpar o que estava em edição neste aparelho.
export async function sairDaConta(ctx) {
  await ctx.api.sair();
  limparEstadoUi();
  ctx.navegar('/entrar');
}
