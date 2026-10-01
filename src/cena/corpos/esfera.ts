/**
 * A esfera que todo corpo desenha, com o polo no lugar certo.
 *
 * ## O defeito que esta linha conserta, e ele estava em toda parte
 *
 * `SphereGeometry` do three.js constrói os polos em **±Y**: a linha de cima da
 * textura (`uv.y = 1`) cai em `+Y`, e o meridiano `uv.x = 0,5` cai em `+X`.
 *
 * O resto do programa trata `+Z` como o polo, e com razão — é o que a
 * construção da IAU produz:
 *
 *     M = Rx(−eps) · Rz(alfa_0 + 90°) · Rx(90° − delta_0) · Rz(W)
 *
 * leva `+Z` ao polo norte e `+X` ao meridiano zero. E não é só a matriz:
 * `definirRaioDesenhado` achata o eixo **Z** pelo achatamento do corpo,
 * `poloDoCorpo` é `(0,0,1)` levado pela orientação, e os anéis usam
 * `RingGeometry`, que nasce no plano XY com normal `+Z`.
 *
 * Ou seja: a malha estava **noventa graus fora de tudo o mais**. Fotografado:
 * apontando a câmera pelo `+Z` da Terra aparecem a América do Sul e a África —
 * o equador —, e é pelo `+Y` que aparecem a calota do Ártico, a Groenlândia e a
 * Sibéria. O polo da textura estava desenhado sobre o equador do corpo.
 *
 * As consequências eram todas invisíveis por não haver com o que comparar: a
 * inclinação de cada planeta era desenhada em torno do eixo errado — inclusive
 * os 98° de Urano, que o projeto usa como cena dourada —, o achatamento
 * espremia o equador em vez dos polos, e o plano dos anéis não era o equador da
 * textura. Nenhum teste pegava, porque `orientacao.test.ts` mede a MATRIZ, que
 * sempre esteve certa, e as douradas foram gravadas já com o defeito dentro.
 *
 * `rotateX(+90°)` leva `+Y` a `+Z` e deixa `+X` onde estava: o polo vai para o
 * polo e o meridiano zero continua no meridiano zero.
 */
import { SphereGeometry } from 'three';

/** 96×48 aguenta preencher a tela sem facetar. */
export const ESFERA = new SphereGeometry(1, 96, 48).rotateX(Math.PI / 2);

/**
 * Onde um ponto da textura cai na esfera, em coordenadas locais do corpo.
 *
 * Existe para `esfera.test.ts` poder afirmar o que este arquivo promete sem
 * GPU, sem navegador e sem textura: procura o vértice de `uv` mais próximo do
 * pedido e devolve a posição dele.
 */
export function ondeCaiNaEsfera(u: number, v: number): [number, number, number] {
  const uvs = ESFERA.attributes['uv']!;
  const pos = ESFERA.attributes['position']!;
  let melhor = 0;
  let menor = Infinity;
  for (let i = 0; i < uvs.count; i++) {
    const d = (uvs.getX(i) - u) ** 2 + (uvs.getY(i) - v) ** 2;
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return [pos.getX(melhor), pos.getY(melhor), pos.getZ(melhor)];
}
