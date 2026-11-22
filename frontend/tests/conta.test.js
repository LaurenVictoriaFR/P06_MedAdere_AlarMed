import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCadastro, validarLogin } from '../js/dominio/conta.js';

const HOJE = '2026-11-21';

function cadastro(mudancas = {}) {
  return {
    nome: 'Antônio Souza',
    email: '  Antonio@Exemplo.test ',
    senha: 'remedio2026',
    confirmacaoSenha: 'remedio2026',
    dataNascimento: '1956-05-14',
    telefone: '',
    aceiteTermos: true,
    ...mudancas,
  };
}

test('UC-05: cadastro completo é válido e sai no formato do CadastroRequest', () => {
  const r = validarCadastro(cadastro(), HOJE);
  assert.equal(r.valido, true);
  assert.deepEqual(r.dados, {
    nome: 'Antônio Souza',
    email: 'antonio@exemplo.test',
    senha: 'remedio2026',
    confirmacaoSenha: 'remedio2026',
    dataNascimento: '1956-05-14',
    telefone: null,
    aceiteTermos: true,
  });
});

test('UC-05: cada campo obrigatório faltando, isolado', () => {
  const faltas = {
    nome: { nome: '   ' },
    email: { email: '' },
    senha: { senha: '', confirmacaoSenha: '' },
    confirmacaoSenha: { confirmacaoSenha: '' },
    dataNascimento: { dataNascimento: '' },
    aceiteTermos: { aceiteTermos: false },
  };
  for (const [campo, mudanca] of Object.entries(faltas)) {
    const r = validarCadastro(cadastro(mudanca), HOJE);
    assert.equal(r.valido, false, campo);
    assert.ok(r.erros[campo], `${campo} deveria ter erro`);
  }
  // Um campo faltando não acusa erro nos outros.
  assert.deepEqual(Object.keys(validarCadastro(cadastro({ nome: '' }), HOJE).erros), ['nome']);
});

test('UC-05: senha de 8 a 100 caracteres, com letras e números', () => {
  const comSenha = (senha) => validarCadastro(cadastro({ senha, confirmacaoSenha: senha }), HOJE);
  assert.ok(comSenha('abc1234').erros.senha, '7 caracteres');
  assert.ok(comSenha('abcdefgh').erros.senha, 'sem número');
  assert.ok(comSenha('12345678').erros.senha, 'sem letra');
  assert.ok(comSenha(`a${'1'.repeat(100)}`).erros.senha, '101 caracteres');
  assert.equal(comSenha('abcd1234').valido, true);
});

// O BCrypt do back-end só aceita até 72 bytes (PR #7). Letra acentuada ocupa 2 bytes.
test('UC-05: senha com mais de 72 bytes é recusada, mesmo com até 100 caracteres', () => {
  const comSenha = (senha) => validarCadastro(cadastro({ senha, confirmacaoSenha: senha }), HOJE);
  assert.equal(comSenha(`a${'1'.repeat(71)}`).valido, true, '72 bytes');
  assert.match(comSenha(`a${'1'.repeat(72)}`).erros.senha, /72 bytes/, '73 bytes');
  assert.equal(comSenha(`a1${'ã'.repeat(35)}`).valido, true, '37 caracteres, 72 bytes');
  assert.match(comSenha(`a1${'ã'.repeat(36)}`).erros.senha, /72 bytes/, '38 caracteres, 74 bytes');
});

test('UC-05: confirmação diferente da senha é recusada', () => {
  const r = validarCadastro(cadastro({ confirmacaoSenha: 'remedio2025' }), HOJE);
  assert.equal(r.erros.confirmacaoSenha, 'A confirmação da senha não confere.');
});

test('UC-05: data de nascimento precisa ser válida e estar no passado', () => {
  assert.equal(validarCadastro(cadastro({ dataNascimento: '2026-11-20' }), HOJE).valido, true);
  assert.ok(validarCadastro(cadastro({ dataNascimento: HOJE }), HOJE).erros.dataNascimento, 'hoje');
  assert.ok(validarCadastro(cadastro({ dataNascimento: '2026-11-22' }), HOJE).erros.dataNascimento, 'amanhã');
  assert.ok(validarCadastro(cadastro({ dataNascimento: '1990-02-30' }), HOJE).erros.dataNascimento, 'data inexistente');
});

test('UC-05: telefone é opcional, com até 20 caracteres', () => {
  assert.equal(validarCadastro(cadastro({ telefone: '(79) 99999-0000' }), HOJE).dados.telefone, '(79) 99999-0000');
  assert.ok(validarCadastro(cadastro({ telefone: '9'.repeat(21) }), HOJE).erros.telefone);
});

test('UC-06: login exige e-mail e senha', () => {
  assert.deepEqual(Object.keys(validarLogin({ email: ' ', senha: '' }).erros), ['email', 'senha']);
  const r = validarLogin({ email: ' Antonio@Exemplo.test', senha: 'remedio2026' });
  assert.equal(r.valido, true);
  assert.equal(r.dados.email, 'antonio@exemplo.test');
});
