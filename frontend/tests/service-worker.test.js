import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { sep } from 'node:path';
import vm from 'node:vm';

const fonte = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
function ambiente() {
  const eventos = {}; const avisos = [];
  vm.runInNewContext(fonte, { URL, Date, self: { location: { origin: 'https://teste.local' },
    registration: { scope: 'https://teste.local/', showNotification: async (...a) => avisos.push(a) },
    addEventListener: (nome, fn) => { eventos[nome] = fn; } } });
  return { eventos, avisos };
}
test('evento push mostra a notificação com id estável e rota da dose', async () => {
  const { eventos, avisos } = ambiente(); let concluido;
  eventos.push({ data: { json: () => ({ titulo: 'Hora da dose', corpo: 'Teste', doseId: 'd1',
    hash: '#/hoje?dose=d1', expiraEm: new Date(Date.now() + 60000).toISOString() }) }, waitUntil: p => { concluido = p; } });
  await concluido;
  assert.equal(avisos.length, 1); assert.equal(avisos[0][1].tag, 'd1');
  assert.equal(avisos[0][1].data.hash, '#/hoje?dose=d1');
});
test('push vencido ou inválido não vira aviso tardio', async () => {
  const { eventos, avisos } = ambiente(); let concluido;
  eventos.push({ data: { json: () => ({ titulo: 'Vencido', expiraEm: '2000-01-01T00:00:00Z' }) }, waitUntil: p => { concluido = p; } });
  await concluido; assert.equal(avisos.length, 0);
});
test('service worker não intercepta consultas de dados autenticados', () => {
  const { eventos } = ambiente(); let interceptou = false;
  for (const caminho of ['/sessao', '/doses?de=2026-11-22', '/registros', '/planos/atual']) {
    eventos.fetch({ request: { method: 'GET', url: `https://teste.local${caminho}` }, respondWith: () => { interceptou = true; } });
  }
  assert.equal(interceptou, false);
});

// Todo arquivo que o app carrega precisa estar no cache, senão o app quebra sem internet
// (foi o caso do js/dominio/conta.js, que ficou de fora quando entrou no P3).
test('o cache do service worker tem todos os arquivos do front', async () => {
  const casca = new Set([...fonte.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const pasta = new URL('../', import.meta.url);
  const entradas = await readdir(pasta, { recursive: true });
  const faltando = entradas
    .map((caminho) => caminho.split(sep).join('/'))
    .filter((caminho) => !caminho.startsWith('node_modules/') && !caminho.startsWith('tests/'))
    .filter((caminho) => /\.(js|css|html|webmanifest|png|webp)$/.test(caminho))
    .filter((caminho) => !['sw.js', 'eslint.config.js'].includes(caminho))
    .filter((caminho) => !casca.has(caminho));
  assert.deepEqual(faltando, []);
});
