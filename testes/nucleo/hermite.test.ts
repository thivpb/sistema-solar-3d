/**
 * A interpolacao entre passos nao inventa movimento.
 *
 * Mede tambem o erro maximo por corpo — o numero que vai escrito no bloco
 * "o que a tela simplifica". Se a interpolacao piorar, o teste falha e o texto
 * fica sabendo junto.
 */
import { describe, expect, it } from 'vitest';
import { instanteInterpolado, interpolarHermite } from '@nucleo/amostragem.ts';
import { avancar, yoshida4 } from '@nucleo/integrador.ts';
import { copiarEstado } from '@nucleo/estado.ts';
import { UA_KM } from '@nucleo/unidades.ts';
import { NOMES, novo } from './ajuda.ts';

/**
 * Erro maximo declarado na Ajuda, em km.
 *
 * MEDIDO em sete pontos dentro do passo, para os nove corpos: o pior caso e
 * Mercurio com **0,09 km**. O limite fica em 10x o observado, e nao no valor
 * observado — asserir o valor faria o teste falhar por causa da versao do
 * motor de JavaScript, e um teste que falha por ruido e um teste que sera
 * desligado.
 *
 * Para comparar: extrapolar linearmente de `pos + vel*t`, sem olhar o proximo
 * estado integrado, erra 19.783 km em Mercurio no mesmo intervalo — 4 vezes o
 * diametro do planeta, e um SALTO na fronteira de cada passo.
 */
const LIMITE_KM = 1;

describe('interpolacao de Hermite entre dois passos', () => {
  const { estado, rascunho } = novo();
  const a = copiarEstado(estado);
  avancar(estado, yoshida4, 0.5, 1, rascunho);
  const b = copiarEstado(estado);

  it('alfa = 0 devolve o estado integrado, bit a bit', () => {
    const saida = new Float64Array(3 * a.n);
    interpolarHermite(a, b, 0.5, 0, saida);
    for (let k = 0; k < 3 * a.n; k++) expect(saida[k]).toBe(a.pos[k]);
  });

  it('alfa = 1 devolve o proximo estado integrado, bit a bit', () => {
    const saida = new Float64Array(3 * a.n);
    interpolarHermite(a, b, 0.5, 1, saida);
    for (let k = 0; k < 3 * a.n; k++) expect(saida[k]).toBe(b.pos[k]);
  });

  it('no meio do passo, erra menos que o limite declarado na Ajuda', () => {
    // Verdade de referencia: integrar ate o MEIO do passo, ou seja, ate
    // t = 0,25 dia. A primeira versao deste teste usava dois passos de 0,25 e
    // chegava a t = 0,5 — o FIM do intervalo — e entao acusava 847.741 km de
    // erro em Mercurio, que era a distancia que o planeta percorre em meio
    // dia, e nao erro de interpolacao nenhum. Passos pequenos para que o erro
    // do proprio integrador nao entre na conta.
    const meio = novo();
    avancar(meio.estado, yoshida4, 0.025, 10, meio.rascunho);
    expect(meio.estado.tDias).toBeCloseTo(0.25, 12);

    const saida = new Float64Array(3 * a.n);
    interpolarHermite(a, b, 0.5, 0.5, saida);

    let pior = 0;
    let quem = '';
    for (let i = 0; i < a.n; i++) {
      const d =
        Math.hypot(
          saida[3 * i]! - meio.estado.pos[3 * i]!,
          saida[3 * i + 1]! - meio.estado.pos[3 * i + 1]!,
          saida[3 * i + 2]! - meio.estado.pos[3 * i + 2]!,
        ) * UA_KM;
      if (d > pior) {
        pior = d;
        quem = NOMES[i]!;
      }
    }
    expect(pior, `pior: ${quem} com ${pior.toFixed(1)} km`).toBeLessThan(LIMITE_KM);
  });

  it('o instante escrito na tela acompanha o que esta desenhado', () => {
    expect(instanteInterpolado(a, 0.5, 0)).toBe(a.tDias);
    expect(instanteInterpolado(a, 0.5, 0.5)).toBe(a.tDias + 0.25);
    expect(instanteInterpolado(a, 0.5, 1)).toBe(b.tDias);
  });

  it('alfa fora de [0,1] e preso nas pontas, sem extrapolar', () => {
    const saida = new Float64Array(3 * a.n);
    const nasPontas = new Float64Array(3 * a.n);
    interpolarHermite(a, b, 0.5, 2, saida);
    interpolarHermite(a, b, 0.5, 1, nasPontas);
    expect(Array.from(saida)).toEqual(Array.from(nasPontas));
  });
});
