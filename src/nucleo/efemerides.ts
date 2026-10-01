/**
 * Le grandezas uteis a partir do estado atual: distancia, velocidade, e a
 * elipse que o corpo esta percorrendo neste instante.
 *
 * Sobre "elementos osculadores": a orbita de um planeta nao e uma elipse fixa.
 * Os outros planetas puxam, e a elipse muda de forma devagar. O que se calcula
 * aqui e a elipse que o corpo seguiria SE, a partir deste instante, so o Sol
 * existisse. E uma foto instantanea, nao uma promessa sobre o futuro.
 *
 * **O ponto que a versao anterior do projeto errava** (em
 * SIM_fourier_original/utils/lib.py): para elementos HELIOCENTRICOS e preciso
 * usar posicao e velocidade RELATIVAS AO SOL. Usar os vetores baricentricos
 * junto com a gravidade solar mistura dois referenciais. O Sol se move cerca
 * de 0,005 UA em torno do baricentro, puxado sobretudo por Jupiter, e para
 * Venus isso chega a inflar a excentricidade calculada em 2,5 vezes.
 */
import { GRAUS_POR_RAD } from './unidades.ts';
import type { EstadoSistema } from './tipos.ts';
import { resolverKepler } from './kepler.ts';

export interface ElementosOsculadores {
  /** Falso quando a energia especifica e >= 0: o corpo nao esta preso ao Sol. */
  ligada: boolean;
  /** Semieixo maior, UA. Infinito quando nao ligada. */
  a: number;
  excentricidade: number;
  perielio: number;
  afelio: number;
  periodoDias: number;
  /** Inclinacao em relacao ao plano da ecliptica, em graus. */
  inclinacaoGraus: number;
}

const NAO_LIGADA: ElementosOsculadores = {
  ligada: false,
  a: Infinity,
  excentricidade: NaN,
  perielio: NaN,
  afelio: NaN,
  periodoDias: NaN,
  inclinacaoGraus: NaN,
};

/** Posicao e velocidade do corpo i vistas do Sol. A base de tudo neste modulo. */
function relativoAoSol(
  e: EstadoSistema,
  i: number,
  iSol: number,
): { r: [number, number, number]; v: [number, number, number] } {
  const a = 3 * i;
  const b = 3 * iSol;
  return {
    r: [e.pos[a]! - e.pos[b]!, e.pos[a + 1]! - e.pos[b + 1]!, e.pos[a + 2]! - e.pos[b + 2]!],
    v: [e.vel[a]! - e.vel[b]!, e.vel[a + 1]! - e.vel[b + 1]!, e.vel[a + 2]! - e.vel[b + 2]!],
  };
}

type V3 = [number, number, number];
type V3Leitura = readonly [number, number, number];
const cruz = (u: V3Leitura, w: V3Leitura): V3 => [
  u[1] * w[2] - u[2] * w[1],
  u[2] * w[0] - u[0] * w[2],
  u[0] * w[1] - u[1] * w[0],
];
const escalar = (u: V3Leitura, w: V3Leitura): number => u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
const norma = (u: V3Leitura): number => Math.hypot(u[0], u[1], u[2]);

export function distanciaAoSolUa(e: EstadoSistema, i: number, iSol = 0): number {
  return norma(relativoAoSol(e, i, iSol).r);
}

/** Velocidade relativa ao Sol, em UA/dia. */
export function velocidadeOrbital(e: EstadoSistema, i: number, iSol = 0): number {
  return norma(relativoAoSol(e, i, iSol).v);
}

/**
 * Angulo do corpo no plano da ecliptica, em radianos.
 * Base da comparacao entre dois planetas: quanto cada um girou no mesmo intervalo.
 */
export function anguloHeliocentrico(e: EstadoSistema, i: number, iSol = 0): number {
  const { r } = relativoAoSol(e, i, iSol);
  return Math.atan2(r[1], r[0]);
}

/**
 * Elipse instantanea do corpo i em torno do Sol.
 *
 * `mu = GM(Sol) + GM(corpo)`: o problema de dois corpos depende da massa
 * total, nao so da do Sol. Para Jupiter a diferenca no semieixo e de 0,1% —
 * pequena, mas maior que a tolerancia com que o teste compara contra os
 * elementos medios conhecidos.
 */
