// Interface única que as telas usam para falar com o "servidor".
//
// Hoje aponta para o mock (localStorage + dados sintéticos), porque o backend
// ainda está em desenvolvimento. Quando ele existir, crie api-http.js com as
// mesmas funções e formatos descritos em API.md e troque a linha abaixo.
export * from './api-mock.js';
export { ErroApi } from './erros.js';
