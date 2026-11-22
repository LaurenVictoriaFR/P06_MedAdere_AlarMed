// Node >=20, sem pacotes externos. Não imprime nem sobrescreve as chaves.
import { generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const arquivo = process.argv[2] ?? '.env';
const anterior = await readFile(arquivo, 'utf8').catch(e => { if (e.code === 'ENOENT') return ''; throw e; });
if (/^VAPID_(PUBLIC|PRIVATE)_KEY=.+/m.test(anterior)) {
  console.error('Este arquivo já contém chaves VAPID. Preserve-as para não invalidar inscrições existentes.');
  process.exit(1);
}
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const publica = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
const texto = anterior.replace(/^VAPID_(PUBLIC|PRIVATE)_KEY=.*\n?/gm, '');
await writeFile(arquivo, `${texto}\nVAPID_PUBLIC_KEY=${publica}\nVAPID_PRIVATE_KEY=${priv.d}\n`, { mode: 0o600 });
console.log(`Chaves criadas em ${arquivo}. Não envie esse arquivo ao GitHub.`);
