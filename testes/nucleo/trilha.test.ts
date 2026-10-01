/**
 * O rastro percorrido.
 *
 * A propriedade que este arquivo existe para travar e a da primeira linha do
 * modulo: **a trilha e amostrada por TEMPO SIMULADO, nao por quadro.**
 * Amostrar por quadro faria a trilha mudar de aparencia so por mudar a
 * velocidade do tempo ou a taxa de quadros — e ela passaria a dizer algo sobre
 * o computador em vez de dizer algo sobre a orbita.
 *
 * E uma daquelas propriedades que ninguem nota quebrada: o rastro continua
 * aparecendo, so que mais curto quando o computador esta ocupado.
 */
import { describe, expect, it } from 'vitest';
import { ConjuntoTrilhas, Trilha } from '@nucleo/trilha.ts';

describe('uma trilha', () => {
  it('guarda um ponto por intervalo de tempo simulado, e nao por chamada', () => {
    const t = new Trilha(100, 2);
    // Cem chamadas dentro de um unico intervalo: um ponto so.
    for (let k = 0; k < 100; k++) t.registrar(k, 0, 0, 0.01 * k);
    expect(t.tamanho).toBe(1);

    // Ate o dia 19,98, um ponto a cada dois dias contados do ultimo GRAVADO:
    // 2, 4, … 18. Nove a mais, e nao dez — o ponto de t = 20 nunca chega.
    for (let k = 0; k < 1000; k++) t.registrar(k, 0, 0, 0.02 * k);
    expect(t.tamanho).toBe(10);
  });

  it('a quantidade de pontos NAO depende de quantos quadros passaram', () => {
    // O teste que da nome ao arquivo. Duas maquinas, uma a 60 quadros por
    // segundo e outra a 6, simulando exatamente os mesmos 100 dias.
    const rapida = new Trilha(500, 1);
    const lenta = new Trilha(500, 1);
    for (let k = 0; k <= 6000; k++) rapida.registrar(k, 0, 0, (100 * k) / 6000);
    for (let k = 0; k <= 600; k++) lenta.registrar(k, 0, 0, (100 * k) / 600);
    expect(rapida.tamanho).toBe(lenta.tamanho);
  });

  it('funciona com o tempo correndo para tras', () => {
    const t = new Trilha(50, 1);
    for (let k = 0; k >= -20; k--) t.registrar(k, 0, 0, k);
    expect(t.tamanho).toBe(21);
  });

  it('o buffer circular devolve do mais antigo para o mais recente', () => {
    const t = new Trilha(4, 1);
    for (let k = 0; k < 10; k++) t.registrar(k, 0, 0, k);
    const p = t.pontos();
    expect(p.length).toBe(12);
    // Os quatro ultimos: 6, 7, 8, 9.
    expect([p[0], p[3], p[6], p[9]]).toEqual([6, 7, 8, 9]);
  });

  it('nao cresce alem da capacidade', () => {
    const t = new Trilha(10, 1);
    for (let k = 0; k < 1000; k++) t.registrar(k, 0, 0, k);
    expect(t.tamanho).toBe(10);
    expect(t.pontos().length).toBe(30);
  });

  it('limpar apaga tudo, inclusive a marca de tempo', () => {
    const t = new Trilha(10, 5);
    t.registrar(1, 2, 3, 100);
    t.limpar();
    expect(t.tamanho).toBe(0);
    // Sem apagar `tUltimo`, o primeiro ponto depois de "Voltar ao inicio" so
    // entraria cinco dias simulados depois — e o rastro nasceria truncado.
    expect(t.registrar(9, 9, 9, 0)).toBe(true);
  });
});

