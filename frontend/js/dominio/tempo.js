// Datas e horas no fuso do aparelho.
// Convenção: datas como 'AAAA-MM-DD', horas como 'HH:MM' e instantes como Date.
// Strings nesse formato podem ser comparadas com < e > diretamente.

export const MINUTO_MS = 60 * 1000;

export function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

export function dataISO(instante) {
  return `${instante.getFullYear()}-${doisDigitos(instante.getMonth() + 1)}-${doisDigitos(instante.getDate())}`;
}

export function horaHM(instante) {
  return `${doisDigitos(instante.getHours())}:${doisDigitos(instante.getMinutes())}`;
}

export function mesISO(instante) {
  return dataISO(instante).slice(0, 7);
}

// Monta o instante local a partir de 'AAAA-MM-DD' e 'HH:MM'.
export function deDataHora(data, hora = '00:00') {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(ano, mes - 1, dia, hh, mm, 0, 0);
}

export function somarDias(data, n) {
  const d = deDataHora(data);
  d.setDate(d.getDate() + n);
  return dataISO(d);
}

export function somarMinutos(instante, n) {
  return new Date(instante.getTime() + n * MINUTO_MS);
}

// mes de 1 a 12
export function diasNoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

export function somarMeses(mesTexto, n) {
  const [ano, mes] = mesTexto.split('-').map(Number);
  const d = new Date(ano, mes - 1 + n, 1);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
}

export function horaValida(hora) {
  return typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

export function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return dataISO(deDataHora(data)) === data; // rejeita 2026-02-30
}

export function mesValido(mes) {
  return typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function dataBR(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
