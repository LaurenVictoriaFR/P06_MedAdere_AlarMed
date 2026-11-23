# Validação da implementação

Verificação realizada em 22/11/2026, sobre a implementação do Bloco D.

| Verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| Java, JUnit e integração com H2 2.4 | 75 passaram; 0 falhas/erros/ignorados | Banco em memória, relógio controlável |
| Mesma suíte com PostgreSQL 16.9 | 75 passaram; 0 falhas/erros/ignorados | Processo PostgreSQL real, migrações Flyway e locks |
| Frontend com node --test | 83 passaram; 0 falhas | Domínio, HTTP, fuso e eventos do service worker |
| HTTP com aplicação empacotada | Passou | Conta, sessão, revisão obrigatória, plano, doses, recusas e logout |
| Interface com DOM e API real | Passou | Cadastro, plano, revisão, confirmação, consumo, correção, painel e logout |
| Parar e reiniciar a aplicação | Passou | Dados em H2 de arquivo preservados; novo login exigido |
| Transporte Web Push | Passou | Provedor HTTP local: payload criptografado, VAPID, TTL e resposta 201 |
| Recebimento push em aparelho real | Pendente | Requer permissão, contexto seguro e dispositivo |
| Revisão visual no navegador/aparelho | Pendente | Ensaio DOM não mede layout nem instalação |
| GitHub Actions do repositório integrado | Pendente | Precisa dos commits/PR e da execução no GitHub |

A API de situação informa problemas recentes de envio somente ao dono das doses.
Há teste específico desse isolamento. A suíte cobre também dez disputas entre
registro e expiração, varreduras concorrentes, unicidade de geração, recuperação,
inscrição expirada e repetição por aparelho sem reenviar aos que já foram aceitos.

A versão ampliada foi validada em H2 e PostgreSQL. O ensaio completo de interface
foi executado durante a integração; os ajustes finais de aviso de falha e timeout
foram verificados pelos testes Java/HTTP e JavaScript pertinentes.

## Reproduzir

```bash
./mvnw verify
cd frontend
node --test
```

Para repetir com PostgreSQL de teste, use um banco exclusivo e substitua as
credenciais de teste no comando:

```bash
./mvnw verify -Dspring.datasource.url=jdbc:postgresql://localhost:5432/alarmed_teste -Dspring.datasource.username=alarmed -Dspring.datasource.password=alarmed
```

O banco já deve existir. Testes criam dados sintéticos; nunca apontar para dados
reais. A configuração padrão de testes continua usando H2.

O ambiente de verificação tinha Java 21 e compilador, mas não o arquivo ct.sym
necessário ao modo --release. Nele foi usada temporariamente a compilação com
source=21/target=21 (`-Dmaven.compiler.release= -Dmaven.compiler.source=21
-Dmaven.compiler.target=21`). Isso não altera o pom.xml nem reduz a versão da
linguagem. Na máquina da equipe com JDK 21 completo, usar o comando normal acima.

Node usado: 24.22.3. O ensaio opcional de DOM usa jsdom 31.0.1 e tem seus próprios
requisitos em scripts/qa/package.json. Ele não faz parte da instalação necessária
para executar a PWA ou os 83 testes de domínio/HTTP/service worker.

## Evidências e rastreabilidade

As evidências resumidas estão em docs/evidencias. O JSON de testes contém nomes
reais extraídos dos relatórios JUnit da execução com PostgreSQL. Os hashes de
fontes identificam os arquivos desta cópia; não substituem commits/PR reais.
Preencher a seção 8 do P3 somente após revisão humana e repetir os ensaios
necessários no ambiente que será demonstrado.

Uma resposta 2xx de push comprova aceitação pelo serviço externo, sem garantir
recebimento no aparelho. O agendador sequencial e o serviço externo precisam de
medição para a meta QS-01 (95% das solicitações em até 60 s); os testes com relógio
controlado verificam regras e não demonstram essa taxa em produção.
