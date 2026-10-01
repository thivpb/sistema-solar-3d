/**
 * O estado fisico do sistema: quem esta onde, com que velocidade, em que instante.
 *
 * Tres escolhas que valem explicacao:
 *
 * 1. **Sempre 3D.** Mesmo quando a tela mostrava uma projecao do plano da
 *    ecliptica, o estado guardado era (x,y,z). A regra herdada e literal:
 *    "src/fisica guarda (N,3) e NUNCA reduz para duas dimensoes". E por isso
 *    que trocar o renderizador nao exige tocar em nada daqui.
 *
 * 2. **Estrutura de arrays, nao array de estruturas.** `pos` e um unico
 *    Float64Array com 3N numeros, nao N objetos com x/y/z. O laco de forcas
 *    percorre memoria contigua e nao aloca nada por passo.
 *
 * 3. **Capacidade separada de N.** O sandbox insere e remove corpos. Realocar
 *    os tres buffers a cada insercao seria lixo por quadro; entao ha folga
 *    reservada, e `n` diz quantos corpos estao de fato em uso.
 *
 * O objeto e deliberadamente simples, sem prototipo e sem metodo: assim ele
 * atravessa um `postMessage` inteiro se um dia a simulacao mudar de thread.
 */
export interface EstadoSistema {
  /** (3 * capacidade) UA. O corpo i ocupa [3i, 3i+1, 3i+2]. */
  pos: Float64Array;
  /** (3 * capacidade) UA/dia */
  vel: Float64Array;
  /** (capacidade) UA^3/dia^2 */
  gm: Float64Array;
  /** Quantos corpos estao em uso. Sempre <= capacidade. */
  n: number;
  capacidade: number;
  /**
   * Dias TDB desde a epoca. Vale a igualdade `tDias === passos * dt` em
   * binario exato, porque 0,5 e 0,125 sao exatos em base 2 — e e isso que
   * permite a data escrita na tela corresponder ao estado, sem "quase".
   */
  tDias: number;
}

/**
 * Buffers de trabalho do integrador. Vivem fora do estado para que um passo
 * nao aloque memoria: alocar por passo, a milhares de passos por segundo,
 * poe o coletor de lixo no caminho critico do quadro.
 */
export interface Rascunho {
  acel: Float64Array;
  capacidade: number;
}

export function criarRascunho(capacidade: number): Rascunho {
  return { acel: new Float64Array(3 * capacidade), capacidade };
}

/** Garante que o rascunho comporta `capacidade` corpos, crescendo se preciso. */
export function ajustarRascunho(rascunho: Rascunho, capacidade: number): Rascunho {
  if (rascunho.capacidade >= capacidade) return rascunho;
  return criarRascunho(capacidade);
}
