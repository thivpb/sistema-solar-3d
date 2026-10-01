/**
 * O que `gerar_luas.mjs` e `conferir_luas.mjs` compartilham.
 *
 * Existe para que a propagacao usada na MEDICAO e a usada na CONFERENCIA sejam
 * literalmente a mesma funcao. Duas copias derivariam, e a conferencia passaria
 * a medir a diferenca entre as copias em vez do erro do modelo.
 *
 * ## As duas janelas, e por que elas nao se tocam
 *
 *     medicao     2000-01-01 .. 2016-12-31   taxa sideral, plano, anomalia inicial
 *     conferencia 2020-01-01 .. 2040-01-01   o erro que vai publicado
 *
 * Tres anos de folga entre elas, e nenhum numero do modelo sai da segunda.
 * Sem essa separacao, "o erro nao cresce" seria propriedade do ajuste e nao do
 * modelo: qualquer ajuste linear forca residuo sem componente linear DENTRO da
 * janela ajustada, e medir ali e medir o proprio ajuste.
 */
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const EPS = (23.4392911 * Math.PI) / 180;
export const GRAU = Math.PI / 180;

export const JANELA_DE_MEDICAO = { de: '2000-01-01 12:00', ate: '2016-12-31 12:00' };
export const JANELA_DE_CONFERENCIA = { de: '2020-01-01 12:00', ate: '2040-01-01 12:00' };

/** Polo da IAU WGCCRE 2015 para Urano, em ICRF. Archinal e outros, 2018. */
export const POLO_DE_URANO = { ra: 257.311, dec: -15.175 };

export const IDS = {
  lua: [301, '500@399'], fobos: [401, '500@499'], deimos: [402, '500@499'],
  io: [501, '500@599'], europa: [502, '500@599'], ganimedes: [503, '500@599'],
  calisto: [504, '500@599'], encelado: [602, '500@699'], tita: [606, '500@699'],
  titania: [703, '500@799'], oberon: [704, '500@799'], miranda: [705, '500@799'],
  tritao: [801, '500@899'],
};

export async function vetores(id, centro, inicio, fim, passo) {
  const u = new URL(HORIZONS);
  for (const [k, v] of Object.entries({
    format: 'text', COMMAND: `'${id}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS', CENTER: `'${centro}'`, START_TIME: `'${inicio}'`,
    STOP_TIME: `'${fim}'`, STEP_SIZE: `'${passo}'`, REF_PLANE: 'ECLIPTIC', VEC_CORR: 'NONE',
  })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Horizons devolveu ${r.status}`);
  const t = await r.text();
  const corpo = t.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!corpo) throw new Error(`Horizons nao devolveu vetores para ${id}:\n${t.slice(0, 400)}`);
  const pontos = [];
  for (const m of corpo.matchAll(
    /(\d+\.\d+) = A\.D\.[\s\S]*?X =\s*([-\dEe.+]+)\s+Y =\s*([-\dEe.+]+)\s+Z =\s*([-\dEe.+]+)/g,
  )) pontos.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
  return pontos;
}

const versor = (raGraus, decGraus) => {
  const ra = raGraus * GRAU;
  const dec = decGraus * GRAU;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
};
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalizar = (v) => { const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n]; };

/**
 * A base do plano de referencia, em coordenadas ICRF equatoriais.
 *
 * `z` e o polo. `x` e o NO ASCENDENTE DO PLANO SOBRE O EQUADOR DA ICRF — e nao
 * o equinocio —, porque e dali que a propria tabela mede a longitude do no:
 * "longitude of the ascending node measured from the node of the reference
 * plane on the ICRF equator". Usar o equinocio gira a orbita em torno do polo
 * por um angulo que ninguem repara e que envenena tudo depois.
 */
export function baseDoPlano(polo) {
  const z = versor(polo.ra, polo.dec);
  const x = normalizar(cruz([0, 0, 1], z));
  return { x, y: cruz(z, x), z };
}

