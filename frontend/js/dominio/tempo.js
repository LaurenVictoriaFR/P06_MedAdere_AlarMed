// Datas e horas no fuso do aparelho.
// Convenção: datas como 'AAAA-MM-DD', horas como 'HH:MM' e instantes como Date.
// Strings nesse formato podem ser comparadas com < e > diretamente.

export const MINUTO_MS = 60 * 1000;
let fusoServidor = null;
export function configurarFuso(fuso) { fusoServidor = fuso; }
function partes(instante) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: fusoServidor,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23' }).formatToParts(instante).map(p => [p.type, p.value]));
}

export function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

export function dataISO(instante) {
  if (fusoServidor) { const p = partes(instante); return `${p.year}-${p.month}-${p.day}`; }
  return `${instante.getFullYear()}-${doisDigitos(instante.getMonth() + 1)}-${doisDigitos(instante.getDate())}`;
}

export function horaHM(instante) {
  if (fusoServidor) { const p = partes(instante); return `${p.hour}:${p.minute}`; }
  return `${doisDigitos(instante.getHours())}:${doisDigitos(instante.getMinutes())}`;
}

export function mesISO(instante) {
  return dataISO(instante).slice(0, 7);
}

// Monta o instante local a partir de 'AAAA-MM-DD' e 'HH:MM'.
export function deDataHora(data, hora = '00:00') {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  if (!fusoServidor) return new Date(ano, mes - 1, dia, hh, mm, 0, 0);
  const desejado = Date.UTC(ano, mes - 1, dia, hh, mm);
  let instante = desejado;
  for (let i = 0; i < 3; i++) {
    const p = partes(new Date(instante));
    const visto = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    instante += desejado - visto;
  }
  return new Date(instante);
}

export function somarDias(data, n) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
