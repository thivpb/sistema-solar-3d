/**
 * O UNICO lugar onde uma posicao em UA vira coordenada de cena.
 *
 * **O problema, em numeros.** O ULP relativo do float32 e 5,96e-8. Isso, por
 * si, nao e fatal: Netuno a 30,1 UA quantiza a 286 km, que a 4,5e9 km de
 * distancia da 1,4e-4 pixel — invisivel. O caso fatal e outro: a SUBTRACAO de
 * dois numeros grandes e proximos. Se a camera esta a 30 UA da origem olhando
 * um corpo a 30 UA, `p_camera - p_corpo` em float32 perde quase todos os
 * digitos significativos, e a cena treme.
 *
 * **A solucao.** A camera fica em (0,0,0) com a rotacao de verdade, e a
 * subtracao acontece aqui, em Float64, na CPU. A coluna de translacao da
 * matriz de vista e zero por construcao. `THREE.Matrix4.elements` e um array
 * de numeros JavaScript, ou seja Float64, entao a composicao das matrizes
 * tambem acontece em dupla precisao; so o envio para a GPU e float32, e ai ja
 * nao ha mais subtracao de numeros grandes a fazer.
 *
 * **O que NAO fazer**, e que a proposta original fazia: publicar um buffer de
 * posicoes em Float32 ja pronto para render. Isso quantiza a 269 km a 30 UA e
 * a 13 km a 1,5 UA. Fobos tem 11 km de diametro — ele ficaria menor que o
 * quantum de posicao do proprio pai.
 */
import type { Object3D } from 'three';

/**
 * Escreve em cada objeto a posicao relativa a camera.
 * `posUa` tem 3 numeros por corpo, em UA absolutas.
 */
export function aplicarOrigem(
  posUa: Float64Array,
  camUa: readonly [number, number, number],
  objetos: readonly Object3D[],
): void {
  for (let i = 0; i < objetos.length; i++) {
    const k = 3 * i;
    objetos[i]!.position.set(posUa[k]! - camUa[0], posUa[k + 1]! - camUa[1], posUa[k + 2]! - camUa[2]);
  }
}

/** A distancia da camera ao centro de cada corpo, em UA. Alimenta as fatias de profundidade. */
export function distancias(
  posUa: Float64Array,
  n: number,
  camUa: readonly [number, number, number],
  saida: Float64Array,
): void {
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    saida[i] = Math.hypot(posUa[k]! - camUa[0], posUa[k + 1]! - camUa[1], posUa[k + 2]! - camUa[2]);
  }
}
