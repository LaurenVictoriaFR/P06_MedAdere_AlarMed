# Correção do feedback — doses sem confirmação

Base: branch feat/bloco-de-doses-lembretes, commit 5b462ee7c49049d3778cafc1a142f43fe7c70327.

## Comportamento

Programada antes de T; Pendente entre T e F; Tomada ou Não tomada somente por declaração. Sem declaração até F, Sem confirmação, sem Registro de consumo. A origem automática não comprova não ingestão. Desfazer declaração só antes de F; Sem confirmação não aceita desfazer nem novo registro. Uma declaração válida é preservada após F.

F é o início do minuto 121 após T, ou a próxima dose do mesmo item, o que ocorrer antes (precisão por minuto do QS-02). Os testes verificam 119, 120, 120:59 e 121 minutos, próxima dose e concorrência.

O banco recebe uma nova migração; não se altera o SQL antigo, não se apaga o banco e não se executa Flyway repair. Antigas NAO_TOMADA com automatica=true viram SEM_CONFIRMACAO, com registrado_em nulo. Declarações manuais e histórico são preservados.

GET /registros devolve só declarações. GET /doses inclui sem_confirmacao com registro nulo. Sem confirmação não é um status aceito em PUT /registros.

## Integração necessária com o Bloco E

Foram ajustados domínio de adesão, painel, resumo do dia, selos e estilos compartilhados para aceitar o novo estado. Revisar esses arquivos com o responsável pelo painel antes da integração.

Conforme MOD-02 do P2, taxa = Tomadas declaradas / (Tomadas declaradas + Não tomadas declaradas + Sem confirmação). Sem confirmação tem contagem própria, não é renomeada como Não tomada. Pendentes e futuras não entram. Denominador zero mostra —. Taxa do mês considera o mês selecionado; taxa atual considera o histórico até agora, com filtro opcional de medicamento. No mês corrente, doses futuras ficam fora. Essa taxa mede registros, não adesão clínica. O cálculo ainda é feito no cliente; a exigência ASR-05 de cálculo no servidor permanece para alinhamento com o Bloco E.

## Documentos — ordem de correção

1. Bloco D, P2 seção 3: uniformizar glossário e decisões DM02/04/05, preservando MOD-05. Não substituir Sem confirmação por Não tomada automática. Dose passada para o indicador é Tomada, Não tomada declarada ou Sem confirmação, excluindo Pendente e Programada. Separar taxa do mês e taxa atual. O modelo de domínio deve prever SEM_CONFIRMACAO e o registro opcional somente nas declarações.
2. Bloco D, P2 seção 6.2: usar os cinco estados e as regras acima. A fonte UML desta correção está em docs/diagramas/dose-sem-confirmacao.puml. As duas imagens entregues anteriormente no chat precisam ser substituídas por versões coerentes; não usá-las como versão final.
3. Bloco C, P2 seções 4, 5 e 6.1: compatibilizar UC-02, UC-03, MOD-02/MOD-05, enum EstadoDose, operações das classes e sequências. O P2 já contém Sem confirmação em partes dessas seções; preservar essa correção. Uniformizar o limite temporal e registrar o desfazimento. Revisar RN05 onde houver referência sem definição correspondente no P1.
4. Bloco E, P2 seções 7/8/9: P03 e P04 devem separar os resultados. Atualizar rastreabilidade e checklist; retirar pendências já resolvidas e manter as ainda abertas, sem marcar tudo como OK.
5. Blocos A/B: corrigir ADR-04, R04 e textos de autenticação: o código usa BCrypt. Bloqueio por tentativas é requisito separado, ainda não comprovado. Não editar migrations SQL antigas para remover seus comentários históricos. Compatibilizar o modelo Conta/Paciente/Cuidador com MOD-04 e com o cadastro real: o código consultado ainda cria Paciente com o nome da Conta e guarda data de nascimento na Conta; não afirmar que o cadastro de cuidador com dados independentes está implementado.
6. Bloco B, P1: atualizar RN02, RF004, RF005, histórias, aceitação, glossário e protótipos. Também conferir OBJ01 (planejamento de avaliação), responsáveis dos riscos e duplicidade do agendamento em UC01, conforme feedback. Não inventar estudo com grupo controle ou validação com usuários.
7. Bloco D, P3 5.1/5.3/8.1–8.4: corrigir os resultados de dose, o contrato de registros e a migração. Registrar os novos testes e resultados observados, junto ao commit final real. Não reaproveitar os totais antigos como prova desta versão. A meta de 95% de push em 60 s exige medição própria e não foi demonstrada por checks ou resposta 2xx do provedor.
8. Todos: atualizar P3 15 com contribuição/commit/PR reais; A atualiza ADRs/ATAM; E atualiza resumo, débitos, backlog, matriz e checklist. Remover a frase de correções pendentes do P2 somente após aplicá-las e conferir.

## Validação e entrega

Rodar `npm test --prefix frontend` e `./mvnw test` com JDK 21. O perfil de testes usa H2; conferir também PostgreSQL. Fazer ensaio visual: registrar Tomada, desfazer dentro da janela, registrar Não tomada e observar uma dose expirada como Sem confirmação, separada no painel e na impressão. Dados e senha somente fictícios. Confirmar push real com a PWA fechada após a integração.

A PR existente deve receber o novo commit na mesma branch, mantendo-a em rascunho até revisão e checks. Não executar merge automático. Depois da revisão cruzada e dos documentos atualizados, consolidar P1/P2/P3 e o pacote conforme a atividade. Não declarar a entrega pronta antes dessa conferência.
