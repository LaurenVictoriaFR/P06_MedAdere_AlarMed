// Regras do cadastro de conta (UC-05) e do login (UC-06), sem DOM.
// Repetem as validações do back-end (CadastroRequest, LoginRequest e ContaService,
// na branch feature/conta-login) com as mesmas mensagens. Assim o erro aparece
// igual com o mock e com a API real.

import { dataValida } from './tempo.js';

export const LIMITES_CONTA = Object.freeze({ nome: 120, email: 120, senhaMin: 8, senhaMax: 100, telefone: 20 });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// De 8 a 100 caracteres, com pelo menos uma letra e um número (mesma regra do back-end).
const SENHA = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

export function normalizarEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function resultado(erros, dados) {
  return { valido: Object.keys(erros).length === 0, erros, dados };
}

// `f` traz os campos da tela e `hoje` é AAAA-MM-DD (o nascimento tem de ser antes).
// Devolve { valido, erros, dados }, com `dados` já no formato do CadastroRequest.
export function validarCadastro(f, hoje) {
  const dados = {
    nome: String(f.nome ?? '').trim(),
    email: normalizarEmail(f.email),
    senha: String(f.senha ?? ''),
    confirmacaoSenha: String(f.confirmacaoSenha ?? ''),
    dataNascimento: String(f.dataNascimento ?? ''),
    telefone: String(f.telefone ?? '').trim() || null,
    aceiteTermos: f.aceiteTermos === true,
  };
  const erros = {};

  if (!dados.nome) erros.nome = 'Informe o nome do usuário.';
  else if (dados.nome.length > LIMITES_CONTA.nome) erros.nome = 'O nome do usuário pode ter no máximo 120 caracteres.';

  if (!dados.email) erros.email = 'Informe o email do usuário.';
  else if (dados.email.length > LIMITES_CONTA.email) erros.email = 'O email pode ter no máximo 120 caracteres.';
  else if (!EMAIL.test(dados.email)) erros.email = 'Informe um e-mail válido.';

  if (!dados.senha.trim()) erros.senha = 'Informe a senha do usuário.';
  else if (!SENHA.test(dados.senha)) erros.senha = 'A senha deve ter de 8 a 100 caracteres, com letras e números.';

  // No back-end, a confirmação diferente volta como erro geral (409). Aqui ela
  // aparece no próprio campo, antes de enviar.
  if (!dados.confirmacaoSenha.trim()) erros.confirmacaoSenha = 'Confirme a senha do usuário.';
  else if (dados.confirmacaoSenha !== dados.senha) erros.confirmacaoSenha = 'A confirmação da senha não confere.';

  if (!dataValida(dados.dataNascimento)) erros.dataNascimento = 'Informe a data de nascimento do usuário.';
  else if (dados.dataNascimento >= hoje) erros.dataNascimento = 'A data de nascimento deve estar no passado.';

  if (dados.telefone && dados.telefone.length > LIMITES_CONTA.telefone) {
    erros.telefone = 'O telefone pode ter no máximo 20 caracteres.';
  }

  if (!dados.aceiteTermos) erros.aceiteTermos = 'Aceite os termos de uso para finalizar o cadastro.';

  return resultado(erros, dados);
}

// Devolve { valido, erros, dados }, com `dados` no formato do LoginRequest.
export function validarLogin(f) {
  const dados = { email: normalizarEmail(f.email), senha: String(f.senha ?? '') };
  const erros = {};
  if (!dados.email) erros.email = 'Informe o e-mail.';
  if (!dados.senha.trim()) erros.senha = 'Informe a senha.';
  return resultado(erros, dados);
}
