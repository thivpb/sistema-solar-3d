/**
 * Ir 20 anos e voltar devolve o estado inicial.
 *
 * E o teste mais valioso do projeto, e o mais barato. Ele nao compara com
 * fonte externa nenhuma: e uma propriedade pura da aritmetica IEEE-754 com um
 * integrador simpletico, entao reproduz em qualquer maquina, e falha na hora
 * se alguem trocar a ordem das operacoes, errar um sinal ou introduzir um
 * termo dissipativo por engano.
 */
import { describe, expect, it } from 'vitest';
import { avancar, yoshida4 } from '@nucleo/integrador.ts';
import { UA_KM } from '@nucleo/unidades.ts';
import { ANO_DIAS, NOMES, novo } from './ajuda.ts';

describe('reversibilidade no tempo', () => {
  const { estado, rascunho } = novo();
  const { estado: inicial } = novo();
  const passos = Math.trunc(20 * ANO_DIAS * 2);

  avancar(estado, yoshida4, 0.5, passos, rascunho);
  avancar(estado, yoshida4, -0.5, passos, rascunho);

  it('o erro maximo de posicao ao voltar fica abaixo de 1 km', () => {
    let pior = 0;
    let quem = '';
    for (let i = 0; i < estado.n; i++) {
      const d =
        Math.hypot(
          estado.pos[3 * i]! - inicial.pos[3 * i]!,
          estado.pos[3 * i + 1]! - inicial.pos[3 * i + 1]!,
          estado.pos[3 * i + 2]! - inicial.pos[3 * i + 2]!,
        ) * UA_KM;
      if (d > pior) {
        pior = d;
        quem = NOMES[i]!;
      }
    }
    expect(pior, `pior: ${quem} com ${pior.toExponential(2)} km`).toBeLessThan(1);
  });

  it('o relogio volta a zero EXATO, nao quase', () => {
    // 0,5 e exato em binario, entao somar e subtrair a mesma quantidade de
    // meios-dias tem de devolver zero sem residuo. O teste em Python aceitava
    // 1e-9; aqui da para exigir o valor exato.
    expect(estado.tDias).toBe(0);
  });
});
