/**
 * O plano em que os elementos de cada lua estao escritos — e nunca o mesmo.
 *
 * A tabela do JPL usa tres planos diferentes, e diz qual em cada linha:
 *
 *     ecliptic     a ecliptica, centrada no planeta. So a Lua.
 *     Laplace      o plano em que a precessao do no da lua esta contida, na
 *                  media. Vem com o proprio polo na linha.
 *     equatorial   o equador do planeta. As luas de Urano, e a tabela deixa as
 *                  colunas de polo EM BRANCO.
 *
 * Misturar os planos e o erro que poe uma lua orbitando no lugar errado sem
 * que nada grite na tela: para Jupiter, cujo polo esta a 2 graus da ecliptica,
 * o resultado fica plausivel e errado.
 */
import type { BaseDoPlano } from '../contratos/lua.ts';

/** Obliquidade da ecliptica em J2000. A mesma que inclina os eixos dos planetas. */
export const OBLIQUIDADE_RAD = (23.4392911 * Math.PI) / 180;
const GRAU = Math.PI / 180;

const cruz = (a: readonly number[], b: readonly number[]): [number, number, number] => [
  a[1]! * b[2]! - a[2]! * b[1]!,
  a[2]! * b[0]! - a[0]! * b[2]!,
  a[0]! * b[1]! - a[1]! * b[0]!,
];

/** Do equador da ICRF para a ecliptica J2000. Giro de −eps em torno de x. */
function paraEclipticaDoEquador(v: readonly [number, number, number]): [number, number, number] {
  const c = Math.cos(OBLIQUIDADE_RAD);
  const s = Math.sin(OBLIQUIDADE_RAD);
  return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
}

/**
 * A base do plano de referencia, JA em coordenadas eclipticas.
 *
 * `z` e o polo. `x` e o **no ascendente do plano sobre o equador da ICRF** — e
 * nao o equinocio —, porque e dali que a propria tabela mede a longitude do no:
 * "longitude of the ascending node measured from the node of the reference
 * plane on the ICRF equator". Tomar o equinocio por engano gira a orbita
 * inteira em torno do polo por um angulo que nao se enxerga e que envenena
 * tudo o que vem depois.
 *
 * Os tres vetores saem construidos no frame equatorial e sao convertidos para
 * a ecliptica um a um, no fim: assim a conta da base e a mesma que a fonte
 * descreve, e a unica etapa nova fica isolada num lugar so.
 */
