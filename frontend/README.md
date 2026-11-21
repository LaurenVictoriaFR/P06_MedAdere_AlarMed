# AlarMed: frontend

Telas do MVP do AlarMed (P06 MedAdere, COMP0503, UFS) em HTML, CSS e JavaScript,
sem framework e sem etapa de build. Mobile-first e instalável como PWA.

## Como rodar

Precisa do Node 20 ou mais recente (não instala nada).

```bash
cd frontend
node servidor.mjs
```

Abra <http://localhost:5173/>. Para os testes de usabilidade:

| URL | Para quê |
|---|---|
| `/?demo=1` | Mostra o botão "Usar dados de demonstração" (conta fictícia com 45 dias de histórico) |
| `/?demo=1&agora=2026-10-17T08:05` | Fixa o relógio no cenário do protótipo; o tempo continua correndo a partir dele |
| `/#/estilo` | Guia de componentes e tabela de contraste |

Os dados ficam no `localStorage` do navegador. Para zerar: DevTools → Application → Local Storage → apagar `alarmed:v1`.

## Testes

```bash
cd frontend
node --test
```

Cobrem as regras de domínio (cadastro e login do UC-05 e UC-06, validação do item,
RN01, janela de 2 h, dia da dose, taxa mensal) e os pares de cor do RNF001, lidos
de `css/tokens.css`. No CI, rodam no job `frontend`.

## Telas e rotas

| Tela | Rota | Requisitos |
|---|---|---|
| P08 Entrar / Criar conta | `#/entrar` | RF009, RF001, UC-05, UC-06 |
| P01 Cadastro / Adicionar medicamento | `#/cadastro` | RF002, RF008, RN01, UC-01 |
| P02 Revisão e confirmação | `#/revisao` | RF002, RF010, RN01, RN05, UC-08 |
| P03 Doses de hoje | `#/hoje` | RF004, RN02, UC-02 |
| P04 Painel do mês | `#/painel?mes=AAAA-MM` | RF005, UC-03 |
| P07 Meu plano | `#/plano` | RF010, RN01, UC-04 |
| P09 Lembrete (simulação) | `#/notificacao` | RF003, UC-07 |

## Estrutura

```
frontend/
├── index.html, manifest.webmanifest, sw.js, servidor.mjs
├── css/        tokens (cores e medidas), base, componentes, telas
├── js/
│   ├── app.js          rotas, guardas de acesso, abas, relógio da tela
│   ├── dominio/        regras puras, sem DOM (testadas com node --test)
│   ├── api/            interface usada pelas telas + mock em localStorage
│   ├── ui/             componentes, ícones, toast, formatação
│   └── telas/          uma por tela
├── assets/     símbolo do logo, foto do login, ícones do PWA
└── tests/
```

Regras do código:

- Nenhuma tela calcula regra de negócio: tudo passa por `js/dominio/`.
- Texto digitado pelo usuário só entra no DOM como nó de texto (`h()` em `ui/componentes.js`), nunca como HTML.
- O estado da dose aparece sempre escrito e com ícone, não só pela cor (RNF001).

## Limitações desta versão

- **Lembrete com o app fechado** depende de Web Push vindo do backend (ver `API.md`). Por enquanto, o aviso aparece com o AlarMed aberto ou em segundo plano. No iPhone, só com o app na Tela de Início (iOS 16.4+).
- **Dados no navegador:** o mock não sincroniza entre aparelhos. O vínculo à conta (Q02) se cumpre com o backend.
- **Sem hash de senha nem bloqueio** (RNF004 adiado por ADR). Use só dados fictícios.
