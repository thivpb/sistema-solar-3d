/**
 * O polo da textura cai no polo do corpo.
 *
 * ## O defeito que este arquivo existe para nunca mais deixar passar
 *
 * `SphereGeometry` do three.js constrói os polos em ±Y. Todo o resto do
 * programa trata +Z como polo: a construção da IAU leva +Z ao polo norte,
 * `definirRaioDesenhado` achata o eixo Z pelo achatamento do corpo,
 * `poloDoCorpo` é `(0,0,1)` levado pela orientação, e os anéis nascem no plano
 * XY. A malha estava **noventa graus fora de tudo o mais**.
 *
 * Fotografado antes do conserto: apontando a câmera pelo +Z da Terra apareciam
 * a América do Sul e a África — o equador —, e era pelo +Y que apareciam a
 * calota do Ártico e a Groenlândia.
 *
 * **Nenhum teste pegava**, e é instrutivo por quê: `orientacao.test.ts` mede a
 * MATRIZ, que sempre esteve certa, e as imagens douradas foram gravadas já com
 * o defeito dentro — elas travavam o erro em vez de acusá-lo. O que faltava era
 * exatamente isto: perguntar onde a TEXTURA cai na GEOMETRIA.
 */
import { describe, expect, it } from 'vitest';
import { ESFERA, ondeCaiNaEsfera } from '@cena/corpos/esfera.ts';

/** Quão perto dois vetores unitários apontam para o mesmo lado, em graus. */
function angulo(a: readonly number[], b: readonly number[]): number {
  const na = Math.hypot(a[0]!, a[1]!, a[2]!);
  const nb = Math.hypot(b[0]!, b[1]!, b[2]!);
  const cos = (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) / (na * nb);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * (180 / Math.PI);
}

describe('a esfera dos corpos', () => {
  it('põe o topo da textura no polo NORTE, que é +Z', () => {
    // `uv.y = 1` é a linha de cima da imagem. Num mapa equirretangular ela é o
    // polo norte — a calota do Ártico, no mapa da Terra.
    expect(angulo(ondeCaiNaEsfera(0.5, 1), [0, 0, 1])).toBeLessThan(2);
  });

  it('põe a base da textura no polo SUL', () => {
    expect(angulo(ondeCaiNaEsfera(0.5, 0), [0, 0, -1])).toBeLessThan(2);
  });

  it('põe o meridiano zero em +X, que é onde o Rz(W) da IAU o deixa', () => {
    // Nos mapas que o programa usa, a longitude 0 fica no MEIO da imagem:
    // `uv.x = 0,5`. A construção da IAU termina em `Rz(W)`, que leva o
    // meridiano zero ao eixo +X local. Os dois têm de coincidir, senão a
    // longitude desenhada fica girada e ninguém tem com o que comparar.
    const equador = ondeCaiNaEsfera(0.5, 0.5);
    expect(angulo(equador, [1, 0, 0])).toBeLessThan(3);
  });

  it('põe o meridiano 90° a LESTE em +Y, e não a oeste', () => {
    // O sentido. Sem esta, um mapa espelhado passaria nas três de cima.
    const leste = ondeCaiNaEsfera(0.75, 0.5);
    expect(angulo(leste, [0, 1, 0])).toBeLessThan(3);
  });

  it('continua sendo uma esfera de raio 1, com normais para fora', () => {
    // A guarda: `rotateX` mexe em posições E normais, e uma rotação aplicada
    // só às posições deixaria a iluminação errada sem mudar a silhueta.
    const pos = ESFERA.attributes['position']!;
    const nor = ESFERA.attributes['normal']!;
    let piorRaio = 0;
    let piorNormal = 0;
    for (let i = 0; i < pos.count; i += 7) {
      const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const n = [nor.getX(i), nor.getY(i), nor.getZ(i)];
      piorRaio = Math.max(piorRaio, Math.abs(Math.hypot(p[0]!, p[1]!, p[2]!) - 1));
      piorNormal = Math.max(piorNormal, angulo(p, n));
    }
    expect(piorRaio).toBeLessThan(1e-6);
    expect(piorNormal, 'as normais não acompanharam a rotação').toBeLessThan(0.5);
  });
});