export function baseDoPlano(poloRaGraus: number, poloDecGraus: number): BaseDoPlano {
  const ra = poloRaGraus * GRAU;
  const dec = poloDecGraus * GRAU;
  const z: [number, number, number] = [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
  const bruto = cruz([0, 0, 1], z);
  const n = Math.hypot(...bruto);
  const x: [number, number, number] = [bruto[0] / n, bruto[1] / n, bruto[2] / n];
  const y = cruz(z, x);
  return {
    x: paraEclipticaDoEquador(x),
    y: paraEclipticaDoEquador(y),
    z: paraEclipticaDoEquador(z),
  };
}

/** A base da propria ecliptica: identidade. Para a Lua, cujos elementos ja estao nela. */
export const BASE_DA_ECLIPTICA: BaseDoPlano = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * Do plano de referencia para a ecliptica.
 *
 * E a combinacao linear `v.x·X + v.y·Y + v.z·Z`, ou seja a matriz cujas
 * COLUNAS sao os vetores da base.
 *
 * **A armadilha, escrita porque ela tem duas respostas opostas:** "projetar na
 * base" significa, em uso corrente, calcular o produto escalar com cada vetor
 * — que e a operacao INVERSA desta. Escrever a transposta poe a lua num plano
 * errado. Para Urano, cujo polo fica a quase 98 graus do polo da ecliptica, o
 * erro e imediato e obvio; para Jupiter e de poucos graus, pequeno o bastante
 * para passar e grande o bastante para estragar tudo depois.
 */
export function doPlanoParaEcliptica(
  b: BaseDoPlano,
  v: readonly [number, number, number],
): [number, number, number] {
  return [
    b.x[0] * v[0] + b.y[0] * v[1] + b.z[0] * v[2],
    b.x[1] * v[0] + b.y[1] * v[1] + b.z[1] * v[2],
    b.x[2] * v[0] + b.y[2] * v[1] + b.z[2] * v[2],
  ];
}

/** Da ecliptica de volta para o equatorial ICRF. Inversa de `paraEclipticaDoEquador`. */
function paraEquadorDaEcliptica(v: readonly [number, number, number]): [number, number, number] {
  const c = Math.cos(OBLIQUIDADE_RAD);
  const s = Math.sin(OBLIQUIDADE_RAD);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

/**
 * O eixo de rotacao de uma lua travada por mare, como `(ra, dec)` da IAU.
 *
 * **E a normal da ORBITA, e nao o polo do planeta.** A diferenca e a inclinacao
 * da orbita sobre o plano de referencia: 5,16° na nossa Lua, 4,4° em Miranda, e
 * **157,3° em Tritao**, onde a normal aponta quase ao contrario do polo de
 * Netuno. Usar o polo do planeta acerta onze casos por pouco e erra o decimo
 * segundo por inteiro — e "erra um caso por inteiro" e a assinatura de um fator
 * que passa despercebido enquanto so olhamos os outros, como o `cos i` da
 * identidade da anomalia media ja ensinou neste mesmo arquivo.
 *
 * Com o eixo definido assim, a rotacao e POSITIVA por construcao: a normal e
 * destra com o movimento. Tritao nao precisa de ramo com sinal — ele sai
 * apontando para o sul da ICRF, e girar no sentido positivo em torno de um eixo
 * que aponta para o sul E a rotacao retrograda que a IAU publica. Um ramo com
 * sinal seria a mesma fisica escrita duas vezes, e uma das duas ia divergir.
 */
export function eixoDeRotacaoSincrona(
  base: BaseDoPlano,
  noGraus: number,
  inclinacaoGraus: number,
): { ra: number; dec: number } {
  const no = noGraus * GRAU;
  const i = inclinacaoGraus * GRAU;
  // Normal da orbita no frame do PROPRIO plano de referencia.
  const noPlano: [number, number, number] = [
    Math.sin(no) * Math.sin(i),
    -Math.cos(no) * Math.sin(i),
    Math.cos(i),
  ];
  const eq = paraEquadorDaEcliptica(doPlanoParaEcliptica(base, noPlano));
  const n = Math.hypot(eq[0], eq[1], eq[2]);
  return {
    ra: (Math.atan2(eq[1] / n, eq[0] / n) * 180) / Math.PI,
    dec: (Math.asin(Math.max(-1, Math.min(1, eq[2] / n))) * 180) / Math.PI,
  };
}

/**
 * O meridiano zero que faz a lua encarar o planeta, em graus.
 *
 * E a definicao da IAU para satelite sincrono: o ponto sub-planetario fica na
 * longitude zero. Sem isto, `w0 = 0` poria o meridiano zero num lugar
 * arbitrario — invisivel enquanto a lua e uma bola de cor chapada, e visivel no
 * instante em que ela ganha um mapa, com os vulcoes de Io virados para o lado
 * errado.
 *
 * A conta: a orientacao da IAU e `M = Rx(−eps)·Rz(a0+90)·Rx(90−d0)·Rz(W)`, e o
 * meridiano zero e `M` aplicada a `x`. Como `Rz(W)` e a ultima, vale
 * `M·x = cos(W)·(A·x) + sen(W)·(A·y)` com `A` o produto das tres primeiras.
 * Entao W sai de uma projecao, sem iterar: `W = atan2(alvo·(A·y), alvo·(A·x))`.
 */
export function meridianoQueEncaraOPai(
  poloRaGraus: number,
  poloDecGraus: number,
  direcaoParaOPaiNaEcliptica: readonly [number, number, number],
): number {
  const ax = colunaDaOrientacao(poloRaGraus, poloDecGraus, 0);
  const ay = colunaDaOrientacao(poloRaGraus, poloDecGraus, 1);
  const t = direcaoParaOPaiNaEcliptica;
  const px = t[0] * ax[0] + t[1] * ax[1] + t[2] * ax[2];
  const py = t[0] * ay[0] + t[1] * ay[1] + t[2] * ay[2];
  const graus = (Math.atan2(py, px) * 180) / Math.PI;
  return ((graus % 360) + 360) % 360;
}

/**
 * Coluna `k` de `A = Rx(−eps)·Rz(a0+90)·Rx(90−d0)`, em coordenadas eclipticas.
 *
 * As mesmas tres rotacoes que `cena/corpos/orientacao.ts` monta com matrizes do
 * three. Sao duas escritas da mesma coisa, e por isso `rotacaoDasLuas.test.ts`
 * amarra as duas: se divergirem, o teste reprova em vez de a textura sair
 * girada.
 */
function colunaDaOrientacao(raGraus: number, decGraus: number, k: 0 | 1): [number, number, number] {
  const a = (raGraus + 90) * GRAU;
  const b = (90 - decGraus) * GRAU;

  // **A ordem: a matriz mais a DIREITA age primeiro.** `A = Rx(-eps)·Rz(a)·Rx(b)`
  // aplicada a `e` e `Rx(-eps)·(Rz(a)·(Rx(b)·e))`. A primeira versao deste
  // codigo girava Rz antes de Rx e produzia um meridiano constante-mente torto:
  // 69° em Miranda, 142° em Tritao, e quase certo em Io — porque em Io a
  // inclinacao e zero e as duas ordens quase coincidem. Um erro que acerta o
  // caso que se olha primeiro e erra os outros.
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const e0: [number, number, number] = k === 0 ? [1, 0, 0] : [0, 1, 0];
  const v0: [number, number, number] = [e0[0], e0[1] * cb - e0[2] * sb, e0[1] * sb + e0[2] * cb];

  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const v1: [number, number, number] = [v0[0] * ca - v0[1] * sa, v0[0] * sa + v0[1] * ca, v0[2]];

  const ce = Math.cos(-OBLIQUIDADE_RAD);
  const se = Math.sin(-OBLIQUIDADE_RAD);
  return [v1[0], v1[1] * ce - v1[2] * se, v1[1] * se + v1[2] * ce];
}