/**
 * Do plano de referencia para a ecliptica J2000. Sao duas operacoes, em ordem:
 * combinar com a base (matriz cujas COLUNAS sao x, y, z), e girar por -eps.
 *
 * A armadilha: "projetar na base" significa, em uso corrente, o produto escalar
 * com cada vetor — que e a operacao INVERSA desta. Escrever a transposta poe a
 * lua num plano errado, e para Jupiter, cujo polo esta a 2 graus da ecliptica,
 * o erro e pequeno o bastante para nao gritar na tela e grande o bastante para
 * envenenar tudo o que vier depois.
 */
export function paraEcliptica(base, v) {
  const eq = [
    base.x[0] * v[0] + base.y[0] * v[1] + base.z[0] * v[2],
    base.x[1] * v[0] + base.y[1] * v[1] + base.z[1] * v[2],
    base.x[2] * v[0] + base.y[2] * v[1] + base.z[2] * v[2],
  ];
  return [
    eq[0],
    eq[1] * Math.cos(EPS) + eq[2] * Math.sin(EPS),
    -eq[1] * Math.sin(EPS) + eq[2] * Math.cos(EPS),
  ];
}

export function resolverKepler(M, e) {
  const x = M - 2 * Math.PI * Math.floor(M / (2 * Math.PI));
  let E = x + 0.85 * e * Math.sign(Math.sin(x) || 1);
  for (let k = 0; k < 60; k++) {
    const df = 1 - e * Math.cos(E);
    const passo = (E - e * Math.sin(E) - x) / df;
    E -= passo;
    if (Math.abs(passo) < 1e-14) break;
  }
  return E;
}

/** Posicao da lua em km, na ecliptica J2000, centrada no planeta. */
export function posicao(l, base, dias, m0Graus) {
  const M = (m0Graus + l.taxaDaAnomaliaMediaGrausDia * dias) * GRAU;
  const no = (l.noGraus + l.taxaDoNoGrausDia * dias) * GRAU;
  const w = (l.periastroGraus + l.taxaDoPeriastroGrausDia * dias) * GRAU;
  const i = l.inclinacaoGraus * GRAU;
  const e = l.excentricidade;
  const E = resolverKepler(M, e);
  const xP = l.aKm * (Math.cos(E) - e);
  const yP = l.aKm * Math.sqrt(1 - e * e) * Math.sin(E);
  const cO = Math.cos(no); const sO = Math.sin(no);
  const ci = Math.cos(i); const si = Math.sin(i);
  const cw = Math.cos(w); const sw = Math.sin(w);
  const p = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const noPlano = [p[0] * xP + q[0] * yP, p[1] * xP + q[1] * yP, p[2] * xP + q[2] * yP];
  return l.plano === 'ecliptic' ? noPlano : paraEcliptica(base, noPlano);
}

/** Erro maximo e rms em km, contra uma serie de vetores do Horizons. */
export function medirErro(l, base, m0, pontos, jd0) {
  let maximo = 0;
  let soma = 0;
  for (const [jd, x, y, z] of pontos) {
    const p = posicao(l, base, jd - jd0, m0);
    const d = Math.hypot(p[0] - x, p[1] - y, p[2] - z);
    if (d > maximo) maximo = d;
    soma += d * d;
  }
  return { maximo, rms: Math.sqrt(soma / pontos.length) };
}

/** O M0 que melhor reproduz a serie. Varredura de 1 grau, depois refino. */
export function melhorM0(l, base, pontos, jd0) {
  let melhor = { g: 0, rms: Infinity };
  for (let g = 0; g < 360; g += 1) {
    const r = medirErro(l, base, g, pontos, jd0);
    if (r.rms < melhor.rms) melhor = { g, rms: r.rms };
  }
  for (let passo = 0.1; passo >= 0.001; passo /= 10) {
    for (let g = melhor.g - 10 * passo; g <= melhor.g + 10 * passo; g += passo) {
      const r = medirErro(l, base, g, pontos, jd0);
      if (r.rms < melhor.rms) melhor = { g, rms: r.rms };
    }
  }
  return melhor;
}
