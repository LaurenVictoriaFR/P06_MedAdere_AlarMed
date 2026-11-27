# Frontend do AlarMed

Telas do AlarMed (P06 MedAdere, COMP0503, UFS) em HTML, CSS e JavaScript, sem
framework e sem etapa de build. Mobile-first e instalável como PWA.

## Como rodar

**Com a API real (padrão).** A aplicação Java serve a PWA e a API no mesmo endereço,
http://localhost:8080. Execute conforme o README da raiz. `js/api/api-http.js` usa a
sessão HTTP e os dados do servidor; nenhuma senha é guardada no navegador nesse modo.

**Só as telas, sem o back-end (modo de demonstração).** Precisa do Node 20 ou mais recente:

```bash
cd frontend
node servidor.mjs
```

| URL | Para quê |
|---|---|
| `http://localhost:5173/?mock=1` | Telas com os dados guardados no navegador (`api-mock.js`) |
| `http://localhost:5173/?mock=1&demo=1` | Mostra o botão "Usar dados de demonstração" (conta fictícia com 45 dias de histórico) |
| `http://localhost:5173/?mock=1&demo=1&agora=2026-10-17T08:05` | Fixa o relógio no cenário do protótipo; o tempo continua correndo a partir dele |
| `http://localhost:5173/?mock=1#/estilo` | Guia de componentes e tabela de contraste |

Só no modo de demonstração há `localStorage` e relógio simulado. As notificações
locais do mock exigem o app aberto e não substituem a validação do push real.
Para zerar os dados: DevTools → Application → Local Storage → apagar `alarmed:v1`.

## Testes e linter

```bash
cd frontend
npm ci          # instala o ESLint, a única dependência (só de desenvolvimento)
npm run lint    # ESLint
node --test     # testes
```

Os testes cobrem as regras de domínio (cadastro e login do UC-05 e UC-06, validação
do item, RN01, janela de 2 h com Sem confirmação, dia da dose, taxa do mês e taxa
atual), o adaptador HTTP (inclusive a alteração do plano do UC-04, contra um servidor
falso que segue o contrato), o fuso do servidor, o evento push no service worker e os
pares de cor do RNF001, lidos de `css/tokens.css`. Não substituem a revisão visual
nem o recebimento do push num aparelho real. No CI, o linter e os testes rodam no
job `frontend`.

## Telas e rotas

| Tela | Rota | Requisitos |
|---|---|---|
| P08 Entrar / Criar conta | `#/entrar` | RF009, RF001, UC-05, UC-06 |
| P01 Cadastro / Adicionar medicamento | `#/cadastro` | RF002, RF008, RN01, UC-01 |
| P02 Revisão e confirmação | `#/revisao` | RF002, RF010, RN01, RN05, UC-08 |
| P03 Doses de hoje | `#/hoje` | RF004, RN02, UC-02 |
| P04 Painel do mês (com "Imprimir ou salvar em PDF") | `#/painel?mes=AAAA-MM` | RF005, UC-03 |
| P07 Meu plano | `#/plano` | RF010, RN01, UC-04 |
| P09 Lembrete (teste e simulação) | `#/notificacao` | RF003, UC-07 |

## Estrutura

```
frontend/
├── index.html, manifest.webmanifest, sw.js   página única, PWA e service worker (cache e push)
├── servidor.mjs                              servidor estático do modo de demonstração (porta 5173)
├── API.md                                    contrato da API usado pelo front
├── eslint.config.js, package.json            linter (TD-07)
├── css/        tokens (cores e medidas), base, componentes, telas
├── js/
│   ├── app.js          rotas, guardas de acesso, abas, relógio da tela
│   ├── router.js       roteamento por hash (#/rota?parâmetros)
│   ├── relogio.js      relógio do servidor ou simulado (?agora=)
│   ├── notificacoes.js permissão, inscrição de push e lembretes
│   ├── dominio/        regras puras, sem DOM (testadas com node --test)
│   ├── api/            api.js escolhe api-http.js (padrão) ou api-mock.js (?mock=1)
│   ├── ui/             componentes, ícones, toast, formatação, contraste
│   └── telas/          uma por tela, mais o guia de estilo
├── assets/     símbolo do logo, foto do login, ícones da PWA
└── tests/
```

Regras do código:

- Nenhuma tela calcula regra de negócio: tudo passa por `js/dominio/`.
- Texto digitado pelo usuário só entra no DOM como nó de texto (`h()` em `ui/componentes.js`), nunca como HTML.
- O estado da dose aparece sempre escrito e com ícone, não só pela cor (RNF001).

## Limitações desta versão

- **Foto da caixa e observação:** com a API real, ainda não são enviadas: o servidor ainda não tem as rotas da foto (RF008) nem o campo de observação.
- **Alterar o plano (P07):** funciona com a API real (UC-04). A mudança fica pendente até a revisão no P02, e o plano confirmado continua valendo até lá. Editar um item ainda é remover e adicionar de novo. "Desfazer" uma remoção só devolve o item igual quando ela foi a única mudança; nos outros casos, o remédio volta como item novo.
- **Painel:** as taxas são calculadas no aparelho, com as doses e os registros do servidor.
- **Push:** o recebimento com o app fechado ainda não foi validado num aparelho real. No iPhone, só com o app na Tela de Início (iOS 16.4+).
- **Login:** sem bloqueio por tentativas, e a sessão fica na memória do servidor. Use só dados fictícios.
