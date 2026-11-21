// Foto da caixa (RF008): reduz a imagem antes de guardar, para caber no
// armazenamento do navegador (mock) e não pesar no envio ao backend.

export async function reduzirFoto(arquivo, { lado = 640, qualidade = 0.72 } = {}) {
  if (!arquivo || !arquivo.type || !arquivo.type.startsWith('image/')) throw new Error('nao_e_imagem');
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('imagem_ilegivel'));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const largura = Math.max(1, Math.round(img.naturalWidth * escala));
    const altura = Math.max(1, Math.round(img.naturalHeight * escala));
    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = altura;
    tela.getContext('2d').drawImage(img, 0, 0, largura, altura);
    return tela.toDataURL('image/jpeg', qualidade);
  } finally {
    URL.revokeObjectURL(url);
  }
}
