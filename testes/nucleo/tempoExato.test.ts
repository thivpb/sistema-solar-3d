/**
 * A data na tela corresponde ao estado fisico, sem "quase".
 *
 * A garantia que o projeto faz desde a primeira versao e que o instante
 * mostrado e sempre `t0 + n * dt` exatamente. Isso so se sustenta porque 0,5 e
 * 0,125 sao exatos em base 2: somar meios-dias nao acumula residuo nenhum.
 *
 * O teste em Python conferia `abs(t - esperado) < 1e-12`. Aqui a afirmacao e
 * mais forte e igualmente legitima: igualdade BINARIA. Se um dia alguem trocar
 * o passo por 0,3 dia, este teste falha — e deve falhar, porque a garantia
 * escrita na tela deixaria de ser verdade.
 */
import { describe, expect, it } from 'vitest';
import { Simulador } from '@nucleo/simulador.ts';
import { PASSO_CURTO_DIAS, PASSO_PADRAO_DIAS, avancar, yoshida4 } from '@nucleo/integrador.ts';
import { novo } from './ajuda.ts';

describe('o relogio da simulacao e exato', () => {
  it('1000 quadros com dt real irregular mantem tDias === passos * 0,5', () => {
    const { estado } = novo();
    const sim = new Simulador(estado, { dtDias: PASSO_PADRAO_DIAS, passosMaxPorQuadro: 140 });

    // Sequencia irregular mas deterministica: o nucleo nao pode usar
    // Math.random, e um teste que sorteia nao reproduz quando falha.
    let passosTotais = 0;
    for (let q = 0; q < 1000; q++) {
      const dtReal = (1 + (q % 7)) / 240; // de 4 ms a 29 ms
      passosTotais += sim.avancar(dtReal, 30).passos;
      expect(estado.tDias).toBe(passosTotais * PASSO_PADRAO_DIAS);
    }
    expect(passosTotais).toBeGreaterThan(0);
  });

  it('o passo curto de 0,125 dia tambem e exato', () => {
    const { estado } = novo();
    const sim = new Simulador(estado, { dtDias: PASSO_CURTO_DIAS });
    let n = 0;
    for (let q = 0; q < 200; q++) n += sim.avancar(1 / 60, 30).passos;
    expect(estado.tDias).toBe(n * PASSO_CURTO_DIAS);
  });

  it('passo unico para tras desfaz o passo unico para frente', () => {
    const { estado } = novo();
    const sim = new Simulador(estado);
    sim.passoUnico(1);
    expect(estado.tDias).toBe(0.5);
    sim.passoUnico(-1);
    expect(estado.tDias).toBe(0);
  });

  it('avancar() soma exatamente passos * dt', () => {
    const { estado, rascunho } = novo();
    avancar(estado, yoshida4, 0.5, 73050, rascunho);
    expect(estado.tDias).toBe(36525);
  });
});
