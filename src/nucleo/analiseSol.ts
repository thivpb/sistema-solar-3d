/**
 * Grandezas do Sol relativas ao centro de massa dos corpos simulados.
 *
 * O Sol nao tem elementos keplerianos heliocentricos — ele E o centro da
 * referencia heliocentrica. O movimento dele neste modelo vem inteiro da soma
 * das atracoes dos oito sistemas planetarios, e a tela mostra essa soma
 * parcela por parcela, ordenada. Jupiter domina.
 */
import { centroDeMassa, gmTotal, momentoLinear } from './estado.ts';
import type { EstadoSistema } from './tipos.ts';

export interface AnaliseSol {
  /** Posicao do Sol em relacao ao centro de massa, UA. */
  posicaoRelativaUa: [number, number, number];
  /** Velocidade do Sol em relacao ao centro de massa, UA/dia. */
  velocidadeRelativaUaD: [number, number, number];
  /** Aceleracao resultante sobre o Sol, UA/dia^2. */
  aceleracaoUaD2: [number, number, number];
  /** Quanto cada corpo puxa o Sol, na mesma ordem do estado (sem o proprio Sol). */
  parcelas: { indice: number; aceleracao: [number, number, number]; modulo: number }[];
}

export function analisarSol(e: EstadoSistema, iSol = 0): AnaliseSol {
  const centro = centroDeMassa(e);
  const p = momentoLinear(e);
  const total = gmTotal(e);
  const velCm: [number, number, number] = [p[0] / total, p[1] / total, p[2] / total];

  const s = 3 * iSol;
  let ax = 0;
  let ay = 0;
  let az = 0;
  const parcelas: AnaliseSol['parcelas'] = [];

  for (let i = 0; i < e.n; i++) {
    if (i === iSol) continue;
    const k = 3 * i;
    const dx = e.pos[k]! - e.pos[s]!;
    const dy = e.pos[k + 1]! - e.pos[s + 1]!;
    const dz = e.pos[k + 2]! - e.pos[s + 2]!;
    const d = Math.hypot(dx, dy, dz);
    const f = e.gm[i]! / (d * d * d);
    const parcela: [number, number, number] = [f * dx, f * dy, f * dz];
    ax += parcela[0];
    ay += parcela[1];
    az += parcela[2];
    parcelas.push({ indice: i, aceleracao: parcela, modulo: Math.hypot(...parcela) });
  }

  return {
    posicaoRelativaUa: [e.pos[s]! - centro[0], e.pos[s + 1]! - centro[1], e.pos[s + 2]! - centro[2]],
    velocidadeRelativaUaD: [e.vel[s]! - velCm[0], e.vel[s + 1]! - velCm[1], e.vel[s + 2]! - velCm[2]],
    aceleracaoUaD2: [ax, ay, az],
    parcelas,
  };
}
