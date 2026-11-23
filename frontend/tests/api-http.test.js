import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = { location: { search: '' } };
const api = await import('../js/api/api-http.js');
const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

test('API real envia cookie e apenas o status; horário vem do servidor', async () => {
  let chamada;
  globalThis.fetch = async (url, opcoes) => {
    chamada = { url, opcoes };
    return new Response(JSON.stringify({ status: 'tomada', em: '2026-11-22T11:05:00Z' }), { status: 200 });
  };
  const r = await api.registrarDose('item@2026-11-22T08:00', 'tomada');
  assert.equal(chamada.opcoes.credentials, 'same-origin');
  assert.equal(chamada.opcoes.cache, 'no-store');
  assert.deepEqual(JSON.parse(chamada.opcoes.body), { status: 'tomada' });
  assert.equal(r.em, '2026-11-22T11:05:00Z');
});
test('API real propaga 409 e campos inválidos do servidor', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ mensagem: 'Prazo encerrado', camposInvalidos: {} }), { status: 409 });
  await assert.rejects(api.registrarDose('x', 'tomada'), e => e.status === 409 && e.message === 'Prazo encerrado');
});
test('sessão expirada não reaproveita identidade local', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  assert.equal(await api.sessao(), null);
});
test('API indisponível produz erro de conexão sem sucesso simulado', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(api.registrarDose('x', 'tomada'), e => e.status === 0);
});
test('tradução do plano preserva duração, quantidade e instante de confirmação', () => {
  const item = api.traduzirItem({ id: 'i', nomeMedicamento: 'Fictício', dosagem: '50 mg · 2 cápsulas',
    duracaoTratamento: '7 dias', horarios: ['08:00:00'], viaAdministracao: 'oral' },
  { dataInicio: '2026-11-22', confirmadoEm: '2026-11-22T10:00:00Z' });
  assert.equal(item.qtd, 2); assert.equal(item.unidade, 'capsula');
  assert.equal(item.fim, '2026-11-28'); assert.equal(item.vigenteDesde, '2026-11-22T10:00:00Z');
});
