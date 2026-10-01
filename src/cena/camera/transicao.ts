/**
 * A transicao entre dois enquadramentos.
 *
 * **Interpola `log(raio)`, e nao o raio.** Ir de 30 UA a 0,4 UA interpolando
 * linearmente passa quase todo o tempo perto de 30 e depois desaba: parece um
 * corte, nao um movimento. Em escala logaritmica cada instante da transicao
 * cobre a mesma proporcao, e o olho le como aproximacao continua. A versao
 * anterior ja fazia assim, pelo mesmo motivo.
 *
 * **O prazo fixo continua existindo, e so aqui.** Amortecimento exponencial
 * nunca alcanca um alvo em movimento — e durante uma transicao o alvo se move.
 * Depois de `DURACAO_S` a camera assume o valor final, sem residuo. No resto do
 * tempo nao ha perseguicao nenhuma: o pivo E a posicao do corpo.
 */
import { ELEVACAO_MAXIMA, type EstadoCamera } from './cameraOrbital.ts';

export const DURACAO_S = 0.45;
const TAU_S = 0.16;

export interface Transicao {
  /** Para onde. O pivo e relido a cada quadro: o alvo se move. */
  raioAlvo: number;
  azimuteAlvo: number;
  elevacaoAlvo: number;
  decorridoS: number;
}

export function iniciarTransicao(
  raioAlvo: number,
  azimuteAlvo: number,
  elevacaoAlvo: number,
): Transicao {
  return { raioAlvo, azimuteAlvo, elevacaoAlvo, decorridoS: 0 };
}

/**
 * Avanca a transicao. Devolve `true` quando ela acabou.
 * `pivoAlvo` chega de fora e a cada quadro, porque o corpo alvo esta andando.
 */
export function avancarTransicao(
  c: EstadoCamera,
  t: Transicao,
  pivoAlvo: readonly [number, number, number],
  dtS: number,
): boolean {
  t.decorridoS += dtS;

  if (t.decorridoS >= DURACAO_S) {
    c.pivo = [pivoAlvo[0], pivoAlvo[1], pivoAlvo[2]];
    c.raio = t.raioAlvo;
    c.azimute = t.azimuteAlvo;
    c.elevacao = Math.min(ELEVACAO_MAXIMA, Math.max(-ELEVACAO_MAXIMA, t.elevacaoAlvo));
    return true;
  }

  const k = 1 - Math.exp(-dtS / TAU_S);
  c.raio = Math.exp(Math.log(c.raio) + (Math.log(t.raioAlvo) - Math.log(c.raio)) * k);
  // Pelo caminho curto: girar 350 graus para chegar onde 10 bastavam e feio.
  let dAz = t.azimuteAlvo - c.azimute;
  while (dAz > Math.PI) dAz -= 2 * Math.PI;
  while (dAz < -Math.PI) dAz += 2 * Math.PI;
  c.azimute += dAz * k;
  c.elevacao += (t.elevacaoAlvo - c.elevacao) * k;
  for (let i = 0; i < 3; i++) c.pivo[i] = c.pivo[i]! + (pivoAlvo[i]! - c.pivo[i]!) * k;
  return false;
}
