// Erro padrão da API. `campos` traz uma mensagem por campo do formulário.
export class ErroApi extends Error {
  constructor(codigo, mensagem, campos = null) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
    this.campos = campos;
  }
}

export const MENSAGENS = {
  sem_sessao: 'Entre na sua conta para continuar.',
  dados_invalidos: 'Confira os campos destacados.',
  credenciais: 'E-mail ou senha não conferem.',
  email_em_uso: 'Já existe uma conta com este e-mail.',
  nada_a_confirmar: 'Não há mudanças para confirmar.',
  item_inexistente: 'Este remédio não está mais na lista.',
  dose_inexistente: 'Esta dose não está no plano.',
  status_invalido: 'Registro inválido.',
  ja_registrada: 'Esta dose já foi registrada.',
  antes_do_horario: 'Ainda não chegou o horário desta dose.',
  prazo_encerrado: 'O prazo de 2 horas terminou. A dose conta como não tomada.',
  prazo_correcao: 'O prazo para corrigir terminou. O registro ficou como está.',
  sem_registro: 'Esta dose ainda não tem registro.',
  armazenamento_cheio: 'O navegador ficou sem espaço. Remova algumas fotos e tente de novo.',
};
