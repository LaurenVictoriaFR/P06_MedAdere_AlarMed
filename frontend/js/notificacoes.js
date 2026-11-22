// Lembretes no horário da dose (RF003, UC-07).
//
// No modo real, o servidor envia Web Push. A verificação local é exclusiva do mock.
// No iPhone, notificações só existem com o app instalado na Tela de Início (iOS 16.4+).

import * as D from './dominio/doses.js';
import { dosesComEstado } from './dominio/adesao.js';
import { dataISO, somarDias } from './dominio/tempo.js';
import { tituloItem, linhaDose } from './dominio/plano.js';
import { relogio } from './relogio.js';

const CHAVE_AVISADAS = 'alarmed:avisadas';
let estadoPush = null;
let usuarioPush = null;
let sincronizando = null;
let problemasRecentes = 0;
export function houveFalhaRecente() { return problemasRecentes > 0; }

export async function preparar(api, usuario) {
  if (!api.modoReal) return;
  if (!usuario) { usuarioPush = null; estadoPush = null; problemasRecentes = 0; return; }
  if (usuarioPush === usuario.id && estadoPush !== null) return;
  usuarioPush = usuario.id;
  await sincronizarPush(api);
}

function chaveBytes(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)), c => c.charCodeAt(0));
}

async function sincronizarPush(api, criar = false) {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    try {
      const config = await api.chavePush();
      if (!config.configurado) { estadoPush = 'servidor-desativado'; return; }
      if (situacaoDoNavegador() !== 'concedida') { estadoPush = 'pendente'; return; }
      const registro = await navigator.serviceWorker.ready;
      let inscricao = await registro.pushManager.getSubscription();
      const chave = chaveBytes(config.chavePublica);
      if (inscricao?.options.applicationServerKey
          && String(new Uint8Array(inscricao.options.applicationServerKey)) !== String(chave)) {
        await inscricao.unsubscribe(); inscricao = null;
      }
      if (!inscricao && criar) inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
      if (!inscricao) { estadoPush = 'pendente'; return; }
      try { await api.inscreverPush(inscricao.toJSON()); }
      catch (e) {
        if (!criar || e.status !== 409) throw e;
        await inscricao.unsubscribe();
        inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
        await api.inscreverPush(inscricao.toJSON());
      }
      const situacaoServidor = await api.situacaoPush();
      problemasRecentes = situacaoServidor.falhasRecentes ?? 0;
      estadoPush = 'concedida';
    } catch { estadoPush = 'falha'; }
  })().finally(() => { sincronizando = null; });
  return sincronizando;
}

export async function ativar(api) {
  if (!api.modoReal) return pedirPermissao();
  const resposta = await pedirPermissao();
  if (resposta === 'granted') await sincronizarPush(api, true);
  return estadoPush === 'concedida' ? 'granted' : 'denied';
}

export function ehIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function estaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// 'concedida' | 'negada' | 'pendente' | 'ios-instalar' | 'indisponivel'
function situacaoDoNavegador() {
  if (ehIos() && !estaInstalado()) return 'ios-instalar';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'indisponivel';
  if (Notification.permission === 'granted') return 'concedida';
  if (Notification.permission === 'denied') return 'negada';
  return 'pendente';
}

export function situacao() {
  const navegador = situacaoDoNavegador();
  return navegador === 'concedida' ? (estadoPush ?? navegador) : navegador;
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
  if (api.modoReal) {
    if (usuarioPush) await sincronizarPush(api);
    return; // O agendamento real pertence ao servidor; não disparar avisos locais duplicados.
  }
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
