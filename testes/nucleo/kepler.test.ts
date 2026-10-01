/**
 * O solver de Kepler e a conversao elementos -> vetores.
 *
 * O teste que importa nao e "converge": e **converge na faixa inteira**. O
 * solver do projeto anterior partia de `E = M`, o que basta para os oito
 * planetas (e <= 0,21) e falha em cometa. Um teste escrito so com a Terra
 * passaria verde sobre um solver que nao serve para metade do que o programa
 * agora deixa criar.
 */
import { describe, expect, it } from 'vitest';
import {
  amostrarNoTempo,
  anomaliaVerdadeira,
  estadoDeElementos,
  grausParaRad,
  normalizarAngulo,
  resolverKepler,
  type ElementosClassicos,
} from '@nucleo/kepler.ts';

const GM_SOL = 2.9591220828411951e-4; // UA^3/dia^2, cabecalho do DE440
const DOIS_PI = 2 * Math.PI;

/**
 * Residuo da propria equacao: o unico juiz que nao depende de outro codigo.
 *
 * A diferenca e medida DANDO A VOLTA. Comparar dois angulos normalizados com
 * uma subtracao simples acusa 2π de erro quando um deles cai um ULP abaixo de
 * zero e o outro um ULP acima — que e exatamente o que acontece no periastro,
 * onde M = 0 e o solver chega em E = −1e−17. A primeira versao deste teste
 * reprovou um solver correto por causa disso.
 */
const residuo = (E: number, e: number, M: number): number => {
  const d = normalizarAngulo(E - e * Math.sin(E) - M);
  return Math.min(d, DOIS_PI - d);
};

describe('equacao de Kepler', () => {
  it('fecha em toda a faixa de excentricidade, inclusive a que o sandbox permite', () => {
    // 0,21 e o maior dos oito planetas (Mercurio). 0,967 e o do Halley. A
    // faixa aberta ate 0,99 e o que um cometa criado a mao pode ter.
    for (const e of [0, 0.01, 0.0167, 0.0934, 0.2056, 0.5, 0.8, 0.9, 0.967, 0.99]) {
      for (let k = 0; k < 64; k++) {
        const M = (k / 64) * DOIS_PI;
        const E = resolverKepler(M, e);
        expect(residuo(E, e, M), `e=${e} M=${M.toFixed(3)}`).toBeLessThan(1e-10);
      }
    }
  });

  it('fecha tambem com anomalia media negativa e alem de uma volta', () => {
    for (const M of [-0.3, -7.5, 100.0, -1000.0]) {
      const E = resolverKepler(M, 0.7);
      expect(residuo(E, 0.7, M), `M=${M}`).toBeLessThan(1e-10);
    }
  });

  it('orbita circular tem E = M exatamente', () => {
    for (const M of [0, 1, 3, 6]) expect(resolverKepler(M, 0)).toBeCloseTo(normalizarAngulo(M), 15);
  });

  it('nao devolve NaN nem no periastro de uma orbita quase parabolica', () => {
    for (const e of [0.999, 0.9999]) {
      for (const M of [0, 1e-8, 1e-4, Math.PI]) {
        const E = resolverKepler(M, e);
        expect(Number.isFinite(E), `e=${e} M=${M}`).toBe(true);
      }
    }
  });

  it('no periastro e no apoastro a anomalia verdadeira e 0 e π', () => {
    expect(anomaliaVerdadeira(0, 0.3)).toBeCloseTo(0, 12);
    expect(Math.abs(anomaliaVerdadeira(Math.PI, 0.3))).toBeCloseTo(Math.PI, 12);
  });
});

/** A Terra, a partir dos elementos medios de J2000 (Standish). */
const TERRA: ElementosClassicos = {
  aUa: 1.00000261,
  e: 0.01671123,
  iRad: grausParaRad(-0.00001531),
  nodoRad: 0,
  periastroRad: grausParaRad(102.93768193),
  anomaliaMediaRad: grausParaRad(100.46457166 - 102.93768193),
  movimentoMedioRadDia: DOIS_PI / 365.256363,
  taxaDoNodoRadDia: 0,
  taxaDoPeriastroRadDia: 0,
};