/**
 * Erro de programacao, nao de dado: alguem pediu a orbita do proprio
 * referencial. O Python levantava `ZeroDivisionError` aqui; o JavaScript, em
 * silencio, devolveria `a = 0`, `periodo = 0` e `ligada = true` — um objeto que
 * satisfaz o tipo, passa por `ligada` e chega na ficha como "uma volta leva
 * cerca de 0 dias".
 *
 * Devolver NAO_LIGADA tambem seria errado: isso significa "orbita aberta", que
 * e outra coisa. O Sol nao tem uma orbita aberta — ele nao tem orbita
 * heliocentrica nenhuma, e e por isso que `analiseSol.ts` existe.
 */
function exigirQueNaoSejaOReferencial(i: number, iSol: number): void {
  if (i === iSol) {
    throw new RangeError(
      'o corpo de referencia nao tem elementos heliocentricos — use analisarSol() para o Sol',
    );
  }
}

export function elementosOsculadores(e: EstadoSistema, i: number, iSol = 0): ElementosOsculadores {
  exigirQueNaoSejaOReferencial(i, iSol);
  const { r, v } = relativoAoSol(e, i, iSol);
  return elementosDeVetores(r, v, e.gm[iSol]! + e.gm[i]!);
}

/**
 * Os mesmos elementos, a partir de vetores soltos.
 *
 * Existe porque o sandbox precisa avaliar um corpo **antes** de inserir. A
 * guarda de periastro recusa criacoes que o integrador nao daria conta, e
 * recusar depois de inserir seria inserir e desfazer — com o estado passando,
 * por um instante, por uma configuracao que o proprio programa considera
 * invalida. O ponto de partida dela e o mesmo `elementosOsculadores`, agora
 * com os vetores vindo de fora.
 */
export function elementosDeVetores(
  rVec: readonly [number, number, number],
  vVec: readonly [number, number, number],
  mu: number,
): ElementosOsculadores {
  const r = norma(rVec);
  const v2 = escalar(vVec, vVec);
  if (!(r > 0) || !(mu > 0)) return { ...NAO_LIGADA };

  // Energia especifica: eps = v^2/2 - mu/r, e a = -mu/(2 eps)
  const energiaEsp = v2 / 2 - mu / r;
  if (energiaEsp >= 0) return { ...NAO_LIGADA };
  const a = -mu / (2 * energiaEsp);

  const hVec = cruz(rVec, vVec); // momento angular especifico
  const h = norma(hVec);

  // Vetor de Laplace-Runge-Lenz: aponta para o perielio, e seu modulo e `e`.
  const vxh = cruz(vVec, hVec);
  const eVec: V3 = [vxh[0] / mu - rVec[0] / r, vxh[1] / mu - rVec[1] / r, vxh[2] / mu - rVec[2] / r];
  const exc = norma(eVec);

  const inclinacaoGraus = h > 0 ? Math.acos(Math.min(1, Math.max(-1, hVec[2] / h))) * GRAUS_POR_RAD : 0;

  return {
    ligada: true,
    a,
    excentricidade: exc,
    perielio: a * (1 - exc),
    afelio: a * (1 + exc),
    periodoDias: 2 * Math.PI * Math.sqrt((a * a * a) / mu),
    inclinacaoGraus,
  };
}

/**
 * Pontos (n,3) da elipse instantanea, em UA, ja no referencial da cena.
 *
 * Desenhada em torno da posicao ATUAL do Sol, entao acompanha o Sol quando ele
 * se desloca. Devolve um Float64Array achatado, com 3 numeros por ponto; vazio
 * quando a orbita nao esta ligada.
 *
 * A base perifocal e ortonormal de verdade: `p` aponta para o perielio, `w` e
 * a normal do plano orbital e `q` fecha os dois. E isso que faz a elipse sair
 * ja no plano orbital real em 3D, sem etapa de rotacao depois.
 */
