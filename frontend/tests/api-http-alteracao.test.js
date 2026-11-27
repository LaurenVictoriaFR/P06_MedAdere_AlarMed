// UC-04 (alterar plano confirmado) no adaptador da API real, contra um servidor falso que
// segue o contrato do Bloco C (docs/CONTRATO_BLOCO_C.md, PR #17).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { location: { search: '' } };
const api = await import('../js/api/api-http.js');
const P = await import('../js/dominio/plano.js');

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

// Servidor falso, só em memória. `comUc04: false` imita o servidor antigo, sem a alteração.
function servidorFalso({ comUc04 = true } = {}) {
  let contador = 0;
  const novoId = (prefixo) => `${prefixo}-${(contador += 1)}`;
  const planos = new Map();
  const chamadas = [];
  let doses = [];

  const item = (nome, horarios, extras = {}) => ({
    id: novoId('item'), nomeMedicamento: nome, dosagem: '50 mg · 1 comprimido', viaAdministracao: 'oral',
    frequencia: `${horarios.length} vezes ao dia`, duracaoTratamento: 'uso contínuo',
    horarios: horarios.map((h) => `${h}:00`), itemOrigemId: null, inicioTratamento: null, temFoto: false, ...extras,
  });

  // Plano já confirmado, com dois remédios.
  const v1 = {
    id: novoId('plano'), dataInicio: '2026-11-20', dataFim: null, confirmadoEm: '2026-11-20T10:00:00Z',
    fusoHorario: 'America/Maceio', situacao: 'CONFIRMADO', planoAnteriorId: null,
    itens: [
      item('Losartana', ['08:00', '20:00'], { inicioTratamento: '2026-11-20' }),
      item('Metformina', ['12:00'], { inicioTratamento: '2026-11-20' }),
    ],
  };
  planos.set(v1.id, v1);

  // O servidor antigo não manda os campos novos do contrato.
  const publico = (p) => {
    const copia = structuredClone(p);
    if (!comUc04) {
      delete copia.planoAnteriorId;
      for (const i of copia.itens) { delete i.itemOrigemId; delete i.inicioTratamento; delete i.temFoto; }
    }
    return copia;
  };
  const responder = (status, corpo) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });
  const naoAchou = () => responder(404, { mensagem: 'Não encontrado.', camposInvalidos: {} });
  const regra = (mensagem) => responder(409, { mensagem, camposInvalidos: {} });
  const porSituacao = (...situacoes) => [...planos.values()].find((p) => situacoes.includes(p.situacao));

  globalThis.fetch = async (url, opcoes = {}) => {
    const metodo = opcoes.method ?? 'GET';
    const { pathname } = new URL(url, 'http://teste');
    chamadas.push(`${metodo} ${pathname}`);
    const [raiz, id, acao, idItem] = pathname.split('/').filter(Boolean);
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;

    if (raiz === 'doses') return responder(200, doses);
    if (raiz === 'registros') return responder(200, {});
    if (raiz !== 'planos') return naoAchou();

    if (metodo === 'GET' && id === 'atual') {
      const p = porSituacao('CONFIRMADO');
      return p ? responder(200, publico(p)) : naoAchou();
    }
    if (metodo === 'GET' && id === 'rascunho') {
      const p = porSituacao('EM_EDICAO', 'EM_REVISAO');
      return p ? responder(200, publico(p)) : naoAchou();
    }
    if (metodo === 'POST' && !id) {
      const p = { id: novoId('plano'), dataInicio: '2026-11-25', dataFim: null, confirmadoEm: null,
        fusoHorario: 'America/Maceio', situacao: 'EM_EDICAO', planoAnteriorId: null, itens: [] };
      planos.set(p.id, p);
      return responder(200, publico(p));
    }

    const plano = planos.get(id);
    if (!plano) return naoAchou();

    if (metodo === 'GET' && !acao) return responder(200, publico(plano));
    if (metodo === 'DELETE' && !acao) { planos.delete(id); return responder(204); }

    if (metodo === 'POST' && acao === 'alteracao') {
      if (!comUc04) return naoAchou();
      if (plano.situacao !== 'CONFIRMADO') return regra('Só um plano confirmado pode ser alterado.');
      const aberta = [...planos.values()].find((p) => p.planoAnteriorId === id && p.situacao !== 'ENCERRADO');
      if (aberta) return responder(200, publico(aberta));
      const v2 = { ...structuredClone(plano), id: novoId('plano'), situacao: 'EM_EDICAO', confirmadoEm: null,
        planoAnteriorId: id,
        itens: plano.itens.map((i) => ({ ...structuredClone(i), id: novoId('copia'), itemOrigemId: i.id })) };
      planos.set(v2.id, v2);
      return responder(201, publico(v2));
    }
    if (metodo === 'POST' && acao === 'itens') {
      plano.itens.push(item(corpo.nomeMedicamento, corpo.horarios, {
        dosagem: corpo.dosagem, duracaoTratamento: corpo.duracaoTratamento,
      }));
      return responder(200, publico(plano));
    }
    if (metodo === 'DELETE' && acao === 'itens') {
      plano.itens = plano.itens.filter((i) => i.id !== idItem);
      return responder(200, publico(plano));
    }
    if (metodo === 'POST' && acao === 'revisar') {
      if (!plano.itens.length) return regra('O plano precisa de pelo menos um remédio.');
      plano.situacao = 'EM_REVISAO';
      return responder(200, publico(plano));
    }
    if (metodo === 'POST' && acao === 'editar') {
      plano.situacao = 'EM_EDICAO';
      return responder(200, publico(plano));
    }
    if (metodo === 'POST' && acao === 'confirmar') {
      // RN01: só confirma o que foi revisado.
      if (plano.situacao !== 'EM_REVISAO') return regra('O plano precisa ser revisado antes de confirmar.');
      plano.situacao = 'CONFIRMADO';
      plano.confirmadoEm = '2026-11-25T12:00:00Z';
      for (const i of plano.itens) i.inicioTratamento ??= '2026-11-25';
      const anterior = planos.get(plano.planoAnteriorId);
      if (anterior) { anterior.situacao = 'ENCERRADO'; anterior.dataFim = '2026-11-25'; }
      return responder(200, publico(plano));
    }
    return naoAchou();
  };

  return {
    v1,
    chamadas,
    planos,
    definirDoses(lista) { doses = lista; },
  };
}

