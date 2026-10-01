/**
 * A compressao de distancias.
 *
 * Este arquivo nasce de um defeito encontrado numa auditoria do CONTRATO.md: o
 * alternador "Modo maquete" existia, o estado existia, o reducer anunciava
 * "Distancias comprimidas", o visor pintava a etiqueta "DISTANCIAS
 * COMPRIMIDAS — o desenho nao esta em escala", a Ajuda declarava a licenca —
 * **e nada comprimia**. Um `grep escalaVisual src/cena` nao devolvia uma linha.
 *
 * Pela regra de honestidade do projeto isso e pior que a funcionalidade
 * faltar: o programa afirmava ao usuario uma licenca que nao tomou. Declarar
 * licenca a mais e o mesmo defeito que declarar licenca a menos.
 */
import { describe, expect, it } from 'vitest';
import {
  R_REFERENCIA_UA,
  comprimirBuffer,
  comprimirPonto,
  comprimirRaio,
  comprimirRelativos,
  fatorEm,
} from '@cena/escala/escalaVisual.ts';
import { RAIO_INTERNOS_UA, RAIO_SISTEMA_UA, enquadrar } from '@cena/camera/enquadramento.ts';

describe('a curva da compressao', () => {
  it('a distancia de referencia nao se mexe', () => {
    expect(comprimirRaio(R_REFERENCIA_UA)).toBe(R_REFERENCIA_UA);
    expect(fatorEm(R_REFERENCIA_UA)).toBe(1);
  });

  it('e monotona: mais longe continua mais longe', () => {
    let anterior = -1;
    for (let r = 0; r <= 40; r += 0.13) {
      const c = comprimirRaio(r);
      expect(c, `r=${r}`).toBeGreaterThan(anterior);
      anterior = c;
    }
  });

  it('aproxima o que esta longe e afasta o que esta perto — os dois lados', () => {
    // Nao e "encolher tudo": e puxar para 1 UA dos dois lados. Mercurio
    // AFASTA-se do Sol no desenho, e e isso que abre espaco entre os internos.
    expect(comprimirRaio(0.387)).toBeCloseTo(0.622, 3); // Mercurio
    expect(comprimirRaio(30.07)).toBeCloseTo(5.484, 3); // Netuno
    // A razao entre o mais longe e o mais perto cai de 77:1 para 8,8:1.
    expect(30.07 / 0.387).toBeCloseTo(77.7, 1);
    expect(comprimirRaio(30.07) / comprimirRaio(0.387)).toBeCloseTo(8.81, 2);
  });

  it('nao explode nem no centro', () => {
    expect(comprimirRaio(0)).toBe(0);
    expect(Number.isFinite(fatorEm(0))).toBe(true);
    expect(fatorEm(0)).toBe(1);
    expect(Number.isFinite(fatorEm(1e-300))).toBe(true);
  });
});

describe('a compressao preserva a direcao', () => {
  const sol: [number, number, number] = [0.003, -0.001, 0.0001];

  it('o angulo visto do Sol nao muda: quem esta em oposicao continua em oposicao', () => {
    for (const p of [
      [5, 0, 0],
      [0, -9, 0],
      [3, 4, 12],
      [-1.5, 2.5, -0.3],
    ] as [number, number, number][]) {
      const c = comprimirPonto(p, sol);
      const d = [p[0] - sol[0], p[1] - sol[1], p[2] - sol[2]];
      const dc = [c[0] - sol[0], c[1] - sol[1], c[2] - sol[2]];
      const nd = Math.hypot(...d);
      const ndc = Math.hypot(...dc);
      // Cosseno do angulo entre os dois vetores radiais: tem de ser 1.
      const cos = (d[0]! * dc[0]! + d[1]! * dc[1]! + d[2]! * dc[2]!) / (nd * ndc);
      expect(cos, `${p}`).toBeCloseTo(1, 14);
      expect(ndc, `${p}`).toBeCloseTo(comprimirRaio(nd), 12);
    }
  });

  it('o proprio Sol fica onde esta: ele e o centro da compressao', () => {
    expect(comprimirPonto(sol, sol)).toEqual(sol);
  });

  it('comprimir em torno do baricentro deslocaria o Sol — por isso a origem e medida', () => {
    // Guarda contra alguem "simplificar" passando [0,0,0] como origem. O Sol
    // esta a uns 0,005 UA do baricentro; com a raiz quadrada isso vira 0,07 UA,
    // catorze vezes mais, e o Sol sairia do centro do desenho.
    const noBaricentro = comprimirPonto(sol, [0, 0, 0]);
    const deslocou = Math.hypot(noBaricentro[0] - sol[0], noBaricentro[1] - sol[1], noBaricentro[2] - sol[2]);
    expect(deslocou).toBeGreaterThan(Math.hypot(...sol) * 10);
  });
});

