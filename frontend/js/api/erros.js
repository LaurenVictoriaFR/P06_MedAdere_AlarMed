// Erro da API no mesmo formato do back-end (ErroResposta.java):
// { mensagem, camposInvalidos }, em que camposInvalidos traz uma mensagem por campo.
// `status` é o código HTTP que o servidor usa: 400 dados inválidos, 401 sem
// identificação ou credenciais erradas, 404 não encontrado, 409 regra de negócio.
export class ErroApi extends Error {
  constructor(mensagem, { status = 400, camposInvalidos = {} } = {}) {
    super(mensagem);
    this.name = 'ErroApi';
    this.mensagem = mensagem;
    this.status = status;
    this.camposInvalidos = camposInvalidos;
  }
}

// Mensagens por campo, ou null se o erro não for de formulário.
export function camposDoErro(e) {
  const campos = e instanceof ErroApi ? e.camposInvalidos : null;
  return campos && Object.keys(campos).length ? campos : null;
}

// Erros que o mock lança: [status, mensagem]. Os de conta e o de dados inválidos
// usam o texto do back-end; os de dose são a proposta para o Bloco D (API.md).
export const ERROS = {
  dados_invalidos: [400, 'Dados inválidos.'],
  sem_sessao: [401, 'Entre na sua conta para continuar.'],
  credenciais: [401, 'Email ou senha inválidos.'],
  email_em_uso: [409, 'Email já cadastrado.'],
  nada_a_confirmar: [409, 'Não há mudanças para confirmar.'],
  item_inexistente: [404, 'Este remédio não está mais na lista.'],
  dose_inexistente: [404, 'Esta dose não está no plano.'],
  status_invalido: [400, 'Registro inválido.'],
  ja_registrada: [409, 'Esta dose já foi registrada.'],
  antes_do_horario: [409, 'Ainda não chegou o horário desta dose.'],
  prazo_encerrado: [409, 'O prazo de 2 horas terminou. A dose conta como não tomada.'],
  prazo_correcao: [409, 'O prazo para corrigir terminou. O registro ficou como está.'],
  sem_registro: [404, 'Esta dose ainda não tem registro.'],
  armazenamento_cheio: [507, 'O navegador ficou sem espaço. Remova algumas fotos e tente de novo.'],
};
