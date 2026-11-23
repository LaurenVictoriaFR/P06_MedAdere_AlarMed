// Relógio único do app. Nos testes de usabilidade, ?agora=2026-10-17T08:05 na URL
// fixa o ponto de partida, e o tempo continua correndo a partir dele.
// Ex.: http://localhost:5173/?agora=2026-10-17T08:05#/hoje

function lerAgoraDaUrl() {
  try {
    const valor = new URLSearchParams(window.location.search).get('agora');
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor ?? '');
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const base = new URLSearchParams(window.location.search).get('mock') === '1' ? lerAgoraDaUrl() : null;
const carregadoEm = Date.now();
let servidor = null;
let sincronizadoEm = 0;

export const relogio = {
  simulado: base !== null,
  sincronizar(iso) {
    servidor = new Date(iso).getTime();
    sincronizadoEm = performance.now();
  },
  agora() {
    if (servidor !== null) return new Date(servidor + performance.now() - sincronizadoEm);
    return base ? new Date(base.getTime() + (Date.now() - carregadoEm)) : new Date();
  },
};
