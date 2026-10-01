/**
 * A data que a pessoa le.
 *
 * A conversao de dia juliano para data civil e feita por aritmetica inteira, e
 * nao pelo `Date` do JavaScript — que carrega fuso horario (aqui a escala e
 * TDB, sem fuso) e so vai ate +-273.790 anos.
 */
import { describe, expect, it } from 'vitest';
import {
  ESCADA_DIAS_POR_SEGUNDO,
  dataCurta,
  dataDaSimulacao,
  dataDeJulianoTdb,
  dataPorExtenso,
  mudarVelocidade,
  velocidadePorExtenso,
} from '@nucleo/relogio.ts';
import { PROCEDENCIA } from './ajuda.ts';

const JD_EPOCA = PROCEDENCIA.epoca.jd_tdb;

describe('dia juliano para data civil', () => {
  it('a epoca do arquivo da a data que o proprio arquivo declara', () => {
    expect(dataDeJulianoTdb(JD_EPOCA)).toEqual({ ano: 2026, mes: 1, dia: 1 });
    expect(PROCEDENCIA.epoca.calendario_tdb).toBe('2026-01-01');
  });

  it('bate com marcos conhecidos', () => {
    expect(dataDeJulianoTdb(2451545.0)).toEqual({ ano: 2000, mes: 1, dia: 1 }); // J2000
    expect(dataDeJulianoTdb(2440587.5)).toEqual({ ano: 1970, mes: 1, dia: 1 });
    expect(dataDeJulianoTdb(2299160.5)).toEqual({ ano: 1582, mes: 10, dia: 15 }); // reforma gregoriana
  });

  it('acompanha o tempo da simulacao, para frente e para tras', () => {
    expect(dataDaSimulacao(JD_EPOCA, 0)).toEqual({ ano: 2026, mes: 1, dia: 1 });
    expect(dataDaSimulacao(JD_EPOCA, 365)).toEqual({ ano: 2027, mes: 1, dia: 1 });
    expect(dataDaSimulacao(JD_EPOCA, -36525)).toEqual({ ano: 1926, mes: 1, dia: 1 });
    expect(dataDaSimulacao(JD_EPOCA, 36525)).toEqual({ ano: 2126, mes: 1, dia: 2 });
  });

  it('meio passo nao muda o dia: a data e a do dia juliano inteiro', () => {
    expect(dataDaSimulacao(JD_EPOCA, 0.5)).toEqual(dataDaSimulacao(JD_EPOCA, 0));
  });
});

describe('como a data e escrita', () => {
  it('por extenso, em portugues', () => {
    expect(dataPorExtenso({ ano: 2026, mes: 9, dia: 21 })).toBe('21 de setembro de 2026');
    expect(dataPorExtenso({ ano: 2026, mes: 3, dia: 1 })).toBe('1 de março de 2026');
  });

  it('antes de Cristo sai com a contagem certa: o ano juliano 0 e 1 a.C.', () => {
    expect(dataPorExtenso({ ano: 0, mes: 1, dia: 1 })).toBe('1 de janeiro de 1 a.C.');
    expect(dataPorExtenso({ ano: -44, mes: 3, dia: 15 })).toBe('15 de março de 45 a.C.');
  });

  it('curta, com zero a esquerda', () => {
    expect(dataCurta({ ano: 2026, mes: 1, dia: 5 })).toBe('05/01/2026');
  });
});

describe('a escada de velocidade', () => {
  it('e crescente e comeca em 1 dia por segundo', () => {
    expect(ESCADA_DIAS_POR_SEGUNDO[0]).toBe(1);
    for (let i = 1; i < ESCADA_DIAS_POR_SEGUNDO.length; i++) {
      expect(ESCADA_DIAS_POR_SEGUNDO[i]!).toBeGreaterThan(ESCADA_DIAS_POR_SEGUNDO[i - 1]!);
    }
  });

  it('a unidade acompanha a grandeza: dias, depois meses, depois anos', () => {
    expect(velocidadePorExtenso(0)).toBe('pausado');
    expect(velocidadePorExtenso(1)).toBe('1 dia por segundo');
    expect(velocidadePorExtenso(5)).toBe('5 dias por segundo');
    expect(velocidadePorExtenso(30)).toBe('30 dias por segundo');
    // Sem o degrau de meses, 100 dias/s viraria "0,3 ano por segundo".
    expect(velocidadePorExtenso(100)).toBe('3 meses por segundo');
    expect(velocidadePorExtenso(365)).toBe('1 ano por segundo');
    expect(velocidadePorExtenso(1825)).toBe('5 anos por segundo');
    expect(velocidadePorExtenso(3650)).toBe('10 anos por segundo');
    expect(velocidadePorExtenso(7300)).toBe('20 anos por segundo');
  });

  it('a escada inteira tem rotulo legivel, sem casa decimal sobrando', () => {
    for (const v of ESCADA_DIAS_POR_SEGUNDO) {
      expect(velocidadePorExtenso(v)).not.toMatch(/[.,]\d/);
    }
  });

  it('o teto da maquina limita a escada de verdade', () => {
    // Numa maquina que so sustenta 100 dias/s, subir a partir de 100 nao mexe.
    expect(mudarVelocidade(100, 1, 100)).toBe(100);
    expect(mudarVelocidade(100, 1, 7300)).toBe(365);
    expect(mudarVelocidade(1, -1, 7300)).toBe(1);
    expect(mudarVelocidade(30, -1, 7300)).toBe(5);
  });
});
