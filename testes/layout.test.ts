/**
 * Porte de `tests/test_layout.py`: 480 combinacoes de tamanho de janela.
 *
 * O teste original nasceu de um defeito real — a versao anterior aquela nao
 * redimensionava, porque havia retangulo calculado no escopo do modulo. Aqui a
 * funcao e pura e emite variaveis CSS, entao o teste continua cobrindo o que
 * cobria: area negativa, sobreposicao indevida, canvas pequeno demais.
 *
 * Acrescenta 320 e 360 px de largura, que a WCAG 2.2 exige no criterio 1.4.10
 * (Reflow) e que a versao em janela nunca precisou atender.
 */
import { describe, expect, it } from 'vitest';
import {
  ALTURA_CONFORTAVEL,
  LARGURA_CONFORTAVEL,
  alturaDe,
  calcular,
  faixaDe,
} from '@interface/layout.ts';

const LARGURAS = [320, 360, 480, 640, 800, 960, 1000, 1100, 1220, 1280, 1440, 1920, 2560, 3024];
const ALTURAS = [400, 500, 600, 680, 720, 800, 900, 1080, 1440, 1964];
const ESCALAS = [1, 1.25];

describe(`${LARGURAS.length * ALTURAS.length * ESCALAS.length * 2} combinacoes de janela`, () => {
  for (const escalaTexto of ESCALAS) {
    for (const lateralAberta of [true, false]) {
      it(`escala ${escalaTexto}, lateral ${lateralAberta ? 'aberta' : 'fechada'}`, () => {
        for (const L of LARGURAS) {
          for (const A of ALTURAS) {
            const a = calcular(L, A, lateralAberta, { escalaTexto });
            const onde = `${L}x${A}`;

            for (const r of [a.barraSuperior, a.lateral, a.canvas]) {
              expect(r.largura, `${onde}: largura negativa`).toBeGreaterThan(0);
              expect(r.altura, `${onde}: altura negativa`).toBeGreaterThan(0);
              expect(r.x, `${onde}: x fora da tela`).toBeGreaterThanOrEqual(0);
              expect(r.y, `${onde}: y fora da tela`).toBeGreaterThanOrEqual(0);
            }

            // O canvas e a barra nao invadem um ao outro.
            expect(a.canvas.y, onde).toBeGreaterThanOrEqual(a.barraSuperior.altura);

            // Quando a lateral divide espaco, ela e o canvas nao se sobrepoem.
            if (a.lateralVisivel && !a.lateralSobreposta) {
              expect(a.canvas.x + a.canvas.largura, `${onde}: canvas invade a lateral`).toBeLessThanOrEqual(a.lateral.x);
            }

            // O canvas nunca fica menor que a lateral que o espreme.
            if (a.lateralVisivel && !a.lateralSobreposta) {
              expect(a.canvas.largura, `${onde}: canvas menor que a lateral`).toBeGreaterThanOrEqual(a.lateral.largura);
            }

            // Nada transborda a janela.
            expect(a.lateral.x + a.lateral.largura, onde).toBeLessThanOrEqual(Math.max(L, 320));
          }
        }
      });
    }
  }
});

describe('pontos de quebra', () => {
  it('sao os mesmos da versao anterior: 1220 e 1000 de largura, 680 de altura', () => {
    expect(faixaDe(1220)).toBe('amplo');
    expect(faixaDe(1219)).toBe('medio');
    expect(faixaDe(1000)).toBe('medio');
    expect(faixaDe(999)).toBe('estreito');
    expect(alturaDe(680)).toBe('normal');
    expect(alturaDe(679)).toBe('baixo');
  });

  it('abaixo do ponto de quebra a lateral SOBREPOE, em vez de sumir', () => {
    // Sumir tiraria a unica lista de corpos navegavel por teclado.
    const estreito = calcular(800, 700, true);
    expect(estreito.lateralSobreposta).toBe(true);
    expect(estreito.lateralVisivel).toBe(true);
    expect(estreito.canvas.largura).toBe(800);
  });

  it('na janela confortavel a lateral divide espaco com o canvas', () => {
    const a = calcular(LARGURA_CONFORTAVEL + 100, ALTURA_CONFORTAVEL + 100, true);
    expect(a.lateralSobreposta).toBe(false);
    expect(a.canvas.largura).toBeLessThan(LARGURA_CONFORTAVEL + 100);
  });
});

describe('robustez', () => {
  it('janela absurda nao produz area negativa', () => {
    for (const [L, A] of [[0, 0], [-100, -100], [1, 1], [20000, 20000]] as const) {
      const a = calcular(L, A, true);
      expect(a.canvas.largura).toBeGreaterThan(0);
      expect(a.canvas.altura).toBeGreaterThan(0);
    }
  });

  it('"Texto maior" reescala a barra e a lateral juntas', () => {
    const normal = calcular(1440, 900, true, { escalaTexto: 1 });
    const maior = calcular(1440, 900, true, { escalaTexto: 1.25 });
    expect(maior.barraSuperior.altura).toBeGreaterThan(normal.barraSuperior.altura);
    expect(maior.lateral.largura).toBeGreaterThan(normal.lateral.largura);
    expect(maior.variaveis['--escala-texto']).toBe('1.25');
  });

  it('emite as variaveis que o CSS espera', () => {
    const v = calcular(1440, 900, true).variaveis;
    for (const chave of ['--escala-texto', '--altura-barra', '--largura-lateral', '--gutter']) {
      expect(v[chave], chave).toBeDefined();
    }
  });
});
