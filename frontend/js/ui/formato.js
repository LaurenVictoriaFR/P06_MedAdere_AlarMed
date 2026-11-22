// Datas, horas e plurais em português do Brasil.

const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });

function maiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "Sábado, 17 de outubro"
export function diaPorExtenso(instante) {
  return maiuscula(fmtDiaLongo.format(instante));
}

// "Outubro de 2026" (mes: 'AAAA-MM')
export function mesPorExtenso(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return maiuscula(fmtMes.format(new Date(ano, m - 1, 1)));
}

// "17 de outubro" (data: 'AAAA-MM-DD')
export function diaMesPorExtenso(data) {
  const [ano, m, d] = data.split('-').map(Number);
  return fmtDiaMes.format(new Date(ano, m - 1, d));
}

export function plural(n, singular, pluralTexto) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

// "faltam 1 h 55 min" / "falta 1 min"
export function tempoRestante(ms) {
  const total = Math.max(1, Math.ceil(ms / 60000));
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  const partes = [];
  if (horas) partes.push(`${horas} h`);
  if (minutos) partes.push(`${minutos} min`);
  return `${total === 1 ? 'falta' : 'faltam'} ${partes.join(' ')}`;
}
