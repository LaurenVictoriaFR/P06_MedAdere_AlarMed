// RNF001: confere os pares de cor usados pelo app contra o WCAG AA,
// lendo os valores direto de css/tokens.css (o CSS é a fonte da verdade).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { razaoContraste, PARES_DE_COR } from '../js/ui/contraste.js';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]));

test('todos os tokens citados existem em tokens.css', () => {
  for (const [a, b] of PARES_DE_COR) {
    assert.ok(tokens[a], `${a} não encontrado`);
    assert.ok(tokens[b], `${b} não encontrado`);
  }
});

for (const [texto, fundo, minimo] of PARES_DE_COR) {
  test(`${texto} sobre ${fundo} ≥ ${minimo}:1`, () => {
    const r = razaoContraste(tokens[texto], tokens[fundo]);
    assert.ok(r >= minimo, `${tokens[texto]} sobre ${tokens[fundo]} = ${r.toFixed(2)}:1`);
  });
}
