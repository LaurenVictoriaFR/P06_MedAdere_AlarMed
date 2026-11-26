# Contrato da API — Bloco C (P4)

UC-04 Alterar plano confirmado (RF010, RN01) e RF008 Foto da caixa. Mesmo padrão de
`frontend/API.md`: sem prefixo de rotas, sessão por cookie, erros no formato
`{mensagem, camposInvalidos}` (400 formato, 401 sem sessão, 404 inexistente ou de
outro paciente, 409 regra de negócio). Fica em `docs/` porque o front é exclusivo do
Bloco E (Plano de Divisão do P4); o E decide se copia para `frontend/API.md`.

Rastreabilidade: P2 UC-04, UC-08, SD04, MOD-01, MOD-03, DM07, DM09; P3 ASR-03,
QS-04, QS-06, QS-13, ADR-09, ADR-10, BL-04, BL-06, BL-07, BL-15, TD-03, TD-05,
TD-08, QP-07, Q-01, DA-01, DA-02.

## UC-04 — Alterar plano confirmado

### Modelo

As operações seguem o P2 (MOD-03 e SD04): `iniciarAlteracao()`, `revisarPlano()`,
`editarPlano()`, `confirmarPlano()`, `cancelarAlteracao()` e `encerrarPlano()`.
A situação do plano só muda por elas.

