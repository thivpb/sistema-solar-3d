/**
 * Interpolacao entre dois passos integrados, para o desenho ficar liso.
 *
 * A fisica anda em passos fixos de meio dia; a tela desenha a 60 ou 120 Hz. Sem
 * interpolacao, num zoom proximo os planetas andam aos trancos.
 *
 * **Hermite cubico com lookahead de um passo, e nao Taylor de 2a ordem.**
 * A diferenca importa. Taylor extrapola a partir do estado atual usando
 * posicao, velocidade e aceleracao; medido a partir da propria efemeride da
 * epoca, o termo de 3a ordem em meio passo vale 213 km em Mercurio, 48 km em
 * Venus e 17 km na Terra. Mercurio tem 4.879 km de diametro: sao 4,4% do
 * disco. E como a extrapolacao nao encontra o proximo estado integrado, isso
 * vira um SALTO na fronteira de cada passo — dois por segundo a 1 dia/s.
 *
 * O Hermite usa posicao E velocidade nas DUAS pontas, entao e continuo em
 * posicao e em velocidade na fronteira: nao ha tranco nenhum.
 *
 * **Lookahead nao e atraso.** O simulador mantem o estado integrado atual e o
 * proximo; o desenho mostra um ponto entre eles. `tDias` do estado continua
 * exato, e a data ESCRITA na tela passa a ser `tDias + alfa*dt`, que e
 * exatamente o instante desenhado. A data corresponde ao desenho — que e a
 * garantia que o projeto faz desde a primeira versao.
 */
import type { EstadoSistema } from './tipos.ts';

/**
 * Escreve em `saida` a posicao interpolada entre `a` (alfa=0) e `b` (alfa=1).
 *
 * `dtDias` e o intervalo entre os dois estados — pode ser negativo, e o sinal
 * importa, porque a velocidade entra multiplicada por ele.
 */
export function interpolarHermite(
  a: EstadoSistema,
  b: EstadoSistema,
  dtDias: number,
  alfa: number,
  saida: Float64Array,
): void {
  const t = alfa < 0 ? 0 : alfa > 1 ? 1 : alfa;

  // Base de Hermite. h00 + h01 = 1 sempre, entao alfa = 0 devolve `a` e
  // alfa = 1 devolve `b`, ambos EXATOS — pausado, o que se ve e o estado
  // integrado, sem interpolacao no meio.
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const m = 3 * Math.min(a.n, b.n);
  for (let k = 0; k < m; k++) {
    saida[k] = h00 * a.pos[k]! + h10 * dtDias * a.vel[k]! + h01 * b.pos[k]! + h11 * dtDias * b.vel[k]!;
  }
}

/** O instante que o quadro interpolado representa, em dias desde a epoca. */
export function instanteInterpolado(a: EstadoSistema, dtDias: number, alfa: number): number {
  return a.tDias + alfa * dtDias;
}
