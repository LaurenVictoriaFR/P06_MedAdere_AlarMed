// Fábricas para os testes. Datas no fuso local, como no app.
import { normalizarItem, formularioVazio, confirmarPlano, planoVazio, comItemAdicionado } from '../js/dominio/plano.js';

export function em(data, hora = '00:00') {
  const [a, m, d] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm, 0, 0);
}

export function item(campos = {}, id = 'i1') {
  return normalizarItem({ ...formularioVazio(), nome: 'Losartana', concentracao: '50 mg', horarios: ['08:00'], ...campos }, id);
}

// Plano confirmado em `quando` com os itens dados.
export function planoConfirmado(itens, quando) {
  let plano = planoVazio();
  for (const i of itens) plano = comItemAdicionado(plano, i);
  return confirmarPlano(plano, quando);
}
