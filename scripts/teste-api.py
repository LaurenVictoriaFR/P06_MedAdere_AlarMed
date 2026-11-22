#!/usr/bin/env python3
"""Ensaio HTTP com dados sintéticos, sem pacotes externos. Servidor já iniciado."""
import argparse
import datetime as dt
import http.cookiejar
import json
import urllib.error
import urllib.request
import uuid
from zoneinfo import ZoneInfo

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:8080')
parser.add_argument('--estado-saida', help='Arquivo opcional com identidade sintética para conferir após reinício')
args = parser.parse_args()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def chamada(metodo, caminho, corpo=None, esperado=200):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(args.url + caminho, data=dados, method=metodo,
                                 headers={'Content-Type': 'application/json'})
    try:
        r = opener.open(req, timeout=20)
        status, texto = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, texto = e.code, e.read()
    assert status == esperado, f'{metodo} {caminho}: esperado {esperado}, recebido {status}: {texto.decode()}'
    return json.loads(texto) if texto else None

chamada('GET', '/sessao', esperado=401)
email = f'teste-{uuid.uuid4()}@exemplo.test'
conta = chamada('POST', '/contas', {'nome': 'Pessoa fictícia', 'email': email, 'senha': 'remedio2026',
                  'confirmacaoSenha': 'remedio2026', 'dataNascimento': '1990-01-01', 'aceiteTermos': True}, 201)
sessao = chamada('GET', '/sessao')
assert sessao['conta']['id'] == conta['id']
agora = dt.datetime.fromisoformat(sessao['agora'].replace('Z', '+00:00')).astimezone(ZoneInfo(sessao['fuso']))
plano = chamada('POST', '/planos')
horario = (agora + dt.timedelta(minutes=2)).strftime('%H:%M')
plano = chamada('POST', f'/planos/{plano["id"]}/itens', {'nomeMedicamento': 'Medicamento fictício',
                  'dosagem': '50 mg · 1 comprimido', 'viaAdministracao': 'oral', 'frequencia': '1 vez ao dia',
                  'duracaoTratamento': '7 dias', 'horarios': [horario]})
chamada('POST', f'/planos/{plano["id"]}/confirmar', esperado=409)
chamada('POST', f'/planos/{plano["id"]}/revisar')
plano = chamada('POST', f'/planos/{plano["id"]}/confirmar')
assert plano['confirmadoEm'] and plano['fusoHorario']
de = agora.date().isoformat()
ate = (agora.date() + dt.timedelta(days=1)).isoformat()
doses = chamada('GET', f'/doses?de={de}&ate={ate}')
assert doses, 'Doses não foram geradas na confirmação'
dose = doses[0]
from urllib.parse import quote
chamada('PUT', '/registros/' + quote(dose['id'], safe=''), {'status': 'tomada'}, 409)
chamada('PUT', '/registros/' + quote(dose['id'], safe=''), {'status': 'invalido'}, 400)
chamada('POST', '/logout', esperado=204)
chamada('GET', '/sessao', esperado=401)
chamada('POST', '/login', {'email': email, 'senha': 'remedio2026'})
assert chamada('GET', '/planos/atual')['id'] == plano['id']
if args.estado_saida:
    from pathlib import Path
    Path(args.estado_saida).write_text(json.dumps({'email': email, 'planoId': plano['id'], 'doseId': dose['id']}))
print('OK: cadastro, sessão, revisão obrigatória, confirmação, doses, recusas, logout e persistência após novo login.')
print(f'Plano sintético criado. Próxima dose: {horario} no fuso {sessao["fuso"]}.')
