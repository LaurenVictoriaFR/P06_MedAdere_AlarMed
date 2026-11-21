// Rotas por hash: #/hoje, #/painel?mes=2026-10, #/hoje?dose=<id>.
// O hash não vai ao servidor, então o app funciona em qualquer hospedagem estática.

export function rotaAtual() {
  const bruto = window.location.hash.replace(/^#/, '') || '/';
  const [caminho, consulta = ''] = bruto.split('?');
  return {
    nome: caminho.replace(/^\/+/, '').split('/')[0],
    consulta: new URLSearchParams(consulta),
  };
}

export function navegar(caminho) {
  const destino = `#${caminho}`;
  if (window.location.hash === destino) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = caminho;
}

// Troca a rota sem criar entrada no histórico (usado pelas guardas de acesso).
export function substituir(caminho) {
  const url = `${window.location.pathname}${window.location.search}#${caminho}`;
  window.history.replaceState(null, '', url);
}
