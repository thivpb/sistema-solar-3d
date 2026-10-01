/**
 * Mede a velocidade desta maquina para definir um teto honesto.
 *
 * Nao ha numero magico que sirva para todo computador. Em vez de chutar, o
 * programa roda a integracao por uma fracao de segundo e usa o resultado para
 * decidir quanto tempo simulado consegue entregar por segundo sem engasgar.
 *
 * Tres cuidados, cada um corrigindo um jeito conhecido de medir errado:
 *
 * 1. **Aquecer antes de cronometrar.** As primeiras centenas de passos medem o
 *    compilador de JavaScript se aquecendo, nao a maquina. Sem isso, um
 *    computador rapido se declara lento e corta a escada de velocidade em
 *    silencio.
 * 2. **Medir por TRABALHO fixo, nao por TEMPO fixo.** Um laco "rode ate passar
 *    0,12 s" da resultados diferentes conforme o sistema operacional resolve
 *    interromper; um laco "rode N passos e veja quanto demorou" nao tem essa
 *    variacao.
 * 3. **Nao presumir 60 Hz.** A tela do usuario pode ser 120 Hz, e o orcamento
 *    por quadro cai pela metade. A taxa de atualizacao e medida pelo laco de
 *    quadro (fase F2) e entra aqui como parametro.
 *
 * O cronometro e injetado, como no simulador: o nucleo nao le o relogio.
 */
import { aceleracao } from './forcas.ts';
import { PASSO_PADRAO_DIAS, type Integrador } from './integrador.ts';
import { copiarEstado } from './estado.ts';
import { criarRascunho, type EstadoSistema } from './tipos.ts';
import type { Cronometro } from './simulador.ts';

/** Fracao do quadro que a fisica pode ocupar. O resto e para desenhar. */
export const FRACAO_CPU = 0.25;

const PASSOS_DE_AQUECIMENTO = 2000;
const PASSOS_MEDIDOS = 4000;

export interface Medicao {
  passosPorSegundo: number;
  msPorPasso: number;
  passosMedidos: number;
}

/**
 * Roda o integrador num estado descartavel e mede passos por segundo.
 * Nao toca no estado recebido.
 */
export function medirPassosPorSegundo(
  estado: EstadoSistema,
  integrador: Integrador,
  cronometro: Cronometro,
  passosMedidos = PASSOS_MEDIDOS,
): Medicao {
  const copia = copiarEstado(estado);
  const rascunho = criarRascunho(copia.capacidade);
  const dt = PASSO_PADRAO_DIAS;

  // Aquecimento descartado. Tambem serve para o kernel de forcas entrar em
  // cache antes de o cronometro comecar.
  aceleracao(copia, rascunho);
  for (let k = 0; k < PASSOS_DE_AQUECIMENTO; k++) integrador.passo(copia, dt, rascunho);

  const t0 = cronometro();
  for (let k = 0; k < passosMedidos; k++) integrador.passo(copia, dt, rascunho);
  const decorrido = cronometro() - t0;

  // Um cronometro de resolucao grosseira pode devolver zero. Declarar
  // "infinitos passos por segundo" seria pior que declarar um piso.
  const ms = decorrido > 0 ? decorrido : Number.EPSILON;
  return {
    passosPorSegundo: (passosMedidos / ms) * 1000,
    msPorPasso: ms / passosMedidos,
    passosMedidos,
  };
}

/** Quantos passos cabem num quadro usando so a fracao reservada de CPU. */
export function passosMaxPorQuadro(passosPorSegundo: number, quadrosPorSegundo = 60): number {
  return Math.max(1, Math.trunc((passosPorSegundo * FRACAO_CPU) / quadrosPorSegundo));
}

/** Maior velocidade que esta maquina sustenta de verdade, em dias por segundo. */
export function tetoDiasPorSegundo(
  passosPorSegundo: number,
  dtDias = PASSO_PADRAO_DIAS,
  quadrosPorSegundo = 60,
): number {
  return passosMaxPorQuadro(passosPorSegundo, quadrosPorSegundo) * dtDias * quadrosPorSegundo;
}
