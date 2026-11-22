# Contrato da API

O front-end fala com o servidor só por `js/api/api.js`. Hoje ele aponta para
`api-mock.js`, que guarda tudo no `localStorage` do navegador. Para integrar,
crie `api-http.js` com as mesmas funções do mock, traduza os dados conforme as
tabelas abaixo e troque a linha de `api.js`.

Este arquivo registra o contrato **do back-end** onde ele já existe e a
**proposta do front** onde ainda não existe.

## Situação em 22/11/2026

| Parte | Back-end | Onde |
|---|---|---|
| Conta e login (UC-05, UC-06) | Pronto | `main` (PR #4) |
| Plano e revisão (UC-01, UC-08), com o plano atual | Pronto | `main` (PRs #2, #5 e #6) |
| Alterar plano (UC-04) | Não existe | P4 |
| Doses e registros (UC-02), painel (UC-03), lembrete por push (UC-07) | Não existe | Bloco D |

## Convenções do back-end

- **Rotas sem prefixo** (`/contas`, `/planos`, ...).
- **Identificação pela sessão:** `POST /contas` e `POST /login` abrem uma sessão HTTP (cookie `JSESSIONID`) com o id do paciente. As rotas do plano usam essa sessão. Sem ela, a resposta é 401 "Paciente não identificado. Faça login.". O `api-http.js` precisa mandar o cookie em toda chamada (`fetch(url, { credentials: 'include' })`). A sessão fica na memória do servidor: se ele reiniciar, é preciso entrar de novo.
- **Erro**, em qualquer rota (`ErroResposta.java`):

  ```json
  { "mensagem": "Dados inválidos.", "camposInvalidos": { "senha": "A senha deve ter de 8 a 100 caracteres, com letras e números." } }
  ```

  `camposInvalidos` vem vazio quando o erro não é de formulário.

  | Status | Quando |
  |---|---|
  | 400 | Corpo inválido, com `camposInvalidos` |
  | 401 | Sem identificação ou credenciais erradas |
  | 404 | Recurso não encontrado |
  | 409 | Regra de negócio quebrada |

  O `ErroApi` do front (`js/api/erros.js`) tem o mesmo formato, com `mensagem`, `camposInvalidos` e `status`.

## Conta (UC-05, UC-06)

| Função em `api.js` | Rota | Corpo | Resposta |
|---|---|---|---|
| `criarConta(dados)` | `POST /contas` | `CadastroRequest` | `ContaResponse` |
| `entrar({ email, senha })` | `POST /login` | `LoginRequest` | `ContaResponse` ou 401 `"Email ou senha inválidos."` |
| `sessao()`, `sair()` | (sem rota) | | Não há rota para consultar a sessão nem para sair. O front guarda a conta no aparelho e, ao sair, só a esquece. A rota de logout fica para o P4 (decisão de 22/11/2026) |

```jsonc
// CadastroRequest (dados fictícios)
{ "nome": "Antônio Souza", "email": "antonio@exemplo.test",
  "senha": "remedio2026", "confirmacaoSenha": "remedio2026",
  "dataNascimento": "1956-05-14",    // AAAA-MM-DD, no passado
  "telefone": null,                  // opcional, até 20 caracteres
  "aceiteTermos": true }             // obrigatório; só valida, não é gravado

// LoginRequest
{ "email": "antonio@exemplo.test", "senha": "remedio2026" }

// ContaResponse
{ "id": "…", "nome": "Antônio Souza", "email": "antonio@exemplo.test" }
```

As validações e as mensagens estão repetidas em `js/dominio/conta.js`, com testes em `tests/conta.test.js`:
- O nome e o e-mail têm até 120 caracteres.
- A senha tem de 8 a 100 caracteres, com letras e números.
- A data de nascimento precisa estar no passado.
- O aceite dos termos é obrigatório.

Três regras ficam no service e voltam como 409:
- `"A confirmação da senha não confere"`. O front também a checa no próprio campo, antes de enviar.
- `"Email já cadastrado."`
- `"A senha é longa demais: o limite é de 72 bytes (letras acentuadas ocupam mais de 1)."`. O BCrypt só aceita até 72 bytes. O front também a checa no próprio campo.

O back-end guarda a senha como hash BCrypt (ADR-04 revisada, PR #7). Não há bloqueio de tentativas. Use só dados fictícios.

## Plano (UC-01, UC-08)

Respostas: `PlanoResponse { id, dataInicio, dataFim, situacao, itens: [ItemDoPlanoResponse] }`.
A `situacao` vai de `EM_EDICAO` para `EM_REVISAO` e depois para `CONFIRMADO`. Há ainda `ENCERRADO`.

| Momento na tela | Rota | Função no front |
|---|---|---|
| Abrir o app | `GET /planos/atual`: plano confirmado do paciente, ou 404 "Nenhum plano confirmado." | `obterPlano()` |
| Abrir o P01 sem plano confirmado | `POST /planos`: cria ou retoma o rascunho (`EM_EDICAO`) | `obterPlano()` |
| "Adicionar à lista" | `POST /planos/{id}/itens` | `adicionarItem(formulario)` |
| Remover um remédio | `DELETE /planos/{id}/itens/{itemId}` | `removerItem(id)` |
| "Desfazer" a remoção | `POST /planos/{id}/itens` com o mesmo item. O item volta para o fim da lista | `reinserirItem(item, posicao)` |
| Abrir o P02 | `POST /planos/{id}/revisar` (`EM_REVISAO`) | **falta criar** `revisarPlano()` |
| "Voltar e editar" no P02 | `POST /planos/{id}/editar` (`EM_EDICAO`) | **falta criar** `editarPlano()` |
| "Confirmar e salvar" | `POST /planos/{id}/confirmar`. Só funciona a partir de `EM_REVISAO` (RN01, R03) | `confirmarPlano()` |
| Desistir do cadastro | `DELETE /planos/{id}` | `descartarAlteracao()` |

O "Conferi" do P02 continua na tela. O que garante a revisão obrigatória é o estado no servidor.

### Tradução do item

| Front (`js/dominio/plano.js`) | Back (`ItemDoPlanoRequest`) | Como traduzir |
|---|---|---|
| `nome` | `nomeMedicamento` | Igual. O front limita a 80 caracteres; o back, a 120 |
| `concentracao`, `qtd`, `unidade` | `dosagem` | O front junta tudo em `"50 mg · 1 comprimido"`, até 60 caracteres (decisão do grupo, 22/11/2026). Na volta, o front separa o texto pelo `·` |
| `via` | `viaAdministracao` | Rótulo da via (`"oral"`, `"sublingual"`, ...). Opcional |
| `horarios: ["08:00", "20:00"]` | `horarios` | Igual (o `LocalTime` aceita `"HH:MM"`) |
| (calculada) | `frequencia` | Pelo número de horários: `"1 vez ao dia"`, `"2 vezes ao dia"`, ... |
| `duracao` | `duracaoTratamento` | `{tipo:"continuo"}` vira `"uso contínuo"`, `{tipo:"dias",dias:7}` vira `"7 dias"`, `{tipo:"ate",fim:"2026-11-30"}` vira `"até 30/11/2026"` |
| `obs` | (não tem) | Não cabe nos 60 caracteres de `dosagem`. Fica só no aparelho até o back ter um campo próprio (P4) |
| `foto` | (não tem) | RF008, P4 |

### O que falta no back-end para o front funcionar sem o mock

1. **Duração estruturada por item.** O front gera as doses de cada remédio pelo período dele. O back guarda `duracaoTratamento` em texto livre e `dataFim` no plano inteiro. Enquanto isso não mudar, o texto precisa seguir um dos três formatos da tabela acima.
2. **Alteração do plano confirmado** (UC-04, P07), no P4. Hoje o front a guarda como "alteração pendente" até a revisão.

## Doses, painel e lembrete (proposta para o Bloco D)

As doses **não são guardadas**. Elas são calculadas a partir dos itens vigentes (`js/dominio/doses.js`), e o servidor só guarda os registros.

```jsonc
// Registro de dose. A chave é o id da dose: "<idItem>@<AAAA-MM-DD>T<HH:MM>"
{ "status": "tomada" | "nao_tomada", "em": "ISO 8601" }
```

| Função em `api.js` | Rota proposta | Resposta |
|---|---|---|
| `listarRegistros()` | `GET /registros?de=AAAA-MM-DD&ate=AAAA-MM-DD` | `{ [idDose]: Registro }` |
| `registrarDose(idDose, status)` | `PUT /registros/{idDose}` com `{ status }` | `Registro` |
| `desfazerRegistro(idDose)` | `DELETE /registros/{idDose}` | 204 |

O servidor não pode confiar no relógio do aparelho. Ele precisa usar o **próprio relógio** e as regras de `motivoParaRecusarRegistro` (`js/dominio/doses.js`). Os textos estão em `js/api/erros.js`.

| Situação | Status | Mensagem |
|---|---|---|
| O id não é de uma dose do plano | 404 | "Esta dose não está no plano." |
| Ainda não chegou o horário T | 409 | "Ainda não chegou o horário desta dose." |
| Passou o fim da janela: mais de 120 min depois de T (com 120 ainda aceita), ou chegou o horário da próxima dose do mesmo remédio, o que vier antes | 409 | "O prazo de 2 horas terminou. A dose conta como não tomada." |
| A dose já tem registro (o registro é final) | 409 | "Esta dose já foi registrada." |
| Desfazer depois do fim da janela (RF004 E3) | 409 | "O prazo para corrigir terminou. O registro ficou como está." |

Os limites da janela (cenário QS-02, risco R07) estão nos testes de `tests/doses.test.js`: com T+119 e T+120 o registro é aceito, e com T+121 a dose vira não tomada. A conta é por minuto: 10:00:59 ainda vale como 120 min para uma dose das 8:00.

### Web Push (UC-07)

Para o lembrete tocar com o app fechado, o back-end precisa:

1. Gerar um par de chaves VAPID e expor a chave pública (`GET /push/chave`).
2. Receber a inscrição do aparelho (`POST /push/inscricoes`), uma por aparelho e conta.
3. No horário de cada dose, enviar o push com
   `{ "titulo": "Hora de tomar Losartana 50 mg", "corpo": "1 comprimido, via oral. Toque para registrar.", "hash": "#/hoje?dose=<idDose>" }`.

O `sw.js` já trata o clique na notificação. Falta o evento `push`, que entra junto com o back-end.

O mock também tem `carregarDemonstracao()`, que só existe para os testes de usabilidade e não tem rota.