describe('o conjunto', () => {
  it('cada corpo ganha um intervalo proporcional ao proprio periodo', () => {
    // Netuno leva 165 anos e Mercurio 88 dias. Um intervalo unico deixaria a
    // trilha de Mercurio um borrao e a de Netuno um tracinho.
    const c = new ConjuntoTrilhas([null, 87.97, 365.25, 60190], 400, 0.0025);
    expect(c.trilhas[1]!.intervaloDias).toBeCloseTo(0.25, 6); // o piso
    expect(c.trilhas[2]!.intervaloDias).toBeCloseTo(0.913, 3);
    expect(c.trilhas[3]!.intervaloDias).toBeCloseTo(150.5, 1);
  });

  it('a trilha de cada corpo tem o mesmo comprimento em FRACAO DE ORBITA', () => {
    // E a consequencia que importa na tela: todos os rastros cobrem o mesmo
    // pedaco da propria volta, e nao o mesmo numero de dias.
    const periodos = [null, 87.97, 365.25, 4332.6, 60190];
    const c = new ConjuntoTrilhas(periodos, 400, 0.0025);
    for (let k = 0; k < 400000; k++) c.registrar(new Float64Array(15), k * 10);
    for (let i = 1; i < periodos.length; i++) {
      const fracao = (c.trilhas[i]!.tamanho * c.trilhas[i]!.intervaloDias) / periodos[i]!;
      // Mercurio bate no PISO de 0,25 dia — 87,97 × 0,0025 da 0,22 — e por
      // isso o rastro dele cobre 1,14 volta em vez de 1. O piso existe para
      // que uma lua de 7 horas nao pedisse um ponto a cada dois minutos, e a
      // consequencia e esta. Declarar o piso na assercao e melhor que afrouxar
      // a tolerancia ate ele caber sem aparecer.
      const noPiso = c.trilhas[i]!.intervaloDias === 0.25;
      if (noPiso) {
        expect(fracao, `corpo ${i} esta no piso`).toBeGreaterThanOrEqual(1);
        expect(fracao).toBeLessThan(1.3);
      } else {
        expect(fracao, `corpo ${i}`).toBeCloseTo(1, 1);
      }
    }
  });

  it('pedir um corpo que nao existe devolve vazio, e nao explode', () => {
    const c = new ConjuntoTrilhas([365], 10);
    expect(c.pontos(99).length).toBe(0);
  });
});

describe('`pontos()` não aloca', () => {
  /**
   * A propriedade, e por que ela é medível.
   *
   * `pontos()` roda uma vez por corpo por quadro — nove corpos a 60 Hz. Cada
   * chamada alocava um `Float64Array` de 420 pontos, 10 KB, que era copiado no
   * buffer da fita no mesmo instante e descartado: cerca de 540 arrays por
   * segundo, 5,4 MB/s de lixo para nada.
   *
   * Um teste de "quantos bytes alocou" precisaria do coletor de lixo. O que se
   * afirma aqui é a consequência observável e mais forte: **é o MESMO objeto**
   * em chamadas seguidas. Um array novo por chamada reprova imediatamente.
   */
  it('devolve a mesma vista em chamadas seguidas, cheia ou não', () => {
    const t = new Trilha(8, 1);
    for (let k = 0; k < 4; k++) t.registrar(k, 0, 0, k);
    expect(t.pontos().buffer, 'antes de dar a volta').toBe(t.pontos().buffer);

    for (let k = 4; k < 20; k++) t.registrar(k, 0, 0, k);
    const uma = t.pontos();
    const outra = t.pontos();
    expect(outra.buffer, 'depois de dar a volta').toBe(uma.buffer);
    expect(outra.byteOffset).toBe(uma.byteOffset);
  });

  it('e o conteúdo continua certo: o mais antigo primeiro', () => {
    // A guarda. Reutilizar o buffer sem reescrevê-lo daria o mesmo objeto com
    // os pontos da chamada anterior, e o teste acima passaria.
    const t = new Trilha(4, 1);
    for (let k = 0; k < 6; k++) t.registrar(k, 10 * k, 0, k);
    const p = t.pontos();
    expect([...p]).toEqual([2, 20, 0, 3, 30, 0, 4, 40, 0, 5, 50, 0]);

    t.registrar(6, 60, 0, 6);
    expect([...t.pontos()]).toEqual([3, 30, 0, 4, 40, 0, 5, 50, 0, 6, 60, 0]);
  });
});
