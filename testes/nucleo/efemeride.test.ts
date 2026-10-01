/**
 * Compara as posicoes calculadas com a efemeride de referencia do JPL.
 *
 * Porte de `tests/test_efemeride.py`. Roda offline: os pontos de referencia
 * foram baixados do Horizons quando o JSON foi gerado e ficam dentro dele.
 *
 * **Este e o teste de ouro.** E o unico do projeto que compara contra uma
 * fonte externa independente, e ele so vale enquanto a configuracao testada
 * for a configuracao entregue — dai `presetCanonico.test.ts` existir ao lado.
 *
 * CRITERIO, definido antes de olhar os resultados:
 *
 *     o erro de posicao de cada corpo fica abaixo de 1% da distancia dele ao
 *     Sol, no intervalo de -100 a +100 anos em torno da epoca.
 *
 * Um por cento e uma barra deliberadamente modesta. Ela diz que a simulacao
 * serve para mostrar como o sistema se move e onde os planetas estao, e nao
 * que substitui a efemeride do JPL. Mercurio e o caso dificil e chega a cerca
 * de 0,5% em 100 anos.
 *
 * Por que sobra erro, em ordem de importancia:
 *   - truncamento do passo de 0,5 dia, que domina no caso de Mercurio;
 *   - a Lua entra somada ao baricentro Terra-Lua, nao como corpo proprio;
 *   - Plutao, asteroides e os demais corpos do DE441 nao existem neste modelo;
 *   - relatividade geral nao incluida (43"/seculo no perielio de Mercurio).
 *
 * Nada disso desaparece "integrando com mais cuidado": sao limites do modelo
 * de nove corpos, e a documentacao do programa diz isso em voz alta.
 */
import { describe, expect, it } from 'vitest';
import { carregar } from '@dados/carregar.ts';
import { distanciaAoSolUa } from '@nucleo/efemerides.ts';
import { PASSO_PADRAO_DIAS, avancar, yoshida4 } from '@nucleo/integrador.ts';
import { criarRascunho } from '@nucleo/tipos.ts';
import { UA_KM } from '@nucleo/unidades.ts';

const TOLERANCIA_RELATIVA = 0.01;

const { corpos, validacao, procedencia } = carregar();
const pontos = Object.keys(validacao).sort((a, b) => Number(a) - Number(b));

describe('comparacao com a efemeride de referencia do JPL', () => {
  it('o arquivo traz pontos de validacao', () => {
    expect(pontos.length).toBeGreaterThan(0);
    expect(procedencia.vetores_de_estado.efemeride_citada_pelo_horizons).toContain('DE441');
    expect(procedencia.vetores_de_estado.correcao).toBe('VEC_CORR=NONE (estado geometrico)');
  });

  for (const chave of pontos) {
    const ponto = validacao[chave]!;
    const anos = Number(chave);

    describe(`${anos > 0 ? '+' : ''}${anos} anos (${ponto.calendario_tdb})`, () => {
      // Integra uma vez por ponto, de um estado novo, como o teste em Python fazia.
      const { estado } = carregar();
      const rascunho = criarRascunho(estado.capacidade);
      const dias = ponto.dias_desde_a_epoca;
      const passos = Math.round(Math.abs(dias) / PASSO_PADRAO_DIAS);
      const sinal = dias >= 0 ? 1 : -1;
      avancar(estado, yoshida4, sinal * PASSO_PADRAO_DIAS, passos, rascunho);

      it('chega exatamente na epoca do ponto de referencia', () => {
        // Nao e "quase": 0,5 e exato em binario, entao a igualdade e literal.
        expect(estado.tDias).toBe(dias);
      });

      for (let i = 0; i < corpos.length; i++) {
        const corpo = corpos[i]!;
        if (corpo.chave === 'sol') continue;

        it(`${corpo.nome} dentro de 1% da distancia ao Sol`, () => {
          const ref = ponto.corpos[corpo.chave]!.posicao_ua;
          const erroUa = Math.hypot(
            estado.pos[3 * i]! - ref[0],
            estado.pos[3 * i + 1]! - ref[1],
            estado.pos[3 * i + 2]! - ref[2],
          );
          const relativo = erroUa / distanciaAoSolUa(estado, i);
          expect(
            relativo,
            `${corpo.nome}: ${(erroUa * UA_KM).toFixed(0)} km = ${(100 * relativo).toFixed(3)}%`,
          ).toBeLessThan(TOLERANCIA_RELATIVA);
        });
      }
    });
  }
});
