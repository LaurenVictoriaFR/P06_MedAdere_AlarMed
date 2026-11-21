// Razão de contraste WCAG 2.x entre duas cores '#RRGGBB'.
// Usada pelo teste de contraste e pelo guia de estilo (#/estilo).

function canal(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminancia(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function razaoContraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Pares [texto, fundo, mínimo] que o app usa. Nomes são os tokens de css/tokens.css.
export const PARES_DE_COR = [
  ['--texto', '--fundo', 4.5],
  ['--texto', '--superficie', 4.5],
  ['--texto-forte', '--fundo', 4.5],
  ['--texto-suave', '--fundo', 4.5],
  ['--texto-suave', '--superficie', 4.5],
  ['--texto-suave', '--neutro', 4.5],
  ['--verde-link', '--fundo', 4.5],
  ['--verde-link', '--superficie', 4.5],
  ['--verde-escuro', '--superficie', 4.5],
  ['--verde-escuro', '--verde-claro', 4.5],
  ['--erro', '--superficie', 4.5],
  ['--erro', '--fundo', 4.5],
  ['--tomada-texto', '--tomada-fundo', 4.5],
  ['--nao-texto', '--nao-fundo', 4.5],
  ['--pendente-texto', '--pendente-fundo', 4.5],
  ['--programada-texto', '--programada-fundo', 4.5],
  ['--info-texto', '--info-fundo', 4.5],
  ['--dia-todas-texto', '--dia-todas', 4.5],
  ['--dia-parte-texto', '--dia-parte', 4.5],
  ['--dia-nenhuma-texto', '--dia-nenhuma', 4.5],
  // Botão primário: texto branco sobre o verde
  ['--campo', '--verde', 4.5],
  ['--campo', '--verde-hover', 4.5],
  ['--campo', '--escuro', 4.5],
  // Componentes não textuais (WCAG 1.4.11): 3:1
  ['--borda-campo', '--campo', 3],
  ['--borda-campo', '--fundo', 3],
  ['--verde', '--fundo', 3],
  ['--foco', '--fundo', 3],
  ['--dia-parte-borda', '--superficie', 3],
];
