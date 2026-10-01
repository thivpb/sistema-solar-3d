/**
 * Rastro deixado por cada corpo: por onde ele passou de verdade.
 *
 * A trilha e diferente da elipse osculadora. A elipse e "o caminho que ele
 * seguiria se so o Sol existisse"; a trilha e "o caminho que ele percorreu
 * nesta simulacao". Em escala humana as duas coincidem, e e bom que coincidam:
 * serve de conferencia visual.
 *
 * Amostrada por **tempo simulado**, nao por quadro. Amostrar por quadro seria
 * errado — a trilha mudaria de aparencia so por mudar a velocidade do tempo ou
 * a taxa de quadros, e passaria a dizer algo sobre o computador em vez de
 * dizer algo sobre a orbita.
 */

/** Buffer circular de posicoes passadas de um corpo. */
export class Trilha {
  readonly capacidade: number;
  readonly intervaloDias: number;

  private readonly buf: Float64Array;
  /** Onde `pontos()` monta a vista quando o anel ja deu a volta. Ver la. */
  private readonly saida: Float64Array;
  private quantos = 0;
  private proximo = 0;
  private tUltimo: number | null = null;

  constructor(capacidade = 400, intervaloDias = 1) {
    this.capacidade = Math.trunc(capacidade);
    this.intervaloDias = intervaloDias;
    this.buf = new Float64Array(3 * this.capacidade);
    this.saida = new Float64Array(3 * this.capacidade);
  }

  get tamanho(): number {
    return this.quantos;
  }

  limpar(): void {
    this.quantos = 0;
    this.proximo = 0;
    this.tUltimo = null;
  }

  /**
   * Guarda um ponto se ja passou tempo simulado suficiente.
   * O `Math.abs` deixa a trilha funcionar tambem com o tempo correndo para tras.
   */
  registrar(x: number, y: number, z: number, tDias: number): boolean {
    if (this.tUltimo !== null && Math.abs(tDias - this.tUltimo) < this.intervaloDias) return false;
    const k = 3 * this.proximo;
    this.buf[k] = x;
    this.buf[k + 1] = y;
    this.buf[k + 2] = z;
    this.proximo = (this.proximo + 1) % this.capacidade;
    this.quantos = Math.min(this.quantos + 1, this.capacidade);
    this.tUltimo = tDias;
    return true;
  }

  /**
   * Pontos do mais antigo para o mais recente, achatados em 3 numeros cada.
   *
   * **A vista devolvida e REUTILIZADA a cada chamada, e nao e para guardar.**
   * Esta funcao roda uma vez por corpo por quadro — nove corpos a 60 Hz — e
   * cada chamada alocava um `Float64Array` de 420 pontos, 10 KB. Somava cerca
   * de 540 arrays por segundo, 5,4 MB/s de lixo, so para ser copiado no buffer
   * da fita no quadro seguinte e descartado.
   *
   * Quem quiser um pedaco que sobreviva ao proximo quadro copia. O unico
   * consumidor de hoje — `linhas/fitas.ts` — le e copia no mesmo instante.
   */
  pontos(): Float64Array {
    const n = 3 * this.quantos;
    if (this.quantos < this.capacidade) return this.buf.subarray(0, n);
    const corte = 3 * this.proximo;
    this.saida.set(this.buf.subarray(corte), 0);
    this.saida.set(this.buf.subarray(0, corte), 3 * this.capacidade - corte);
    return this.saida;
  }
}

/**
 * Uma trilha por corpo, com o intervalo de amostragem ajustado a orbita.
 *
 * Netuno leva 165 anos para dar uma volta e Mercurio, 88 dias. Um intervalo
 * unico deixaria a trilha de Mercurio um borrao e a de Netuno um tracinho.
 * O intervalo e uma fracao do periodo de cada corpo.
 */
export class ConjuntoTrilhas {
  readonly trilhas: Trilha[];

  constructor(periodosDias: readonly (number | null)[], capacidade = 400, fracaoDaOrbita = 0.0025) {
    this.trilhas = periodosDias.map(
      (p) => new Trilha(capacidade, Math.max(0.25, (p ?? 365) * fracaoDaOrbita)),
    );
  }

  get tamanho(): number {
    return this.trilhas.length;
  }

  registrar(pos: Float64Array, tDias: number): void {
    for (let i = 0; i < this.trilhas.length; i++) {
      this.trilhas[i]!.registrar(pos[3 * i]!, pos[3 * i + 1]!, pos[3 * i + 2]!, tDias);
    }
  }

  limpar(): void {
    for (const t of this.trilhas) t.limpar();
  }

  pontos(i: number): Float64Array {
    return this.trilhas[i]?.pontos() ?? new Float64Array(0);
  }
}