`iniciarAlteracao()` abre uma **versão em edição** do plano confirmado, com cópia
dos itens. O plano confirmado continua valendo e gerando lembretes até a versão
nova ser revisada e confirmada (P2 seção 7: "a alteração fica pendente até a
revisão no P02"; UC-04 A3: cancelar não aplica nada). Na confirmação, a versão
anterior passa por `encerrarPlano()` (CONFIRMADO → ENCERRADO, com `dataFim`). Isso
também atende ao ADR-09 ("a confirmação exige a versão revisada do plano").

```
CONFIRMADO (v1) --iniciarAlteracao()--> v2 EM_EDICAO --revisarPlano()--> v2 EM_REVISAO
                                           ^                                |
                                           +---------- editarPlano() -------+
v2 EM_REVISAO --confirmarPlano()--> v2 CONFIRMADO + v1 ENCERRADO (encerrarPlano)
v2 (EM_EDICAO ou EM_REVISAO) --cancelarAlteracao()--> v2 apagada; v1 segue valendo
```

### Rotas

| Método e rota | Operação | Resposta |
| --- | --- | --- |
| POST /planos/{id}/alteracao | `iniciarAlteracao()`. `{id}` é o plano CONFIRMADO. Cria a versão em edição ou retoma a que já existir | PlanoResponse da versão; 201 se criou, 200 se retomou |
| GET /planos/rascunho | Já existente. Devolve também a alteração pendente (`planoAnteriorId` preenchido) | PlanoResponse; 404 sem rascunho |
| POST /planos/{idNovo}/itens | Já existente: adicionar item | PlanoResponse |
| DELETE /planos/{idNovo}/itens/{itemId} | Já existente: remover item | PlanoResponse |
| PUT /planos/{idNovo}/itens/{itemId} | **Opcional (BL-06)**: editar item no lugar, mesmo corpo do POST de itens. Só em EM_EDICAO | PlanoResponse |
| POST /planos/{idNovo}/revisar | Já existente (UC-08) | PlanoResponse |
| POST /planos/{idNovo}/editar | Já existente (UC-08 A1 / UC-04 A4) | PlanoResponse |
| POST /planos/{idNovo}/confirmar | Já existente. Na alteração, também encerra a versão anterior | PlanoResponse |
| DELETE /planos/{idNovo} | Já existente; na alteração é o `cancelarAlteracao()` (UC-04 A3) | 204 |

Sem o BL-06, editar um item continua sendo remover e adicionar (como o P07 já faz).

### Campos novos

PlanoResponse:

| Campo | Tipo | Significado |
| --- | --- | --- |
| planoAnteriorId | UUID ou null | Na alteração, o plano confirmado que esta versão substitui. null no primeiro cadastro |

ItemDoPlanoResponse:

| Campo | Tipo | Significado |
| --- | --- | --- |
| itemOrigemId | UUID ou null | Item do plano anterior de onde a cópia veio; null para item novo. Use para comparar confirmado × pendente (o `id` da cópia é outro) |
| inicioTratamento | data ou null | Início da contagem da duração deste item. Cópia (e item editado pelo BL-06) mantém a data do original; item novo recebe a data da confirmação. null antes de confirmar |
| temFoto | boolean | Item tem foto da caixa (RF008) |

### Doses ao confirmar a alteração (DM09, ADR-10, resposta à Q-01 / QS-13)

Tudo numa transação:

1. A versão nova vira CONFIRMADO; a anterior vira ENCERRADO com `dataFim` = hoje.
2. Doses **Programadas** da versão anterior (horário ainda não atingido) são
   apagadas e substituídas pelas da versão nova (DM09).
3. Doses **Pendentes** da versão anterior (janela aberta) são mantidas até a
   janela fechar: o paciente ainda pode registrar a dose que está para tomar. É a
   opção sugerida na Q-01 do P3.
4. Doses **Tomadas, Não tomadas e Sem confirmação** não mudam: histórico e painel
   continuam corretos (DM09).
5. As doses da versão nova são geradas a partir do instante da confirmação (o
   gerador já ignora horários anteriores ao `confirmadoEm`).
6. A duração conta a partir de `inicioTratamento` de cada item: alterar o plano no
   5º dia de um antibiótico de "7 dias" não reinicia a contagem. *Exige ajuste de
   uma linha no `GeradorDoses` (Bloco D), combinado com o Artur.*

### Regras e erros

| Situação | Resposta | Origem |
| --- | --- | --- |
| Confirmar a alteração sem revisar | 409 | RN01, UC-04 A2, QS-04 |
| Revisar a alteração com 0 itens | 409 | regra já existente |
| Item sem nome, dosagem, frequência, duração ou horário; horário repetido; duração fora de "uso contínuo", "N dias" ou "até DD/MM/AAAA" | 400 com `camposInvalidos` no POST/PUT do item, não só na confirmação | UC-04 A1, TD-03 |
| `/alteracao` em plano que não está CONFIRMADO | 409 | MOD-03 |
| `/alteracao` em plano de outro paciente ou inexistente | 404 | QS-06 |
| POST /planos (novo cadastro) com plano confirmado existente | 409, indicando usar `/alteracao`; com rascunho em EM_EDICAO ou EM_REVISAO, retoma | TD-08, BL-04 |
| Duas edições simultâneas no mesmo plano | 409 (bloqueio otimista, `@Version`) | TD-05, BL-15 |

Garantias: no máximo **um** plano CONFIRMADO e **uma** versão em edição/revisão por
paciente (TD-08). O `GET /planos/rascunho` passa a consultar pelo service (QP-07).

## RF008 — Foto da caixa (DA-02, BL-07)

Primeiro item a cortar se atrasar (Plano de Divisão do P4, seção 4). Cortado,
`temFoto` vem sempre `false`.

| Método e rota | Função |
| --- | --- |
| PUT /planos/{id}/itens/{itemId}/foto | `multipart/form-data`, campo `arquivo`. Grava ou substitui; 204 |
| GET /planos/{id}/itens/{itemId}/foto | Devolve a imagem com o Content-Type original; 404 sem foto |
| DELETE /planos/{id}/itens/{itemId}/foto | Remove a foto; 204 |

Decisão da DA-02:

- **Onde fica:** no banco (tabela própria, ligada ao item, apagada em cascata com
  ele, MOD-01). Não precisa de volume no Docker e a demo fica reproduzível.
- **Formatos:** JPEG, PNG ou WebP, conferidos pelo conteúdo do arquivo e não só
  pela extensão; outro formato: 400.
- **Tamanho máximo:** 2 MB; acima disso, 400 (o front deve reduzir antes de enviar).
- **Quando:** só com o plano em EM_EDICAO, como qualquer mudança no item (MOD-03).
  Num plano confirmado, a foto entra por `/alteracao` e passa pela revisão.
- **Na alteração:** a cópia do item mantém a foto do original.
- **Acesso:** só o paciente dono do plano (404 para outro, QS-06).
