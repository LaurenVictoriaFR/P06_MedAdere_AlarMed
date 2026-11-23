# Frontend do AlarMed

HTML, CSS e JavaScript, sem build. No modo real, a aplicação Java serve a PWA e a
API no mesmo endereço, http://localhost:8080. Execute conforme o README da raiz.
`js/api/api-http.js` usa sessão HTTP e dados do servidor. Nenhuma senha é guardada
no navegador nesse modo.

Para trabalhar somente nas telas:

```bash
node servidor.mjs
```

Abra http://localhost:5173/?mock=1&demo=1. Somente nesse modo há localStorage e
relógio simulado (`&agora=2026-10-17T08:05`). Notificações locais do mock exigem o
app aberto e não substituem a validação do push real.

```bash
node --test
```

Os testes cobrem domínio, contraste, adaptador HTTP, fuso e tratamento do evento
push no service worker. Não substituem revisão visual nem recebimento em um
aparelho real.
