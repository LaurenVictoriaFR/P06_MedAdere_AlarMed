# Contrato da API (proposta do frontend)

O frontend fala com o "servidor" só por `js/api/api.js`. Hoje ele aponta para
`api-mock.js`, que guarda tudo no `localStorage`. Quando o backend existir, basta
criar `api-http.js` com as **mesmas funções e formatos** abaixo e trocar a linha
de `api.js`.

Esta é uma proposta para alinhar com quem está no backend. Nomes de rota e
detalhes podem mudar, desde que os formatos de dados se mantenham.

## Formatos

```jsonc
// Usuario
{ "id": "u-1", "nome": "Juliana", "email": "juliana@exemplo.test",
  "perfil": "cuidador",            // "paciente" | "cuidador"
  "nomePaciente": "Antônio" }      // null quando perfil = "paciente"

// Item (remédio no plano)
{ "id": "m-1", "nome": "Losartana", "concentracao": "50 mg",
  "qtd": 1, "unidade": "comprimido",   // comprimido | capsula | gota | ml
  "via": "oral",                       // oral | sublingual | pele | inalacao
  "horarios": ["08:00", "20:00"],      // HH:MM, ordenados, sem repetição
  "duracao": { "tipo": "continuo" },   // ou { "tipo": "dias", "dias": 7 } ou { "tipo": "ate", "fim": "2026-11-30" }
  "obs": "Depois do almoço",
  "foto": "data:image/jpeg;base64,..." // opcional (RF008); no backend, pode virar URL
}

// ItemVigente = Item + campos definidos na confirmação
{ "vigenteDesde": "2026-10-17T11:06:00.000Z", "inicio": "2026-10-17",
  "fim": null, "encerradoEm": "..." }  // encerradoEm só nos itens que saíram

// Plano
{ "confirmado": null | { "itens": [ItemVigente], "confirmadoEm": "ISO" },
  "rascunho":   null | [Item],        // cadastro em andamento ou alteração pendente (RN01)
  "encerrados": [ItemVigente] }       // itens que saíram, para o histórico do painel

// Registro de dose. A chave é o id da dose: "<idItem>@<AAAA-MM-DD>T<HH:MM>"
{ "status": "tomada" | "nao_tomada", "em": "ISO" }

// Erro (qualquer rota)
{ "codigo": "prazo_encerrado", "mensagem": "texto para o usuário",
  "campos": { "email": "mensagem do campo" } }   // campos só em erros de formulário
```

Doses **não são guardadas**: são calculadas a partir dos itens vigentes
(`js/dominio/doses.js`). O backend só guarda os registros.

## Funções e rotas sugeridas

| Função em `api.js` | Rota sugerida | Resposta |
|---|---|---|
| `sessao()` | `GET /api/sessao` | `Usuario` ou 401 |
| `criarConta({nome, email, senha, perfil, nomePaciente})` | `POST /api/contas` | 201 `Usuario` (já com sessão) |
| `entrar({email, senha})` | `POST /api/sessao` | `Usuario` |
| `sair()` | `DELETE /api/sessao` | 204 |
| `obterPlano()` | `GET /api/plano` | `Plano` |
| `adicionarItem(formulario)` | `POST /api/plano/rascunho/itens` | 201 `Item` |
| `removerItem(id)` | `DELETE /api/plano/rascunho/itens/{id}` | `{ item, posicao }` |
| `reinserirItem(item, posicao)` | `POST /api/plano/rascunho/itens` com `{ item, posicao }` | 204 |
| `descartarAlteracao()` | `DELETE /api/plano/rascunho` | 204 |
| `confirmarPlano()` | `POST /api/plano/confirmacao` | `Plano` |
| `listarRegistros()` | `GET /api/registros?de=AAAA-MM-DD&ate=AAAA-MM-DD` | `{ [idDose]: Registro }` |
| `registrarDose(idDose, status)` | `PUT /api/registros/{idDose}` com `{ status }` | `Registro` |
| `desfazerRegistro(idDose)` | `DELETE /api/registros/{idDose}` | 204 |

O mock também tem `carregarDemonstracao()`, que só existe para os testes de
usabilidade e não precisa de rota.

## Regras que o backend precisa repetir

O frontend valida tudo, mas o servidor não pode confiar no cliente:

- **Item (RF002 CA02, Q03):** mesmas regras de `validarItem` em `js/dominio/plano.js`.
- **Revisão (RN01):** o rascunho só vira plano em `POST /api/plano/confirmacao`.
  Itens mantidos conservam `vigenteDesde`. Itens que saem ganham `encerradoEm` e vão para `encerrados`.
- **Registro de dose (RN02, RF004):** usar o **relógio do servidor** e as regras de
  `motivoParaRecusarRegistro` em `js/dominio/doses.js`:
  - `dose_inexistente` (404): o id não corresponde a uma dose do plano.
  - `antes_do_horario` (409): ainda não chegou T.
  - `prazo_encerrado` (409): passou o fim da janela (T + 120 min ou a próxima dose do mesmo remédio, o que vier primeiro).
  - `ja_registrada` (409): o registro é final.
- **Desfazer (RF004 E3):** só antes do fim da janela, senão `prazo_correcao` (409).

Códigos de erro e textos: `js/api/erros.js`.

## Web Push (Fase 6)

Para o lembrete tocar com o app fechado, o backend precisa:

1. Gerar um par de chaves VAPID e expor a chave pública (`GET /api/push/chave`).
2. Receber a inscrição do aparelho (`POST /api/push/inscricoes`), uma por aparelho e conta.
3. No horário de cada dose, enviar o push com
   `{ "titulo": "Hora de tomar Losartana 50 mg", "corpo": "1 comprimido, via oral. Toque para registrar.", "hash": "#/hoje?dose=<idDose>" }`.

O `sw.js` já trata o clique na notificação. Falta o evento `push`, que entra junto com o backend.
