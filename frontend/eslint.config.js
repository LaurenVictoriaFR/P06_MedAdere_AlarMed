// Linter do front-end (TD-07). Regras recomendadas do ESLint e mais quatro que
// evitam erros comuns. Cada grupo de arquivos recebe as variáveis globais do
// ambiente em que roda: navegador, service worker ou Node (servidor e testes).

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['servidor.mjs', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];
