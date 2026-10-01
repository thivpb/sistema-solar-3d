/** Montagem comum dos testes de nucleo. Nao e um teste: nao tem `.test.` no nome. */
import { carregar } from '@dados/carregar.ts';
import { criarRascunho, type EstadoSistema, type Rascunho } from '@nucleo/tipos.ts';

export const { corpos: CORPOS, validacao: VALIDACAO, procedencia: PROCEDENCIA } = carregar();
export const NOMES = CORPOS.map((c) => c.nome);
export const ANO_DIAS = 365.25;

/** Um estado novo em folha, mais o rascunho do integrador. */
export function novo(): { estado: EstadoSistema; rascunho: Rascunho } {
  const { estado } = carregar();
  return { estado, rascunho: criarRascunho(estado.capacidade) };
}

export const norma = (v: readonly number[]): number => Math.hypot(...v);

export function distancia(a: Float64Array, i: number, b: readonly number[]): number {
  return Math.hypot(a[3 * i]! - b[0]!, a[3 * i + 1]! - b[1]!, a[3 * i + 2]! - b[2]!);
}
