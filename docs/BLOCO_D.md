# Implementação do Bloco D

## Fluxo implementado

A confirmação de um plano revisado registra `confirmadoEm` e `fusoHorario` e gera
as doses iniciais na mesma transação. Rascunhos não geram doses. A geração
seguinte usa um cursor `geradoAte` e bloqueio do plano; a chave por item, data e
horário e a restrição de unicidade do banco impedem duplicações.

As doses passam de PROGRAMADA para PENDENTE ao atingir T. O servidor aceita
TOMADA ou NAO_TOMADA na janela e encerra como SEM_CONFIRMACAO quando ela termina sem declaração.
O limite acompanha os testes existentes: T+120min59s é aceito; T+121min é recusado.
A próxima dose do mesmo item pode encerrar a janela antes. Não existe registro
retroativo antes de T. O dia da dose é o dia de seu horário programado, mesmo
quando o registro ocorre após a meia-noite.

`Clock` é injetável. API, consulta e agendador usam bloqueio pessimista da dose.
Um registro válido não é sobrescrito pela expiração. Desfazer é uma operação
explícita, somente dentro da janela; o lembrete já enviado não é reenviado ao
desfazer. Rejeitar um registro atrasado preserva a marcação automática no banco.

## Duração e fuso

O contrato do Bloco C foi preservado: `duracaoTratamento` continua em texto.
A confirmação valida os formatos `uso contínuo`, `N dias` (1 a 365), e
`até DD/MM/AAAA` ou `até AAAA-MM-DD`. Texto desconhecido e datas inválidas são
recusados. O último dia é inclusivo. Tratamento contínuo não gera doses infinitas.

A referência inicial é a confirmação, não a abertura do rascunho. Horários
anteriores ao instante de confirmação não geram doses. Segundos nos horários
são recusados: o contrato é HH:MM. O fuso é fixado no plano; suporte individual
a viagens/trocas de fuso permanece pendente. Mantenha APP_ZONE consistente com
os planos existentes. UTC no banco não significa tomar o medicamento no horário UTC.

A migração de planos antigos confirmados precisa aproximar a confirmação a
partir de data_inicio, pois a versão anterior não guardava seu instante. Para
avaliar o fluxo novo, use planos sintéticos criados nesta versão.

## Push e recuperação

Um Lembrete corresponde a uma dose. EntregaPush separa tentativas por aparelho:
aparelhos já aceitos não são reenviados em uma repetição destinada a outro
aparelho. Erros transitórios permitem até três tentativas, com intervalo crescente
(30 e 60 s), somente dentro da janela. 404/410 desativam a inscrição; a interface
permite recriá-la. Provedores aceitos por padrão: fcm.googleapis.com,
updates.push.services.mozilla.com e web.push.apple.com. A propriedade
`alarmed.push.hosts` pode ser ajustada pelo operador para outro provedor legítimo.
Não há redirecionamento HTTP no envio.

O payload usa AES128GCM e VAPID. TTL e expiraEm limitam avisos atrasados. O service
worker descarta payload expirado e usa a dose como tag de notificação. Só recursos
estáticos são guardados no cache; dados autenticados exigem rede.

Sem chaves ou inscrição, as doses continuam funcionando e o impedimento do push
fica visível. Problemas de envio nas últimas 24 h são consultados por conta e
avisados no próximo acesso às doses. O serviço não simula recebimento. `ACEITA_PELO_SERVICO` é a resposta
do provedor; confirmação de exibição no aparelho não foi implementada.

Não se promete entrega exatamente uma vez entre banco e provedor externo. Uma
queda após aceitação externa e antes do commit pode causar repetição; a tag
estável reduz duplicações visuais. Locks e unicidade protegem a persistência.
Uma carga grande ou provedor lento pode exceder a meta de 60 s: é preciso medir
QS-01 no ambiente de demonstração e dimensionar antes de escalar.

## Integração fora dos pacotes do Bloco D

Mudanças necessárias na base compartilhada:

- PlanoMedicamentoso e PlanoResponse: instante de confirmação, fuso e cursor.
- PlanoMedicamentosoService: validação e geração na confirmação.
- PlanoMedicamentosoRepository: bloqueio de geração e IDs confirmados.
- comum.util.DuracaoTratamento: validação reutilizável da duração.
- TempoConfig: Clock, fuso e habilitação do agendador.
- SessaoController: consultar a sessão e efetivar logout para a PWA real.
- RascunhoController: retomar cadastro/revisão sem perder dados ao recarregar.
- CacheConfig e tratamento de erros: respostas autenticadas sem cache e erros coerentes.
- pom.xml: biblioteca de push e criptografia; frontend no JAR; H2 disponível no perfil demo.
- Migração nova: colunas e tabelas, preservando as três migrações existentes.
- Telas: integração HTTP, revisão no servidor, doses reais e estado das notificações.

Esses arquivos devem ser revistos com B/C/E ao integrar no GitHub. A arquitetura,
o cálculo do painel no servidor e a consolidação documental continuam com seus
respectivos responsáveis. Não foi implementado UC-04 para ampliar escopo.

## Referências técnicas utilizadas

- https://github.com/web-push-libs/webpush-java
- https://github.com/web-push-libs/webpush-java/blob/master/src/main/java/nl/martijndwars/webpush/Notification.java
- https://datatracker.ietf.org/doc/html/rfc8291
- https://datatracker.ietf.org/doc/html/rfc8292

## Correção após o feedback da professora

SEM_CONFIRMACAO não representa declaração de não ingestão, não possui registradoEm e não cria RegistroResponse. O painel separa as três contagens e mantém a taxa de registros Tomada sobre Tomada + Não tomada declarada + Sem confirmação, conforme MOD-02. Pendentes e futuras ficam fora; denominador zero resulta em —. O cálculo permanece no cliente (limitação ASR-05 a alinhar com o Bloco E). Evidências antigas descrevem a versão anterior e não substituem a nova execução.