test('UC-04: plano confirmado sem alteração não tem nada pendente e pode ser alterado', async () => {
  servidorFalso();
  const plano = await api.obterPlano();
  assert.equal(plano.confirmado.itens.length, 2);
  assert.equal(plano.rascunho, null);
  assert.equal(plano.somenteLeitura, false);
  assert.equal(P.temAlteracaoPendente(plano), false);
});

test('UC-04: remover um remédio abre a alteração no servidor e o confirmado continua valendo', async () => {
  const s = servidorFalso();
  const plano = await api.obterPlano();
  const metformina = plano.confirmado.itens[1];

  const { item } = await api.removerItem(metformina.id);
  assert.equal(item.nome, 'Metformina');
  // Abriu a alteração no plano confirmado e removeu a CÓPIA do item, não o original.
  const alteracao = s.chamadas.find((c) => c.endsWith('/alteracao'));
  assert.equal(alteracao, `POST /planos/${s.v1.id}/alteracao`);
  const remocao = s.chamadas.find((c) => c.startsWith('DELETE') && c.includes('/itens/'));
  assert.match(remocao, /\/itens\/copia-/);

  const depois = await api.obterPlano();
  assert.equal(P.temAlteracaoPendente(depois), true);
  assert.equal(depois.confirmado.itens.length, 2, 'o plano confirmado não muda até a revisão');
  assert.deepEqual(P.compararAlteracao(depois).removidos.map((i) => i.nome), ['Metformina']);
  // A cópia que ficou usa o id do original: não aparece como remédio novo.
  assert.deepEqual(P.compararAlteracao(depois).itens.map((x) => x.novo), [false]);
});

test('UC-04: desfazer a única remoção cancela a alteração e não deixa o remédio como novo', async () => {
  const s = servidorFalso();
  const plano = await api.obterPlano();
  const losartana = plano.confirmado.itens[0];

  await api.removerItem(losartana.id);
  await api.reinserirItem(losartana);

  assert.ok(s.chamadas.some((c) => /^DELETE \/planos\/plano-\d+$/.test(c)), 'cancelou a alteração');
  const depois = await api.obterPlano();
  assert.equal(depois.rascunho, null);
  assert.equal(P.temAlteracaoPendente(depois), false);
});

test('UC-04: confirmar a alteração exige revisão e guarda a versão anterior para o histórico', async () => {
  const s = servidorFalso();
  await api.obterPlano();
  await api.adicionarItem({
    ...P.formularioVazio(), nome: 'Sinvastatina', concentracao: '20 mg', horarios: ['22:00'],
  });

  // Sem passar pela revisão, o servidor recusa (RN01).
  await assert.rejects(api.confirmarPlano(), (e) => e.status === 409);

  await api.revisarPlano();
  const confirmado = await api.confirmarPlano();
  assert.deepEqual(confirmado.confirmado.itens.map((i) => i.nome), ['Losartana', 'Metformina', 'Sinvastatina']);
  assert.equal(confirmado.rascunho, null);

  // Os itens da versão anterior ficam em encerrados, até a confirmação da nova.
  const losartanaV1 = s.v1.itens[0];
  const encerrado = confirmado.encerrados.find((i) => i.id === losartanaV1.id);
  assert.equal(encerrado.encerradoEm, '2026-11-25T12:00:00Z');
  // A cópia mantém o início do tratamento do original.
  assert.equal(confirmado.confirmado.itens[0].inicio, '2026-11-20');

  // Uma dose antiga, da versão anterior, ainda acha o remédio dela.
  s.definirDoses([{ id: `${losartanaV1.id}@2026-11-25T08:00`, itemId: losartanaV1.id, data: '2026-11-25',
    hora: '08:00:00', t: '2026-11-25T11:00:00Z', fimJanela: '2026-11-25T13:01:00Z', estado: 'pendente',
    automatica: false, registro: null }]);
  const [dose] = await api.listarDoses('2026-11-25', '2026-11-25');
  assert.equal(dose.item.nome, 'Losartana');
});

test('servidor sem o UC-04: o plano confirmado fica só para leitura e não abre alteração', async () => {
  const s = servidorFalso({ comUc04: false });
  const plano = await api.obterPlano();
  assert.equal(plano.somenteLeitura, true);
  await assert.rejects(api.removerItem(plano.confirmado.itens[0].id), (e) => e.status === 409);
  assert.ok(!s.chamadas.some((c) => c.endsWith('/alteracao')));
});

test('primeiro cadastro continua igual: sem plano confirmado, cria o rascunho e adiciona nele', async () => {
  const s = servidorFalso();
  s.planos.delete(s.v1.id);
  const plano = await api.obterPlano();
  assert.equal(plano.confirmado, null);
  assert.deepEqual(plano.rascunho, []);
  const item = await api.adicionarItem({ ...P.formularioVazio(), nome: 'Losartana', concentracao: '50 mg', horarios: ['08:00'] });
  assert.equal(item.nome, 'Losartana');
  assert.ok(s.chamadas.includes('POST /planos'));
  assert.ok(!s.chamadas.some((c) => c.endsWith('/alteracao')));
});
