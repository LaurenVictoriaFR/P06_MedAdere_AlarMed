// Service worker do AlarMed: guarda a casca do app para abrir sem internet
// e trata o toque na notificação (abre "Doses de hoje" com a dose em destaque).
//
// Estratégia: rede primeiro, cache como reserva. Assim cada atualização do
// código aparece na hora, e o app ainda abre offline.

const VERSAO = 'alarmed-v3';

const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/componentes.css',
  './css/telas.css',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/relogio.js',
  './js/notificacoes.js',
  './js/api/api.js',
  './js/api/api-mock.js',
  './js/api/erros.js',
  './js/dominio/tempo.js',
  './js/dominio/plano.js',
  './js/dominio/doses.js',
  './js/dominio/adesao.js',
  './js/ui/componentes.js',
  './js/ui/icones.js',
  './js/ui/toast.js',
  './js/ui/foto.js',
  './js/ui/formato.js',
  './js/ui/contraste.js',
  './js/telas/p08-entrar.js',
  './js/telas/p01-cadastro.js',
  './js/telas/p02-revisao.js',
  './js/telas/p03-hoje.js',
  './js/telas/p04-painel.js',
  './js/telas/p07-plano.js',
  './js/telas/p09-notificacao.js',
  './js/telas/estilo.js',
  './assets/img/simbolo.png',
  './assets/img/login-fundo.webp',
  './assets/icons/icon-192.png',
  './assets/icons/favicon-64.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const ehFonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !ehFonte) return;

  evento.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    try {
      const resposta = await fetch(request);
      if (resposta.ok || resposta.type === 'opaque') cache.put(request, resposta.clone());
      return resposta;
    } catch {
      const guardada = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (guardada) return guardada;
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw new Error('offline');
    }
  })());
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const hash = evento.notification.data?.hash ?? '#/hoje';
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (aberta) {
      await aberta.focus();
      aberta.postMessage({ tipo: 'abrir', hash });
      return;
    }
    await self.clients.openWindow(new URL(`./${hash}`, self.registration.scope).href);
  })());
});