describe('elementos para vetores', () => {
  it('a distancia varia entre periastro e apoastro, e so entre eles', () => {
    let menor = Infinity;
    let maior = 0;
    for (let k = 0; k < 400; k++) {
      const { pos } = estadoDeElementos(TERRA, GM_SOL, (k / 400) * 365.256363);
      const r = Math.hypot(...pos);
      menor = Math.min(menor, r);
      maior = Math.max(maior, r);
    }
    expect(menor).toBeCloseTo(TERRA.aUa * (1 - TERRA.e), 6);
    expect(maior).toBeCloseTo(TERRA.aUa * (1 + TERRA.e), 6);
  });

  it('a energia especifica bate com -mu/2a em toda a orbita', () => {
    // E o teste que amarra posicao e velocidade uma na outra. Uma velocidade
    // com fator errado — um sqrt trocado, um `r` no lugar de `a` — deixa a
    // trajetoria com a forma certa e a energia errada, e so isto pega.
    const esperada = -GM_SOL / (2 * TERRA.aUa);
    for (let k = 0; k < 64; k++) {
      const { pos, vel } = estadoDeElementos(TERRA, GM_SOL, (k / 64) * 365.256363);
      const r = Math.hypot(...pos);
      const v2 = vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2];
      expect(v2 / 2 - GM_SOL / r, `k=${k}`).toBeCloseTo(esperada, 12);
    }
  });

  it('o momento angular se conserva ao longo da orbita', () => {
    const h = (t: number): number => {
      const { pos, vel } = estadoDeElementos(TERRA, GM_SOL, t);
      return Math.hypot(
        pos[1] * vel[2] - pos[2] * vel[1],
        pos[2] * vel[0] - pos[0] * vel[2],
        pos[0] * vel[1] - pos[1] * vel[0],
      );
    };
    const h0 = h(0);
    expect(h0).toBeCloseTo(Math.sqrt(GM_SOL * TERRA.aUa * (1 - TERRA.e * TERRA.e)), 14);
    for (const t of [40, 120, 200, 300]) expect(h(t)).toBeCloseTo(h0, 14);
  });

  it('uma volta completa volta ao mesmo lugar', () => {
    const periodo = DOIS_PI / TERRA.movimentoMedioRadDia;
    const a = estadoDeElementos(TERRA, GM_SOL, 0).pos;
    const b = estadoDeElementos(TERRA, GM_SOL, periodo).pos;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(1e-12);
  });

  it('a inclinacao e o no saem onde foram postos', () => {
    // A ordem das tres rotacoes e a fonte de erro classica aqui: trocar duas
    // delas gira a orbita para um lugar plausivel e errado.
    const el: ElementosClassicos = {
      ...TERRA,
      e: 0,
      iRad: grausParaRad(30),
      nodoRad: grausParaRad(40),
      periastroRad: 0,
      anomaliaMediaRad: 0,
    };
    // Com periastro e anomalia zerados, o corpo esta NO no ascendente: o vetor
    // aponta para a longitude do no, no plano de referencia, com z = 0.
    const { pos } = estadoDeElementos(el, GM_SOL, 0);
    expect(Math.atan2(pos[1], pos[0])).toBeCloseTo(grausParaRad(40), 12);
    expect(pos[2]).toBeCloseTo(0, 14);

    // Um quarto de volta depois, ele esta no ponto mais alto: z = r·sen(i).
    const quarto = DOIS_PI / el.movimentoMedioRadDia / 4;
    const alto = estadoDeElementos(el, GM_SOL, quarto).pos;
    expect(alto[2]).toBeCloseTo(el.aUa * Math.sin(grausParaRad(30)), 8);
  });

  it('as taxas seculares giram o no no sentido pedido', () => {
    const el: ElementosClassicos = {
      ...TERRA,
      e: 0,
      iRad: grausParaRad(20),
      nodoRad: 0,
      periastroRad: 0,
      anomaliaMediaRad: 0,
      taxaDoNodoRadDia: grausParaRad(-1), // no que regride, como o da Lua
    };
    const depoisDe10Dias = estadoDeElementos(el, GM_SOL, 0).pos;
    void depoisDe10Dias;
    // Com o corpo no no, a longitude dele E a do no: medir a longitude mede a
    // precessao diretamente.
    const longitude = (t: number): number => {
      const p = estadoDeElementos({ ...el, movimentoMedioRadDia: 1e-12 }, GM_SOL, t).pos;
      return Math.atan2(p[1], p[0]);
    };
    expect(longitude(10) - longitude(0)).toBeCloseTo(grausParaRad(-10), 10);
  });
});

describe('amostragem no tempo', () => {
  it('os pontos se adensam perto do periastro — a segunda lei aparece sozinha', () => {
    const el: ElementosClassicos = { ...TERRA, e: 0.6, periastroRad: 0, anomaliaMediaRad: 0 };
    const p = amostrarNoTempo(el, GM_SOL, 360);
    const passo = (k: number): number => {
      const i = 3 * k;
      const j = 3 * ((k + 1) % 360);
      return Math.hypot(p[j]! - p[i]!, p[j + 1]! - p[i + 1]!, p[j + 2]! - p[i + 2]!);
    };
    // O ponto 0 esta no periastro; o 180, no apoastro.
    expect(passo(0), 'o corpo deveria correr no periastro').toBeGreaterThan(passo(180) * 3);
  });

  it('nao repete o ponto de partida no fim: sao n pontos distintos', () => {
    const p = amostrarNoTempo(TERRA, GM_SOL, 8);
    expect(p.length).toBe(24);
    expect(Math.hypot(p[0]! - p[21]!, p[1]! - p[22]!, p[2]! - p[23]!)).toBeGreaterThan(1e-3);
  });
});
