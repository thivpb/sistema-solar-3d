/**
 * De onde ate onde a camera enxerga, e em quantas fatias.
 *
 * O problema: entre o raio de um planeta visto de perto (1 km) e a orbita de
 * Netuno (30 UA = 4,5e9 km) ha nove ordens de grandeza. Um buffer de
 * profundidade de 24 bits com near = 1 km e far = 30 UA nao distingue nada: a
 * precisao de um z-buffer padrao concentra-se toda junto ao near.
 *
 * **A solucao aqui sao FATIAS DE PROFUNDIDADE**, e nao profundidade invertida
 * nem logaritmica. O motivo e pratico: o Three.js 0.186 nao expoe reverse-Z, e
 * `logarithmicDepthBuffer` e opcao do `WebGLRenderer` — o comportamento dela
 * no backend WebGL2 do `WebGPURenderer` nao pode ser presumido. Fatia nao
 * depende de nenhum parametro do renderizador: desenha-se a fatia mais
 * distante, limpa-se a profundidade, desenha-se a mais proxima por cima.
 *
 * O numero de fatias e parametro desde o primeiro dia. Se um dia houver
 * reverse-Z disponivel e ele bastar, `nFatias = 1` passa a ser o caminho e
 * nada mais muda.
 */
export interface Fatia {
  near: number;
  far: number;
}

/** Razao far/near dentro de uma fatia que um z-buffer de 24 bits aguenta com folga. */
export const RAZAO_MAXIMA_POR_FATIA = 1e5;

/** Piso absoluto do near, em UA. ~15 metros. */
export const NEAR_ABSOLUTO_UA = 1e-10;

/**
 * Fatias do mais distante para o mais proximo — que e a ordem de desenho.
 *
 * `distanciaMinima` e a distancia da camera a superficie mais proxima, e nao
 * ao centro do corpo: dentro de uma esfera nao ha o que desenhar.
 */
export function fatiasDeProfundidade(
  distanciaMinimaUa: number,
  distanciaMaximaUa: number,
  nFatias = 2,
): Fatia[] {
  const near = Math.max(NEAR_ABSOLUTO_UA, distanciaMinimaUa * 0.5);
  const far = Math.max(near * 10, distanciaMaximaUa * 1.5);

  const razaoTotal = far / near;
  // Se tudo cabe numa fatia so, nao ha por que pagar por duas.
  const necessarias = Math.max(1, Math.ceil(Math.log(razaoTotal) / Math.log(RAZAO_MAXIMA_POR_FATIA)));
  const quantas = Math.max(necessarias, Math.min(nFatias, 4));

  // Divisao GEOMETRICA: cada fatia cobre a mesma razao far/near, e portanto a
  // mesma precisao relativa. Divisao linear daria a fatia de perto uma faixa
  // inutilmente estreita e a de longe uma faixa impossivel.
  const passo = Math.pow(razaoTotal, 1 / quantas);
  const fatias: Fatia[] = [];
  for (let k = quantas; k > 0; k--) {
    fatias.push({ near: near * Math.pow(passo, k - 1), far: near * Math.pow(passo, k) });
  }
  return fatias;
}