export function elipseOsculadora(
  e: EstadoSistema,
  i: number,
  nPontos = 360,
  iSol = 0,
): Float64Array {
  exigirQueNaoSejaOReferencial(i, iSol);
  const { r: rVec, v: vVec } = relativoAoSol(e, i, iSol);
  const mu = e.gm[iSol]! + e.gm[i]!;
  const r = norma(rVec);
  const energiaEsp = escalar(vVec, vVec) / 2 - mu / r;
  if (energiaEsp >= 0) return new Float64Array(0);

  const a = -mu / (2 * energiaEsp);
  const hVec = cruz(rVec, vVec);
  const vxh = cruz(vVec, hVec);
  const eVec: V3 = [vxh[0] / mu - rVec[0] / r, vxh[1] / mu - rVec[1] / r, vxh[2] / mu - rVec[2] / r];
  const exc = norma(eVec);

  // Orbita quase circular nao tem perielio definido: qualquer base do plano
  // serve, e a posicao atual e uma escolha tao boa quanto outra.
  const pHat: V3 =
    exc > 1e-12
      ? [eVec[0] / exc, eVec[1] / exc, eVec[2] / exc]
      : [rVec[0] / r, rVec[1] / r, rVec[2] / r];
  const h = norma(hVec);
  const wHat: V3 = [hVec[0] / h, hVec[1] / h, hVec[2] / h];
  const qHat = cruz(wHat, pHat);

  const b = a * Math.sqrt(Math.max(0, 1 - exc * exc));
  const sx = e.pos[3 * iSol]!;
  const sy = e.pos[3 * iSol + 1]!;
  const sz = e.pos[3 * iSol + 2]!;

  const saida = new Float64Array(3 * nPontos);
  for (let k = 0; k < nPontos; k++) {
    // Parametrizada pela anomalia excentrica: distribui os pontos pela
    // geometria da elipse, nao pelo tempo. Para o caminho desenhado e o que se
    // quer; quem precisa de espacamento por tempo e o laboratorio de Fourier.
    const anomalia = (2 * Math.PI * k) / (nPontos - 1);
    const x = a * (Math.cos(anomalia) - exc);
    const y = b * Math.sin(anomalia);
    saida[3 * k] = sx + x * pHat[0] + y * qHat[0];
    saida[3 * k + 1] = sy + x * pHat[1] + y * qHat[1];
    saida[3 * k + 2] = sz + x * pHat[2] + y * qHat[2];
  }
  return saida;
}

/**
 * A elipse que um corpo seguiria se fosse largado aqui, com esta velocidade.
 *
 * Fechada, e nao integrada. A "trajetoria prevista" do sandbox e exatamente a
 * mesma coisa que o programa ja desenha como caminho previsto para os oito
 * planetas: a elipse osculadora de dois corpos. Integrar para prever custaria
 * um worker, milhares de passos por gesto e uma segunda fisica com o direito
 * de discordar da primeira — para chegar, no primeiro instante, exatamente
 * nesta elipse.
 *
 * Devolve vazio quando a orbita nao e fechada: ali nao ha volta para desenhar,
 * e a propria ausencia da linha diz que o corpo vai embora.
 */
export function previsaoDeOrbita(
  posUa: readonly [number, number, number],
  velUaDia: readonly [number, number, number],
  solUa: readonly [number, number, number],
  solVelUaDia: readonly [number, number, number],
  mu: number,
  nPontos = 240,
): Float64Array {
  const r: [number, number, number] = [posUa[0] - solUa[0], posUa[1] - solUa[1], posUa[2] - solUa[2]];
  const v: [number, number, number] = [
    velUaDia[0] - solVelUaDia[0],
    velUaDia[1] - solVelUaDia[1],
    velUaDia[2] - solVelUaDia[2],
  ];
  const el = elementosDeVetores(r, v, mu);
  if (!el.ligada) return new Float64Array(0);

  const rn = norma(r);
  const energiaEsp = escalar(v, v) / 2 - mu / rn;
  const a = -mu / (2 * energiaEsp);
  const hVec = cruz(r, v);
  const vxh = cruz(v, hVec);
  const eVec: V3 = [vxh[0] / mu - r[0] / rn, vxh[1] / mu - r[1] / rn, vxh[2] / mu - r[2] / rn];
  const exc = norma(eVec);
  const pHat: V3 = exc > 1e-12 ? [eVec[0] / exc, eVec[1] / exc, eVec[2] / exc] : [r[0] / rn, r[1] / rn, r[2] / rn];
  const h = norma(hVec);
  const wHat: V3 = [hVec[0] / h, hVec[1] / h, hVec[2] / h];
  const qHat = cruz(wHat, pHat);
  const b = a * Math.sqrt(Math.max(0, 1 - exc * exc));

  const saida = new Float64Array(3 * nPontos);
  for (let k = 0; k < nPontos; k++) {
    const anomalia = (2 * Math.PI * k) / (nPontos - 1);
    const x = a * (Math.cos(anomalia) - exc);
    const y = b * Math.sin(anomalia);
    saida[3 * k] = solUa[0] + x * pHat[0] + y * qHat[0];
    saida[3 * k + 1] = solUa[1] + x * pHat[1] + y * qHat[1];
    saida[3 * k + 2] = solUa[2] + x * pHat[2] + y * qHat[2];
  }
  return saida;
}

