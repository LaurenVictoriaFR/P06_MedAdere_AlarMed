# AlarMed

PWA de adesão medicamentosa do Projeto Integrador P06 (COMP0503, UFS).
Esta versão integra o Bloco D à base existente: doses persistidas, consumo,
agendador, Web Push e telas conectadas à API real.

## Primeiro teste local

Requer JDK 21 completo, Node.js 20+ para gerar VAPID e testar o front-end, e Python 3.9+ para o ensaio HTTP opcional.

```bash
./mvnw verify
node scripts/gerar-vapid.mjs
./mvnw spring-boot:run -Dspring-boot.run.profiles=demo
```

No Windows, use `mvnw.cmd` no lugar de `./mvnw`.
Abra http://localhost:8080. Crie uma conta fictícia, cadastre os medicamentos,
revise e confirme o plano. As doses são criadas no servidor na confirmação.
O perfil `demo` usa H2 em arquivo (`dados-demo/alarmed`), preservando os dados
entre reinícios. A sessão exige novo login após reiniciar o servidor.
Não use dados de pessoas reais. Para uma demonstração nova, pare a aplicação e
mova a pasta `dados-demo` para outro local.

As chaves VAPID são opcionais para testar doses e consumo. Sem elas, a tela avisa
que o push está desativado. O gerador cria `.env`, lido automaticamente pelo
Spring. Preserve esse arquivo local e nunca o envie ao GitHub. O gerador recusa
sobrescrever chaves já existentes.

## Executar com Docker

Requer apenas o Docker (com Docker Compose). Não é preciso instalar Java nem Maven.

```bash
docker compose up --build
```

Quando os logs mostrarem `Started AlarMedApplication`, abra http://localhost:8080.
Para encerrar, use `Ctrl+C` e depois `docker compose down`.

- Funciona sem o arquivo `.env`: o banco usa os padrões locais e o push fica
  desativado (a tela avisa). Para ativar o push, gere as chaves com
  `node scripts/gerar-vapid.mjs` (seção "Primeiro teste local"); o Compose lê o
  `.env` da raiz e repassa as chaves ao container. O `.env` nunca entra na imagem.
- O banco PostgreSQL sobe primeiro. A aplicação só inicia depois que ele aceita
  conexões (healthcheck), evitando falha de conexão na partida.
- O `Dockerfile` tem duas etapas: a primeira usa JDK e Maven para gerar o JAR; a
  segunda contém apenas o Java e o JAR, resultando em uma imagem menor e sem
  ferramentas de compilação. Os testes não rodam no build da imagem, pois já
  rodam na CI.
- A CI publica o JAR como artefato (`alarmed-jar`) a cada execução na `main`.

## PostgreSQL

O perfil padrão mantém PostgreSQL 16 e as variáveis DB_URL, DB_USER e DB_PASSWORD.
Para desenvolver com o app fora do Docker, suba só o banco:

```bash
docker compose up -d db
./mvnw spring-boot:run
```

Padrões apenas locais: banco, usuário e senha `alarmed`; porta 5432.
Frontend e API são servidos juntos na porta 8080. Não é necessário configurar CORS.
As migrações do Flyway são automáticas; não altere migrações já aplicadas.

## Testes

```bash
./mvnw verify
cd frontend
node --test
```

Com a aplicação já ligada, na raiz:

```bash
python3 scripts/teste-api.py
```

O ensaio HTTP cria dados sintéticos e verifica cadastro, sessão, revisão,
confirmação, geração de doses, recusas e logout. Não espera a janela de duas horas:
os testes Java usam Clock controlável para esses limites.

O ensaio opcional de interface exercita as telas em DOM com API real. Ele cria
uma dose no próximo minuto e espera até ela ficar disponível (até cerca de 70 s).
Requer Node 24.15+ ou outra versão aceita em scripts/qa/package.json:

```bash
npm --prefix scripts/qa install
npm --prefix scripts/qa test
```

Use apenas em um ambiente de desenvolvimento com dados sintéticos. Esse ensaio
não substitui revisão visual em navegador nem teste de push em aparelho real.

## Estilo de código (Checkstyle)

O back-end usa o Checkstyle com o conjunto de regras Google checks, que padroniza o
estilo e a legibilidade do código (imports, Javadoc, tamanho de linha, entre outros).
A indentação foi ajustada para 4 espaços, padrão do código já existente.

Para verificar localmente antes de abrir a PR:

```bash
./mvnw validate
```

O `./mvnw verify` e a CI também executam essa verificação. Havendo violação, o build
falha e a mensagem indica a regra e a linha.

O arquivo `config/checkstyle-suppressions.xml` isenta 56 arquivos herdados do P3,
cujas violações são, em sua maioria, estéticas. O grupo decidiu aceitá-las como débito
técnico e exigir o padrão nos arquivos novos. A isenção vale para o arquivo inteiro:
um arquivo antigo editado continua isento enquanto estiver nessa lista.

Para quitar o débito de um arquivo, corrija as violações dele e remova a linha
correspondente em `config/checkstyle-suppressions.xml`.

## Lembretes com o app fechado

1. Gere as chaves VAPID antes de iniciar a aplicação.
2. Entre na conta e abra Doses de hoje.
3. Toque em Ativar lembretes e permita as notificações.
4. Na simulação de lembrete, use Enviar um lembrete de teste.
5. Cadastre previamente uma dose alguns minutos à frente; feche a PWA e aguarde o horário.
6. Ao tocar no aviso, confira a abertura da dose correspondente.

A aceitação pelo provedor de push não comprova recebimento no aparelho.
O teste real exige navegador compatível, permissão, internet, servidor ativo e
contexto seguro (HTTPS; localhost é adequado no mesmo computador).
No iPhone/iPad, teste a PWA instalada na Tela de Início. Acesso por um endereço
HTTP da rede local não substitui esse teste em HTTPS.

O agendador varre a cada 30 s. Usa uma janela de geração de hoje + 7 dias e
recupera intervalos não gerados após reinício. Horários do plano usam o fuso
fixado na confirmação, por padrão America/Maceio; os instantes ficam em UTC.
O minuto 120 inteiro aceita registro; o início do minuto 121 encerra a janela.
Uma próxima dose do mesmo item encerra a janela anterior no horário dela.

## Frontend isolado

```bash
cd frontend
node servidor.mjs
```

Abra http://localhost:5173/?mock=1&demo=1. Somente esse modo usa dados no navegador.
O teste real usa a aplicação Java na porta 8080. `?agora=...` só funciona junto de `?mock=1`.

## Organização e limites

- `src/main/java/br/ufs/alarmed/dose`: modelo, geração, API, leitura e agendador.
- `src/main/java/br/ufs/alarmed/notificacao`: inscrições, lembretes, entregas e Web Push.
- `frontend/js/api/api-http.js`: integração real, sem guardar senhas no navegador.
- `docs/BLOCO_D.md`: decisões, contratos e arquivos de integração com os outros blocos.
- `docs/PENDENCIAS_RELATORIO.md`: próximas tarefas de documentação e validação humana.
- `docs/VALIDACAO.md`: resultados e limites da verificação desta entrega.

Alteração de plano confirmado (UC-04), fotos, observações estruturadas da receita,
exclusão de conta e implantação final continuam para o P4. O painel existente do
Bloco E recebe registros reais; seu cálculo ainda é realizado pelo front-end.
