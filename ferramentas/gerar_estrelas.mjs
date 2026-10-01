/**
 * Gera o catalogo de estrelas a partir do Yale Bright Star Catalogue.
 *
 *     node ferramentas/gerar_estrelas.mjs
 *
 * Roda UMA vez; o `.bin` resultante e versionado e vai na pasta de entrega.
 * O programa nunca acessa a rede.
 *
 * **Fonte.** Yale Bright Star Catalogue, 5a edicao revisada (Hoffleit & Warren,
 * 1991), pela transcricao em JSON de brettonw/YaleBrightStarCatalog. Sao as
 * ~9.100 estrelas ate magnitude 6,5 — o limite do olho nu num ceu escuro. Nao
 * ha razao para carregar mais: o que passa disso nao e uma estrela que alguem
 * reconheceria, e um ponto a mais para o bloom acender.
 *
 * **Formato: 12 bytes por estrela.** `ra` e `dec` em float32 (radianos),
 * `magV` em int16 (centesimos), temperatura em uint16 (dezenas de kelvin).
 * Guardar a temperatura em vez do indice B−V poupa a conversao em tempo de
 * execucao, e ela ja vem medida na fonte.
 *
 * O catalogo esta no frame EQUATORIAL; quem gira para a ecliptica e a cena,
 * com a mesma `eps` que inclina os eixos dos planetas.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = 'https://raw.githubusercontent.com/brettonw/YaleBrightStarCatalog/master/bsc5-short.json';
const MAGNITUDE_LIMITE = 6.5;

/** "00h 05m 09.9s" -> radianos. */
function ascensaoReta(texto) {
  const m = /(\d+)h\s*(\d+)m\s*([\d.]+)s/.exec(texto);
  if (!m) return null;
  const horas = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return (horas / 24) * 2 * Math.PI;
}

/** "+45° 13′ 45″" -> radianos. O sinal vale para os tres campos. */
function declinacao(texto) {
  const m = /([+-]?)(\d+)°\s*(\d+)′\s*([\d.]+)″/.exec(texto);
  if (!m) return null;
  const sinal = m[1] === '-' ? -1 : 1;
  const graus = Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  return sinal * graus * (Math.PI / 180);
}

const resp = await fetch(FONTE);
if (!resp.ok) throw new Error(`nao consegui baixar o catalogo: ${resp.status}`);
const bruto = await resp.json();

const estrelas = [];
let semCoordenada = 0;
let semTemperatura = 0;

for (const e of bruto) {
  const ra = e.RA ? ascensaoReta(e.RA) : null;
  const dec = e.Dec ? declinacao(e.Dec) : null;
  const mag = e.V !== undefined ? Number(e.V) : NaN;
  if (ra === null || dec === null || !Number.isFinite(mag)) {
    semCoordenada++;
    continue;
  }
  if (mag > MAGNITUDE_LIMITE) continue;

  // Sem temperatura medida, 5.800 K — o Sol. E uma escolha declarada, e ela
  // some no meio: sao poucas estrelas e nenhuma delas e brilhante.
  let temp = Number(e.K);
  if (!Number.isFinite(temp) || temp <= 0) {
    temp = 5800;
    semTemperatura++;
  }
  estrelas.push({ ra, dec, mag, temp: Math.min(60000, Math.max(1500, temp)) });
}

// Da mais brilhante para a mais fraca: se um dia houver corte por desempenho,
// ele cai nas que ninguem veria.
estrelas.sort((a, b) => a.mag - b.mag);

const buffer = new ArrayBuffer(estrelas.length * 12);
const visao = new DataView(buffer);
estrelas.forEach((e, i) => {
  const o = i * 12;
  visao.setFloat32(o, e.ra, true);
  visao.setFloat32(o + 4, e.dec, true);
  visao.setInt16(o + 8, Math.round(e.mag * 100), true);
  visao.setUint16(o + 10, Math.round(e.temp / 10), true);
});

await mkdir(join(RAIZ, 'publico', 'ceu'), { recursive: true });
await writeFile(join(RAIZ, 'publico', 'ceu', 'bsc5.bin'), Buffer.from(buffer));

const proc = {
  _leia_isto: 'Gerado por ferramentas/gerar_estrelas.mjs. Nao edite a mao.',
  fonte: 'Yale Bright Star Catalogue, 5a edicao revisada (Hoffleit & Warren, 1991)',
  transcricao: 'https://github.com/brettonw/YaleBrightStarCatalog',
  arquivo: 'ceu/bsc5.bin',
  formato:
    '12 bytes por estrela: ra float32 (rad), dec float32 (rad), magV int16 (centesimos), T uint16 (dezenas de K)',
  referencial: 'equatorial ICRS; a cena gira para a ecliptica por eps = 23,4392911 graus',
  magnitude_limite: MAGNITUDE_LIMITE,
  estrelas: estrelas.length,
  sem_temperatura_medida: semTemperatura,
  gerado_em: new Date().toISOString().slice(0, 10),
};
await writeFile(join(RAIZ, 'src', 'dados', 'ceu.json'), JSON.stringify(proc, null, 2) + '\n');

console.log(`${estrelas.length} estrelas ate magnitude ${MAGNITUDE_LIMITE}`);
console.log(`  ${(buffer.byteLength / 1024).toFixed(0)} KB em publico/ceu/bsc5.bin`);
console.log(`  ${semTemperatura} sem temperatura medida (assumidas 5.800 K)`);
console.log(`  ${semCoordenada} descartadas por falta de coordenada ou magnitude`);
console.log(`  mais brilhante: magnitude ${estrelas[0].mag}`);