describe('os buffers', () => {
  it('comprimirBuffer faz o mesmo que comprimirPonto, corpo a corpo', () => {
    const pos = new Float64Array([0.003, -0.001, 0, 0.39, 0, 0.02, -5.2, 2.1, -0.3, 0, 30, 1]);
    const saida = new Float64Array(12);
    comprimirBuffer(pos, 4, saida);
    const sol: [number, number, number] = [pos[0]!, pos[1]!, pos[2]!];
    for (let i = 0; i < 4; i++) {
      const esperado = comprimirPonto([pos[3 * i]!, pos[3 * i + 1]!, pos[3 * i + 2]!], sol);
      for (let k = 0; k < 3; k++) expect(saida[3 * i + k]!, `corpo ${i} eixo ${k}`).toBeCloseTo(esperado[k]!, 15);
    }
  });

  it('comprimirBuffer pode escrever sobre a propria entrada', () => {
    const a = new Float64Array([0, 0, 0, 3, 4, 0, -9, 0, 12]);
    const b = new Float64Array(a);
    const saida = new Float64Array(9);
    comprimirBuffer(a, 3, saida);
    comprimirBuffer(b, 3, b);
    expect([...b]).toEqual([...saida]);
  });

  it('comprimirRelativos trata os pontos como ja relativos ao Sol', () => {
    const buf = new Float32Array([4, 0, 0, 0, 0, 9]);
    comprimirRelativos(buf, 2);
    expect(buf[0]!).toBeCloseTo(2, 5);
    expect(buf[5]!).toBeCloseTo(3, 5);
  });
});

describe('o enquadramento acompanha a escala', () => {
  const sol: [number, number, number] = [0, 0, 0];

  it('o sistema inteiro encolhe junto com o desenho', () => {
    expect(enquadrar('sistema', sol, null, false).raio).toBe(RAIO_SISTEMA_UA);
    expect(enquadrar('sistema', sol, null, true).raio).toBeCloseTo(comprimirRaio(RAIO_SISTEMA_UA), 12);
    expect(enquadrar('internos', sol, null, true).raio).toBeCloseTo(comprimirRaio(RAIO_INTERNOS_UA), 12);
  });

  it('"chegar perto" NAO e comprimido: e uma escala local', () => {
    // Tres raios da Terra sao 1,28e-4 UA. A raiz quadrada disso da 1,13e-2 —
    // oitenta e oito vezes maior, o que jogaria a camera para fora da orbita
    // da Lua. Comprimir uma distancia local e o erro que parece certo.
    const terra = { posicao: sol, afelioUa: 1.017, raioKm: 6371 };
    const perto = enquadrar('perto', sol, terra, true).raio;
    expect(perto).toBeCloseTo((6371 / 149597870.7) * 3, 15);
    expect(perto, 'o raio local foi comprimido').toBeLessThan(comprimirRaio(perto));
  });

  it('acompanhar usa o afelio que ja chegou comprimido, sem comprimir de novo', () => {
    // Quem mede a orbita ja devolve o afelio no espaco desenhado. Comprimir
    // aqui de novo daria a raiz quarta, e o enquadramento ficaria apertado
    // demais justamente nos planetas externos.
    const jupiter = { posicao: sol, afelioUa: comprimirRaio(5.46), raioKm: 69911 };
    expect(enquadrar('acompanhar', sol, jupiter, true).raio).toBeCloseTo(comprimirRaio(5.46) * 1.25, 12);
  });
});
