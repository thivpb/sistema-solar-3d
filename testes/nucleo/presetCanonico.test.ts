/**
 * Trava a camada dinamica em exatamente nove corpos.
 *
 * Este teste protege o teste de ouro. `efemeride.test.ts` compara contra o JPL,
 * e essa comparacao so significa alguma coisa enquanto a configuracao testada
 * for a configuracao entregue. Se alguem promover a Lua a corpo dinamico no
 * preset padrao — o que e tentador quando as luas chegarem na fase F6 —, a
 * comparacao com o JPL passaria a medir outra coisa e continuaria verde.
 *
 * Entao a regra fica escrita aqui, e falha antes.
 */
import { describe, expect, it } from 'vitest';
import { carregar } from '@dados/carregar.ts';

const CHAVES_CANONICAS = [
  'sol', 'mercurio', 'venus', 'terra', 'marte', 'jupiter', 'saturno', 'urano', 'netuno',
] as const;

describe('preset canonico', () => {
  const { corpos, estado, procedencia, jdEpoca, emrat } = carregar();

  it('tem exatamente nove corpos dinamicos, nesta ordem', () => {
    expect(corpos.map((c) => c.chave)).toEqual([...CHAVES_CANONICAS]);
    expect(estado.n).toBe(9);
    expect(corpos.every((c) => c.papel === 'dinamico')).toBe(true);
  });

  it('o Sol e o corpo 0, e os oito planetas sao BARICENTROS de sistema', () => {
    expect(corpos[0]!.chave).toBe('sol');
    expect(corpos[0]!.eBaricentro).toBe(false);
    expect(corpos.slice(1).every((c) => c.eBaricentro)).toBe(true);
    expect(corpos.slice(1).map((c) => c.idHorizons)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('a epoca e 2026-01-01, JD 2461041,5 TDB', () => {
    expect(jdEpoca).toBe(2461041.5);
    expect(procedencia.epoca.calendario_tdb).toBe('2026-01-01');
    expect(procedencia.escala_de_tempo).toContain('TDB');
    expect(estado.tDias).toBe(0);
  });

  it('a origem e o baricentro do Sistema Solar, na ecliptica J2000', () => {
    expect(procedencia.vetores_de_estado.centro).toContain('500@0');
    expect(procedencia.vetores_de_estado.referencial).toContain('J2000');
  });

  it('a GM da Terra e a do SISTEMA Terra-Lua, nao a do planeta', () => {
    // A primeira versao deste teste afirmava `gmb / gmTerraSozinha - 1 === 1/emrat`.
    // Isso e uma IDENTIDADE ALGEBRICA: substituindo a definicao de
    // gmTerraSozinha, os dois lados sao o mesmo numero para QUALQUER gmb e
    // QUALQUER emrat. Passaria com os dados trocados por lixo.
    //
    // O que precisa ser afirmado sao os VALORES, contra o DE440.
    const gmb = corpos[3]!.gm;
    expect(gmb).toBeCloseTo(8.997011392947347e-10, 24);
    expect(emrat).toBeCloseTo(81.30056822149722, 10);

    // GMB = GM_Terra + GM_Lua, com GM_Terra/GM_Lua = EMRAT. Quando a Lua virar
    // corpo proprio na fase F6, estes dois valores e que entram no catalogo —
    // e a soma tem de continuar batendo com GMB dentro de 1e-12 relativo.
    const gmTerra = (gmb * emrat) / (1 + emrat);
    const gmLua = gmb / (1 + emrat);
    expect(gmTerra).toBeCloseTo(8.887692446707102e-10, 24);
    expect(gmLua).toBeCloseTo(1.093189462402435e-11, 24);
    expect(Math.abs((gmTerra + gmLua) / gmb - 1)).toBeLessThan(1e-12);
  });

  it('nenhum valor do estado inicial e infinito ou NaN', () => {
    for (let k = 0; k < 3 * estado.n; k++) {
      expect(Number.isFinite(estado.pos[k]!)).toBe(true);
      expect(Number.isFinite(estado.vel[k]!)).toBe(true);
    }
  });
});
