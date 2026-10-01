/**
 * Aceleracao gravitacional mutua entre todos os corpos.
 *
 * Todos puxam todos, inclusive o Sol — que por isso nao fica parado. E a lei
 * da gravitacao de Newton escrita para N corpos:
 *
 *     a_i = soma_{j != i}  GM_j * (r_j - r_i) / |r_j - r_i|^3
 *
 * O que este modulo NAO inclui, e que faz diferenca na vida real:
 *   - Relatividade geral. O efeito maior seria a precessao do perielio de
 *     Mercurio, 43 segundos de arco por seculo. No passo de meio dia que se
 *     usa aqui, essa correcao fica abaixo do erro do proprio integrador.
 *   - Corpos ausentes: a Lua entra somada a Terra (ver dados/carregar.ts),
 *     Plutao, asteroides e satelites em geral nao existem.
 *   - Achatamento dos corpos, pressao de radiacao, mares.
 *
 * **Por que o laco e simetrico.** A versao em Python montava a matriz (N,N,3)
 * inteira porque, em numpy, vetorizar compensa: o laco explicito custaria o
 * interpretador a cada par. Em JavaScript nao ha esse pedagio, entao vale usar
 * a terceira lei de Newton e visitar cada par uma vez so — metade das raizes
 * quadradas e metade das divisoes.
 *
 * **Por que os `!` nos indices.** `noUncheckedIndexedAccess` vale para
 * Float64Array tambem, e num laco numerico tratar cada leitura como
 * `number | undefined` so acrescentaria ruido. Aqui os indices sao
 * comprovadamente validos: vao de 0 a 3n-1 num buffer de 3*capacidade.
 */
import type { EstadoSistema, Rascunho } from './tipos.ts';

/**
 * Escreve em `rascunho.acel` a aceleracao de cada corpo, em UA/dia^2.
 * Nao aloca. Nao le nem escreve nada alem de `acel`.
 */
export function aceleracao(estado: EstadoSistema, rascunho: Rascunho): void {
  const { pos, gm, n } = estado;
  const a = rascunho.acel;

  a.fill(0, 0, 3 * n);

  for (let i = 0; i < n; i++) {
    const ix = 3 * i;
    const xi = pos[ix]!;
    const yi = pos[ix + 1]!;
    const zi = pos[ix + 2]!;
    const gmi = gm[i]!;

    for (let j = i + 1; j < n; j++) {
      const jx = 3 * j;
      const dx = pos[jx]! - xi;
      const dy = pos[jx + 1]! - yi;
      const dz = pos[jx + 2]! - zi;

      const r2 = dx * dx + dy * dy + dz * dz;
      // 1 / r^3, escrito como 1/(r^2 * r) para uma raiz so.
      const inv = 1 / (r2 * Math.sqrt(r2));

      // `a[k] = a[k]! + ...` em vez de `a[k] += ...`: com
      // noUncheckedIndexedAccess o lado esquerdo de um `+=` tambem e uma
      // leitura, e o compilador a trata como `number | undefined`.
      const fi = gm[j]! * inv; // quanto j puxa i
      a[ix] = a[ix]! + fi * dx;
      a[ix + 1] = a[ix + 1]! + fi * dy;
      a[ix + 2] = a[ix + 2]! + fi * dz;

      const fj = gmi * inv; // e, pela terceira lei, quanto i puxa j
      a[jx] = a[jx]! - fj * dx;
      a[jx + 1] = a[jx + 1]! - fj * dy;
      a[jx + 2] = a[jx + 2]! - fj * dz;
    }
  }
}
