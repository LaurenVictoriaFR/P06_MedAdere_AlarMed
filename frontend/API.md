# Contrato da API integrada

API real por padrão; `?mock=1` escolhe a demonstração local. Sem prefixo de rotas.
PWA e API são servidas pelo mesmo Spring Boot. `api-http.js` envia o cookie de
sessão e converte respostas no formato das telas.

## Sessão e plano

| Método e rota | Função |
| --- | --- |
| POST /contas | Cadastra paciente e abre sessão; 201 |
| POST /login | Abre sessão; 200 |
| GET /sessao | `{conta, agora, fuso}`; 401 sem sessão |
| POST /logout | Invalida sessão; 204 |
| GET /planos/atual | Plano confirmado do paciente; 404 se inexistente |
| GET /planos/rascunho | Retoma rascunho em revisão/edição; 404 se inexistente |
| POST /planos | Inicia/retoma edição |
| POST /planos/{id}/itens | Adiciona ItemDoPlanoRequest |
| DELETE /planos/{id}/itens/{itemId} | Remove item do rascunho |
| POST /planos/{id}/revisar | Entra em revisão |
| POST /planos/{id}/editar | Volta para edição |
| POST /planos/{id}/confirmar | Exige revisão e gera doses |
| DELETE /planos/{id} | Descarta cadastro ainda não confirmado |

PlanoResponse acrescenta confirmadoEm (Instant), fusoHorario (ZoneId textual).
A duração por item continua em texto validado. O adaptador traduz concentração e
quantidade para dosagem, como `50 mg · 1 comprimido` (até 60 caracteres).
Observações estruturadas e fotos não são salvas no MVP real. Alteração de plano
confirmado continua para P4; a tela real apresenta o plano como somente leitura.

## Doses e registros

| Método e rota | Resposta |
| --- | --- |
| GET /doses?de=AAAA-MM-DD&ate=AAAA-MM-DD | Lista de DoseResponse do paciente |
| GET /registros?de=AAAA-MM-DD&ate=AAAA-MM-DD | Mapa idDose → RegistroResponse, incluindo automáticas |
| PUT /registros/{idDose} | Recebe `{status:"tomada"}` ou `{status:"nao_tomada"}`; devolve registro |
| DELETE /registros/{idDose} | Desfaz somente dentro da janela; 204 |

idDose: `<UUID do item>@<AAAA-MM-DD>T<HH:MM>`. Codificar com encodeURIComponent.
DoseResponse: id, itemId, data, hora, t, fimJanela, estado, automatica e registro.
RegistroResponse: status, em (Instant UTC), automatica.
Sem intervalo: ontem a hoje. Máximo 10 anos de histórico e 31 dias futuros;
só doses já geradas são devolvidas (janela padrão de hoje + 7 dias).
A tela P03 usa estados e prazos devolvidos pelo servidor. A geração é persistida
no banco; o cálculo JavaScript permanece para o mock e o painel existente.

As regras temporais são aplicadas pelo servidor. Alterar ?agora ou o relógio do
aparelho não permite registrar uma dose fora da janela. Regras detalhadas em
`../docs/BLOCO_D.md`.

## Web Push

| Método e rota | Resposta |
| --- | --- |
| GET /push/chave | `{chavePublica, configurado}`; nunca retorna chave privada |
| POST /push/inscricoes | PushSubscription JSON `{endpoint, keys:{p256dh,auth}}`; retorna `{id}`, 201 |
| DELETE /push/inscricoes/{id} | Desativa inscrição da própria conta; 204 |
| DELETE /push/inscricoes | Recebe `{endpoint}` e desativa aquele aparelho da própria conta |
| GET /push/situacao | `{configurado, inscricoesAtivas:[UUID], falhasRecentes}` da própria conta |
| POST /push/teste | `{solicitacoesAceitas, aparelhos}`; envia aviso de teste aos aparelhos ativos da conta |

Todas as rotas de inscrição/situação/teste exigem sessão. A inscrição é
idempotente pelo endpoint. Um endpoint expirado exige uma nova inscrição do
navegador. Logout na PWA desativa e remove a inscrição deste aparelho antes de
invalidar a sessão. Outros aparelhos continuam inscritos.

Payload: titulo, corpo, hash da rota P03, doseId, expiraEm. O agendador usa o TTL
restante da janela. O SW usa doseId como tag e descarta payload vencido.
O retorno 2xx significa aceitação pelo provedor, não comprovação de recebimento.

## Erros

Formato `{mensagem, camposInvalidos}`. 400: formato/status inválido; 401: sessão
inexistente; 404: recurso inexistente ou de outro paciente; 409: regra de negócio
ou conflito concorrente. Falhas de rede são mostradas no cliente como erro de
conexão, sem fallback para sucesso simulado.
