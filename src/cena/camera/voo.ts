/**
 * Voo livre, feito movendo o PIVO — e nao trocando o modelo de camera.
 *
 * Esta e a peca que faz o modo imersivo caber no projeto sem abrir exceção
 * nenhuma. A camera e `(pivo, raio, azimute, elevacao)` e a posicao dela e
 * `pivo + raio·direcao(azimute, elevacao)`. Com o raio e os angulos fixos,
 * deslocar o pivo desloca o olho pelo MESMO vetor: voar e transladar o pivo.
 *
 * O que isso preserva, de graca:
 *   · a origem flutuante continua sendo `p_corpo − p_camera`, num ponto so;
 *   · as fatias de profundidade continuam dimensionadas pelo raio;
 *   · a escolha por clique continua lendo a mesma matriz;
 *   · trocar para ortografica no meio do voo continua preservando o zoom.
 * Uma camera de voo com posicao e orientacao proprias teria de duplicar os
 * quatro, e e assim que uma segunda camera vira uma segunda verdade.
 *
 * **A velocidade e proporcional ao raio.** Uma velocidade fixa em UA/s seria
 * inutil nas duas pontas: 1 UA/s atravessa o sistema em trinta segundos e leva
 * seis horas para cruzar um diametro de Marte. Ligando ao raio, aproximar e
 * desacelerar — o mesmo gesto serve para as duas coisas, e a tela escreve
 * quantos UA por segundo estao valendo.
 */
import { RAIO_MAXIMO_UA, type EstadoCamera } from './cameraOrbital.ts';

/**
 * Fracao do raio percorrida por segundo, com a tecla apertada.
 *
 * Medido, e nao escolhido: em 0,9 o quadro embola porque a cena inteira
 * atravessa a tela em pouco mais de um segundo; em 0,2 a travessia de Marte a
 * Jupiter, a 3 UA de raio, leva quase um minuto. 0,45 e o meio, e da uma
 * travessia de tela por segundo e meio — que e o tempo em que ainda se enxerga
 * o que passa.
 */
export const FRACAO_DO_RAIO_POR_SEGUNDO = 0.45;

/** Shift multiplica por isto. Quatro, e nao dez: dez faz perder o alvo de vista. */
export const FATOR_DO_TURBO = 4;

/**
 * Quanto o voo anda por segundo, em UA. E o que a tela escreve.
 *
 * Nao depende do dt: a intencao e "tantos UA por segundo", e o quadro apenas
 * pega a fracao dele que passou. Multiplicar pelo dt aqui dentro faria o numero
 * escrito na tela mudar com a taxa de quadros.
 */
export function velocidadeDeVooUaPorS(c: EstadoCamera, turbo: boolean): number {
  return c.raio * FRACAO_DO_RAIO_POR_SEGUNDO * (turbo ? FATOR_DO_TURBO : 1);
}

/** A base da camera: direita, cima e frente, os tres versores, na ordem. */
export function baseDaCamera(
  c: EstadoCamera,
): [[number, number, number], [number, number, number], [number, number, number]] {
  const cosAz = Math.cos(c.azimute);
  const senAz = Math.sin(c.azimute);
  const cosEl = Math.cos(c.elevacao);
  const senEl = Math.sin(c.elevacao);
  // Os mesmos vetores de `deslocar`, derivados dos mesmos angulos que a
  // posicao. A frente e a direcao de vista: aponta do olho PARA o pivo.
  return [
    [-senAz, cosAz, 0],
    [-senEl * cosAz, -senEl * senAz, cosEl],
    [-cosEl * cosAz, -cosEl * senAz, -senEl],
  ];
}

/**
 * Move o pivo na base da camera. Os tres deslocamentos vem em UA.
 *
 * O raio NAO muda, e e isso que separa voar de aproximar. Aproximar encolhe a
 * distancia ao alvo e deixa o alvo onde esta; voar leva o alvo junto. Sem essa
 * separacao, "andar para frente" acabaria colidindo com o limite de zoom e o
 * voo pararia numa parede invisivel a 0,15 km de um pivo qualquer.
 */
export function voar(
  c: EstadoCamera,
  frenteUa: number,
  direitaUa: number,
  cimaUa: number,
): void {
  if (frenteUa === 0 && direitaUa === 0 && cimaUa === 0) return;
  const [direita, cima, frente] = baseDaCamera(c);
  for (let k = 0; k < 3; k++) {
    c.pivo[k] =
      c.pivo[k]! + frente[k]! * frenteUa + direita[k]! * direitaUa + cima[k]! * cimaUa;
  }
  // Uma redoma, e nao um teto de velocidade: sem ela um dedo apoiado no W leva o
  // pivo para 10^4 UA em meio minuto, e de la nao se ve nada nem se sabe voltar.
  // O raio maximo da camera e o mesmo numero, e a razao e a mesma.
  const d = Math.hypot(c.pivo[0]!, c.pivo[1]!, c.pivo[2]!);
  if (d > RAIO_MAXIMO_UA) {
    const k = RAIO_MAXIMO_UA / d;
    c.pivo = [c.pivo[0]! * k, c.pivo[1]! * k, c.pivo[2]! * k];
  }
}
