/**
 * Os pesos de Yoshida sao literais no codigo, e nao contas.
 *
 * Calcular `1 / (2 - 2**(1/3))` em tempo de execucao faria o integrador
 * depender de `Math.cbrt` e `**` concordarem no ultimo bit em todo motor de
 * JavaScript. Fixar o literal tira essa duvida — e este teste garante que o
 * literal fixado e o certo.
 */
import { describe, expect, it } from 'vitest';
import { PESOS_YOSHIDA } from '@nucleo/integrador.ts';

const [w1, w0, w1b] = PESOS_YOSHIDA;

describe('coeficientes de Yoshida (1990)', () => {
  it('batem com a formula dentro de 1 ulp', () => {
    const esperadoW1 = 1 / (2 - Math.cbrt(2));
    expect(Math.abs(w1 - esperadoW1)).toBeLessThanOrEqual(Number.EPSILON * Math.abs(esperadoW1));
    expect(Math.abs(w0 - (1 - 2 * esperadoW1))).toBeLessThanOrEqual(4 * Number.EPSILON);
  });

  it('sao simetricos', () => {
    expect(w1b).toBe(w1);
  });

  it('somam exatamente 1 — o passo composto cobre dt inteiro', () => {
    expect(w1 + w0 + w1b).toBe(1);
  });

  it('a soma dos cubos se anula — e isso que cancela o erro de 2a ordem', () => {
    // Nao da exatamente zero em ponto flutuante: da -8,9e-16, que e da ordem
    // do epsilon vezes o maior termo (1,70^3 = 4,9). Exigir zero exato seria
    // exigir que a aritmetica IEEE-754 fosse outra.
    const soma = w1 ** 3 + w0 ** 3 + w1b ** 3;
    expect(Math.abs(soma)).toBeLessThan(1e-15);
  });

  it('o do meio e negativo — e o que torna o metodo de 4a ordem', () => {
    expect(w0).toBeLessThan(0);
  });
});
