// Interface única das telas. API real por padrão; mock somente com ?mock=1.
// A demonstração local precisa ser escolhida explicitamente com ?mock=1.
const mock = new URLSearchParams(globalThis.location?.search ?? '').get('mock') === '1';
const implementacao = await import(mock ? './api-mock.js' : './api-http.js');
export const modoReal = !mock;
export const { sessao, criarConta, entrar, sair, obterPlano, adicionarItem, removerItem,
  reinserirItem, descartarAlteracao, confirmarPlano, listarRegistros, registrarDose,
  desfazerRegistro, carregarDemonstracao } = implementacao;
export const { listarDoses, editarPlano, revisarPlano, chavePush, situacaoPush,
  inscreverPush, enviarLembreteTeste } = implementacao;
export { ErroApi } from './erros.js';
