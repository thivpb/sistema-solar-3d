/**
 * O simulador nunca mente sobre o tempo que entregou.
 *
 * Porte do bloco 9 de `tests/test_fisica_nbody.py`, mais os casos que so
 * passam a existir com o cronometro injetado — e que no original nao tinham
 * como ser escritos, porque la o modulo lia `time.perf_counter()` sozinho.
 */
import { describe, expect, it } from 'vitest';
import { Simulador, fracaoEntregue } from '@nucleo/simulador.ts';
import { yoshida4 } from '@nucleo/integrador.ts';
import { novo } from './ajuda.ts';

describe('orcamento e descarte', () => {
  it('velocidade impossivel e marcada como atrasada, e entrega o orcamento inteiro', () => {
    const { estado } = novo();
    const sim = new Simulador(estado, { integrador: yoshida4, dtDias: 0.5, passosMaxPorQuadro: 10 });
    const r = sim.avancar(1 / 60, 1_000_000);

    expect(r.atrasado).toBe(true);
    expect(r.passos).toBe(10);
    expect(r.diasDados).toBe(5);
    expect(estado.tDias).toBe(5);
    expect(fracaoEntregue(r)).toBeLessThan(0.001);
  });

  it('o excedente e DESCARTADO, nao vira divida para o quadro seguinte', () => {
    const { estado } = novo();
    const sim = new Simulador(estado, { passosMaxPorQuadro: 10 });

    sim.avancar(1 / 60, 1_000_000); // pede 16.667 dias, entrega 5
    const segundo = sim.avancar(1 / 60, 1); // pede 0,0167 dia
    // Se houvesse divida acumulada, este quadro estouraria o orcamento de novo.
    expect(segundo.atrasado).toBe(false);
    expect(segundo.passos).toBe(0);
    expect(estado.tDias).toBe(5);
  });

  it('em 10 s a 365 dias/s entrega 3650 dias, com defasagem de no maximo um passo', () => {
    const { estado } = novo();
    const sim = new Simulador(estado, { passosMaxPorQuadro: 140 });
    let entregue = 0;
    for (let q = 0; q < 600; q++) entregue += sim.avancar(1 / 60, 365).diasDados;

    expect(Math.abs(entregue - 3650)).toBeLessThanOrEqual(0.5);
    expect(sim.avancar(1 / 60, 365).atrasado).toBe(false);
  });

  it('velocidade baixa avanca aos poucos, em vez de congelar ate juntar um passo', () => {
    const { estado } = novo();
    const sim = new Simulador(estado, { passosMaxPorQuadro: 140 });
    // A 1 dia/s, um quadro de 1/60 s pede 0,0167 dia: menos de um passo.
    let comPasso = 0;
    for (let q = 0; q < 60; q++) if (sim.avancar(1 / 60, 1).passos > 0) comPasso++;

    // O que importa e que NAO congelou: o residuo acumulou e virou passo.
    expect(comPasso).toBeGreaterThan(0);
    expect(estado.tDias).toBeGreaterThanOrEqual(0.5);
    // Em 60 quadros a 1 dia/s pede-se 1 dia, o que daria dois passos — mas
    // 60 x (1/60) soma 0,9999999999999999 em ponto flutuante, e o segundo
    // passo fica para o quadro seguinte. Exigir dois aqui seria exigir que a
    // aritmetica IEEE-754 fosse outra.
    expect(estado.tDias).toBeLessThanOrEqual(1.5);
  });

  it('dt real zero ou negativo nao anda nada', () => {
    const { estado } = novo();
    const sim = new Simulador(estado);
    expect(sim.avancar(0, 365).passos).toBe(0);
    expect(sim.avancar(-1, 365).passos).toBe(0);
    expect(estado.tDias).toBe(0);
  });

  it('o cronometro e injetado: da para simular um quadro lento sem esperar por ele', () => {
    const { estado } = novo();
    let falso = 0;
    const sim = new Simulador(estado, {
      passosMaxPorQuadro: 10,
      cronometro: () => {
        falso += 7; // cada leitura "custa" 7 ms
        return falso;
      },
    });
    expect(sim.avancar(1 / 60, 1_000_000).msGastos).toBe(7);
  });

  it('o teto declarado acompanha a taxa de atualizacao medida, nao 60 fixo', () => {
    const { estado } = novo();
    const a = new Simulador(estado, { passosMaxPorQuadro: 140, quadrosPorSegundo: 60 });
    const b = new Simulador(estado, { passosMaxPorQuadro: 140, quadrosPorSegundo: 120 });
    expect(a.diasPorSegundoMaximo).toBe(4200);
    // Numa tela de 120 Hz cada quadro tem metade do tempo, e o teto DOBRA em
    // dias por segundo porque ha o dobro de quadros — mas o orcamento por
    // quadro e que teria de cair. Quem mede o orcamento e a calibragem.
    expect(b.diasPorSegundoMaximo).toBe(8400);
  });
});
