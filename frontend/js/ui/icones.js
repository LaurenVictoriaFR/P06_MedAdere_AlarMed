// Ícones de traço (24×24) recriados a partir da folha de referência.
// Herdam a cor do texto (currentColor) e são sempre decorativos (aria-hidden).
// Só constantes deste arquivo entram no SVG: nada digitado pelo usuário passa por aqui.

const CAMINHOS = {
  email: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.2-4 4.4-6 8-6s6.8 2 8 6"/>',
  usuarioMais: '<circle cx="10" cy="8" r="4"/><path d="M2.5 20.5c1-4 4-6 7.5-6 1.6 0 3 .4 4.2 1.1"/><path d="M18.5 14v6M15.5 17h6"/>',
  escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  barras: '<path d="M6 20v-8M12 20V5M18 20v-5M3 20.5h18"/>',
  sino: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  coracao: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',
  lista: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  voltar: '<path d="M15 5 8 12l7 7"/>',
  avancar: '<path d="m9 5 7 7-7 7"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  alerta: '<path d="M12 4 21 19H3L12 4Z"/><path d="M12 10v4M12 16.5v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  entrar: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M3 12h11M10 8l4 4-4 4"/>',
  sair: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M21 12H10M17 8l4 4-4 4"/>',
  camera: '<path d="M4 8.5h3l2-2.5h6l2 2.5h3V19H4V8.5Z"/><circle cx="12" cy="13" r="3.5"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  capsula: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7Z"/><path d="M7 7l7 7"/>',
  meio: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/>',
  desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z"/>',
  compartilhar: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H5v10h14V11h-2"/>',
  celular: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  lixeira: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  // Decorativos do login (imagem de referência)
  coracaoCruz: '<path d="M12 20.5s-8.5-5.1-8.5-11.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.5 2.8c0 6.3-8.5 11.4-8.5 11.4Z"/><path d="M12 9.6v5.8M9.1 12.5h5.8" stroke-width="2.6"/>',
  folhas: '<path d="M11.5 23c.2-6.5 1.6-12 6-17.5" stroke-width="1.2"/>'
    + '<path d="M12 16.5C8.2 16.6 4.4 14 2.8 9.2c4.9.1 8.7 2.7 9.2 7.3Z" fill="currentColor" stroke="none" opacity=".7"/>'
    + '<path d="M14.6 11.2c0-3.9 2.3-7.3 6.7-9 .5 4.6-2 8.1-6.7 9Z" fill="currentColor" stroke="none"/>'
    + '<path d="M12.6 20.2c2.6-3.7 6.1-5.3 9.6-4.8-1.4 3.6-4.9 5.5-9.6 4.8Z" fill="currentColor" stroke="none" opacity=".85"/>',
};

export const NOMES_DE_ICONES = Object.keys(CAMINHOS);

export function icone(nome, { tamanho = 24, classe = '' } = {}) {
  const caminho = CAMINHOS[nome];
  if (!caminho) throw new Error(`Ícone desconhecido: ${nome}`);
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="icone ${classe}" width="${Number(tamanho)}" height="${Number(tamanho)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${caminho}</svg>`;
  return tpl.content.firstElementChild;
}