export interface CurvaDoLaboratorio {
  /** `2n` numeros: x, y em UA no plano orbital, com o periastro em +x. */
  pontos: Float64Array;
  aUa: number;
  excentricidade: number;
  periodoDias: number;
  inclinacaoGraus: number;
  /** Onde o corpo esta agora, como fracao da volta contada do periastro. */
  faseAtual: number;
}

/**
 * A orbita osculadora amostrada IGUALMENTE ESPACADA NO TEMPO, no proprio plano.
 *
 * Existe ao lado de `elipseOsculadora`, e nao no lugar dela, porque as duas
 * respondem perguntas diferentes:
 *
 *   `elipseOsculadora`  parametriza pela anomalia excentrica. Distribui os
 *                       pontos pela GEOMETRIA, que e o que um caminho
 *                       desenhado quer: densidade uniforme ao longo da curva.
 *   esta                parametriza pelo TEMPO. Os pontos se adensam perto do
 *                       periastro, onde o corpo corre.
 *
 * Para o laboratorio de Fourier a diferenca nao e estetica: sao duas funcoes
 * distintas, com coeficientes distintos. A serie de epiciclos so descreve o
 * movimento se a parametrizacao for o tempo — um epiciclo gira a velocidade
 * constante, e isso e uma afirmacao sobre o tempo, nao sobre o angulo. Foi um
 * dos erros de `SIM_fourier_original/`.
 *
 * Sai em 2D e no plano orbital de proposito: o laboratorio e um grafico, e a
 * terceira dimensao so acrescentaria oclusao — escondendo justamente o desvio
 * que se quer medir.
 */
export function curvaDoLaboratorio(
  e: EstadoSistema,
  i: number,
  nPontos = 720,
  iSol = 0,
): CurvaDoLaboratorio | null {
  const el = elementosOsculadores(e, i, iSol);
  if (!el.ligada) return null;

  const a = el.a;
  const exc = el.excentricidade;
  const b = a * Math.sqrt(Math.max(0, 1 - exc * exc));

  const pontos = new Float64Array(2 * nPontos);
  for (let k = 0; k < nPontos; k++) {
    const E = resolverKepler((2 * Math.PI * k) / nPontos, exc);
    pontos[2 * k] = a * (Math.cos(E) - exc);
    pontos[2 * k + 1] = b * Math.sin(E);
  }

  return {
    pontos,
    aUa: a,
    excentricidade: exc,
    periodoDias: el.periodoDias,
    inclinacaoGraus: el.inclinacaoGraus,
    faseAtual: faseNaOrbita(e, i, a, exc, iSol),
  };
}

/** Fracao da volta ja percorrida desde o periastro, em [0, 1). */
function faseNaOrbita(
  e: EstadoSistema,
  i: number,
  a: number,
  exc: number,
  iSol: number,
): number {
  const { r: rVec, v: vVec } = relativoAoSol(e, i, iSol);
  const r = norma(rVec);
  // `cos E = (1 − r/a)/e`, e o sinal vem de r·v: positivo depois do periastro.
  const cosE = exc > 1e-12 ? Math.min(1, Math.max(-1, (1 - r / a) / exc)) : 1;
  const E = escalar(rVec, vVec) >= 0 ? Math.acos(cosE) : 2 * Math.PI - Math.acos(cosE);
  const M = E - exc * Math.sin(E);
  const f = M / (2 * Math.PI);
  return f - Math.floor(f);
}
