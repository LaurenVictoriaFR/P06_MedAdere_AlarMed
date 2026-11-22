// Lembretes no horário da dose (RF003, UC-07).
//
// Limitação desta versão (só frontend): o aviso é disparado pelo próprio app,
// então só aparece com o AlarMed aberto ou em segundo plano. Aviso com o app
// fechado depende de Web Push vindo do backend (Fase 6 do plano).
// No iPhone, notificações só existem com o app instalado na Tela de Início (iOS 16.4+).

import * as D from './dominio/doses.js';
import { dosesComEstado } from './dominio/adesao.js';
import { dataISO, somarDias } from './dominio/tempo.js';
import { tituloItem, linhaDose } from './dominio/plano.js';
import { relogio } from './relogio.js';

const CHAVE_AVISADAS = 'alarmed:avisadas';

export function ehIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function estaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// 'concedida' | 'negada' | 'pendente' | 'ios-instalar' | 'indisponivel'
export function situacao() {
  if (ehIos() && !estaInstalado()) return 'ios-instalar';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'indisponivel';
  if (Notification.permission === 'granted') return 'concedida';
  if (Notification.permission === 'denied') return 'negada';
  return 'pendente';
}

// Precisa ser chamada a partir de um toque do usuário (exigência do Safari).
export async function pedirPermissao() {
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch (e) {
    console.warn('Service worker não registrado:', e);
  }
}

function lerAvisadas() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_AVISADAS) ?? '[]');
  } catch {
    return [];
  }
}

function marcarAvisada(id) {
  const lista = lerAvisadas().filter((x) => x !== id);
  lista.push(id);
  try {
    localStorage.setItem(CHAVE_AVISADAS, JSON.stringify(lista.slice(-200)));
  } catch {
    // sem armazenamento: pode repetir o aviso, sem prejuízo
  }
}

export function textosDoLembrete(dose) {
  return {
    titulo: `Hora de tomar ${tituloItem(dose.item)}`,
    corpo: `${linhaDose(dose.item)}. Toque para registrar.`,
  };
}

export async function mostrarLembrete(dose) {
  const registro = await navigator.serviceWorker.ready;
  const { titulo, corpo } = textosDoLembrete(dose);
  await registro.showNotification(titulo, {
    body: corpo,
    tag: dose.id,
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/favicon-64.png',
    requireInteraction: true,
    data: { hash: `#/hoje?dose=${encodeURIComponent(dose.id)}` },
  });
}

// Chamada a cada 30 s e quando o app volta a ficar visível.
// Avisa uma vez cada dose pendente (de hoje ou da noite anterior) ainda sem registro.
export async function verificarLembretes(api) {
  if (situacao() !== 'concedida') return;
  try {
    const usuario = await api.sessao();
    if (!usuario) return;
    const [plano, registros] = await Promise.all([api.obterPlano(), api.listarRegistros()]);
    const agora = relogio.agora();
    const itens = D.todosOsItens(plano);
    const hoje = dataISO(agora);
    const avisadas = new Set(lerAvisadas());
    const candidatas = [somarDias(hoje, -1), hoje]
      .flatMap((data) => dosesComEstado(itens, registros, data, agora))
      .filter((d) => d.estado === D.ESTADOS.PENDENTE && !avisadas.has(d.id));
    for (const dose of candidatas) {
      await mostrarLembrete(dose);
      marcarAvisada(dose.id);
    }
  } catch (e) {
    console.warn('Falha ao verificar lembretes:', e);
  }
}
