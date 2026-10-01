/**
 * Onde cada lua esta — por Kepler, e nao pelo integrador.
 *
 * **Por que elas ficam de fora da integracao.** A Lua da uma volta em 27,3
 * dias; com o passo de meio dia sao 55 passos por orbita, e Yoshida4 ali ja
 * precessa visivelmente. Io, em 1,77 dia, teria tres passos e meio: naquele
 * regime o integrador nao integra, ele inventa. Baixar o passo global para
 * atender a Io custaria o desempenho de tudo o mais e, pior, mudaria a camada
 * dinamica que esta validada contra o JPL em cem anos para frente e para tras.
 *
 * **O preco, que vai declarado.** A posicao das luas vem de elementos medios
 * com taxas seculares, e erra. O erro foi MEDIDO numa janela que o gerador dos
 * dados nunca olhou — 2020 a 2040 — e vai publicado corpo a corpo: de 456 km
 * em Deimos a 52.636 km em Tritao. Ele nao cresce: e um desvio limitado, feito
 * dos termos periodicos que um modelo de duas massas nao tem.
 *
 * **As luas nao puxam nada.** Elas sao cinematicas: leem o tempo e devolvem
 * uma posicao. Nao entram em `forcas.ts`, nao alteram o estado, e por isso
 * inserir a decima quarta nao muda um bit da trajetoria dos nove primeiros.
 */
import type { BaseDoPlano, ElementosDeLua } from '../contratos/lua.ts';
import { resolverKepler } from './kepler.ts';
import { doPlanoParaEcliptica } from './planoDeReferencia.ts';
import { UA_KM } from './unidades.ts';

const GRAU = Math.PI / 180;

/**
 * Posicao da lua em UA, RELATIVA ao centro do planeta, na ecliptica J2000.
 *
 * `dias` conta a partir da epoca dos elementos — J2000,0, e nao a epoca do
 * programa. Sao efemerides diferentes com epocas diferentes, e converter aqui,
 * num lugar so, e mais barato que lembrar da conversao em cada chamada.
 *
 * Escreve em `saida` em vez de alocar: esta funcao roda treze vezes por quadro.
 */
export function posicaoDaLua(
  el: ElementosDeLua,
  base: BaseDoPlano,
  dias: number,
  saida: [number, number, number],
): void {
  const M = (el.anomaliaMediaGraus + el.taxaDaAnomaliaMediaGrausDia * dias) * GRAU;
  const no = (el.noGraus + el.taxaDoNoGrausDia * dias) * GRAU;
  const w = (el.periastroGraus + el.taxaDoPeriastroGrausDia * dias) * GRAU;
  const i = el.inclinacaoGraus * GRAU;
  const e = el.excentricidade;

  const E = resolverKepler(M, e);
  const aUa = el.aKm / UA_KM;
  const xP = aUa * (Math.cos(E) - e);
  const yP = aUa * Math.sqrt(1 - e * e) * Math.sin(E);

  const cO = Math.cos(no);
  const sO = Math.sin(no);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  const cw = Math.cos(w);
  const sw = Math.sin(w);

  // Rz(no)·Rx(i)·Rz(periastro), escrita aberta — so as duas colunas que o
  // plano orbital usa.
  const noPlano: [number, number, number] = [
    (cO * cw - sO * sw * ci) * xP + (-cO * sw - sO * cw * ci) * yP,
    (sO * cw + cO * sw * ci) * xP + (-sO * sw + cO * cw * ci) * yP,
    sw * si * xP + cw * si * yP,
  ];

  const ecl = doPlanoParaEcliptica(base, noPlano);
  saida[0] = ecl[0];
  saida[1] = ecl[1];
  saida[2] = ecl[2];
}

/**
 * O deslocamento do CENTRO da Terra em relacao ao baricentro Terra-Lua.
 *
 *     r_Terra = −r_TerraLua / (1 + EMRAT)
 *
 * O corpo `terra` que o integrador move e o baricentro do par — e isso que a
 * efemeride do JPL mede e o que mantem a validacao de cem anos valendo. O
 * planeta desenhado fica a uns 4.671 km dele, do lado oposto ao da Lua, e e
 * esse deslocamento que faz a Terra bambolear no ritmo do mes.
 *
 * Nao e detalhe decorativo: sem ele, a Lua orbitaria um ponto que nao e o
 * centro do planeta, e a sombra dela cairia no lugar errado.
 */
export function deslocamentoDoCentroDaTerra(
  posicaoDaLuaUa: readonly [number, number, number],
  emrat: number,
  saida: [number, number, number],
): void {
  const f = -1 / (1 + emrat);
  saida[0] = posicaoDaLuaUa[0] * f;
  saida[1] = posicaoDaLuaUa[1] * f;
  saida[2] = posicaoDaLuaUa[2] * f;
}
