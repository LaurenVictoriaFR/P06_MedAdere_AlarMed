import { JSDOM, CookieJar } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/,'');
const posicao = process.argv.indexOf('--url');
const base = posicao >= 0 ? process.argv[posicao + 1] : 'http://localhost:8080';
const cookieJar = new CookieJar();
const dom = new JSDOM(await readFile(`${raiz}/frontend/index.html`, 'utf8'), { url: base, pretendToBeVisual: true, cookieJar });
const { window } = dom;
for (const nome of ['window','document','Node','HTMLElement','HashChangeEvent','Event','localStorage','location'])
  Object.defineProperty(globalThis, nome, { value: nome === 'window' ? window : window[nome], configurable: true });
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
globalThis.CSS = { escape: s => s.replace(/([^a-zA-Z0-9_-])/g,'\\$1') };
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.matchMedia = () => ({matches:false});
globalThis.requestAnimationFrame = fn => setTimeout(fn,0);
const fetchReal = globalThis.fetch;
globalThis.fetch = async (url, opcoes = {}) => {
  const alvo = new URL(url,base).href;
  const resposta = await fetchReal(alvo,{...opcoes,headers:{...opcoes.headers,Cookie:await cookieJar.getCookieString(alvo)}});
  for (const c of resposta.headers.getSetCookie()) await cookieJar.setCookie(c,alvo);
  return resposta;
};
const { renderizar } = await import(pathToFileURL(`${raiz}/frontend/js/app.js`));
async function esperar(fn,tempo=12000) {
  const inicio=Date.now();
  while (!fn()) {if(Date.now()-inicio>tempo)throw Error(`Tempo esgotado: ${document.body.textContent.slice(-2500)}`);await new Promise(r=>setTimeout(r,50));}
}
function preencher(id,valor) {
  const el=document.querySelector(id);assert.ok(el,`Campo ${id}`);el.value=valor;el.dispatchEvent(new Event('input',{bubbles:true}));
}
function botao(texto) { const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===texto);assert.ok(b,`Botão ${texto}`);b.click(); }
try {
  await renderizar();
  botao('Criar conta'); await esperar(()=>document.querySelector('#nome'));
  preencher('#nome','Pessoa Sintética DOM');preencher('#dataNascimento','1990-01-01');
  preencher('#email',`dom-${Date.now()}@exemplo.test`);preencher('#senha','remedio2026');preencher('#confirmacaoSenha','remedio2026');
  document.querySelector('#aceiteTermos').click();
  document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await esperar(()=>document.body.dataset.tela==='cadastro');
  console.log('OK: cadastro pela interface e abertura do formulário de plano');
  const sessao = await (await fetch('/sessao')).json();
  const t = new Date(sessao.agora);t.setUTCMinutes(t.getUTCMinutes()+1);t.setUTCSeconds(0,0);
  if (t-new Date(sessao.agora)<10000)t.setUTCMinutes(t.getUTCMinutes()+1);
  const horario = new Intl.DateTimeFormat('en-GB',{timeZone:sessao.fuso,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(t);
  preencher('#f-nome','Medicamento sintético DOM');preencher('#f-conc','50 mg');preencher('#f-hora',horario);
  botao('Incluir');await renderizar();
  botao('Adicionar à lista');await esperar(()=>document.querySelector('#titulo-lista')?.textContent.includes('(1)'));
  botao('Revisar plano (1)');await esperar(()=>document.body.dataset.tela==='revisao');
  document.querySelector('#f-conferi').click();await renderizar();botao('Confirmar e salvar');
  await esperar(()=>document.body.dataset.tela==='hoje');
  assert.ok(document.querySelector('.cartao-dose'));console.log('OK: item, revisão, confirmação e dose real na tela');
  const prazo = t.getTime()-Date.now()+3000;
  if(prazo>0)await new Promise(r=>setTimeout(r,prazo));
  await renderizar(); await esperar(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Tomei'));
  botao('Tomei');await esperar(()=>document.querySelector('.estado-tomada'));
  console.log('OK: registro de consumo pela interface persistido no servidor');
  botao('Corrigir registro');await esperar(()=>document.querySelector('.estado-pendente'));
  botao('Não tomei');await esperar(()=>document.querySelector('.estado-nao_tomada'));
  const registros = await (await fetch('/registros')).json();
  assert.ok(Object.values(registros).some(r=>r.status==='nao_tomada'));
  console.log('OK: correção e registro Não tomei persistidos');
  window.location.hash='#/painel';await esperar(()=>document.body.dataset.tela==='painel');
  assert.ok(!document.body.textContent.includes('Algo deu errado'));
  console.log('OK: painel existente abre com os registros reais');
  window.location.hash='#/plano';await esperar(()=>document.body.dataset.tela==='plano');botao('Sair');
  await esperar(()=>document.body.dataset.tela==='entrar');
  assert.equal((await fetch('/sessao')).status,401);
  console.log('OK: logout invalida a sessão real');
  process.exit(0);
} catch(e) {console.error(e);process.exit(1);}
