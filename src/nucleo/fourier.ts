/**
 * A orbita decomposta em serie de Fourier — e a cadeia de epiciclos que ela e.
 *
 * Vem do TCC "Copernico estava certo? Uma analise de epiciclos e series de
 * Fourier" (UnB Planaltina, 2016), e a tese cabe numa frase: a serie de
 * Fourier de uma orbita fechada E uma cadeia de epiciclos. Cada termo e um
 * circulo de raio |c_n| girando a n vezes a frequencia da volta. Acrescentar
 * um harmonico e, literalmente, acrescentar um epiciclo.
 *
 * ## O que mudou em relacao a versao anterior
 *
 * A versao em Python decompunha **x e y separadamente**, em cossenos e senos
 * reais. Aquilo reconstroi a curva corretamente e **nao produz epiciclo
 * nenhum**: um termo `ax_n·cos + bx_n·sen` em x junto com outro em y e uma
 * elipse alinhada aos eixos, nao um circulo girando. Para a cadeia historica e
 * preciso a serie COMPLEXA de `z(t) = x(t) + i·y(t)`, com n percorrendo os
 * inteiros negativos tambem. So ai cada termo `c_n·e^(i·2πnt)` e um ponteiro
 * de comprimento fixo girando a velocidade constante — que e o que Ptolomeu
 * desenhava.
 *
 * As duas descricoes carregam a mesma informacao; a complexa e a que tem a
 * forma da tese. Daí ser esta a que foi portada.
 *
 * ## Amostragem
 *
 * A curva entra amostrada IGUALMENTE ESPACADA NO TEMPO, e nao em angulo. Nao e
 * detalhe: sao duas funcoes diferentes, com coeficientes diferentes. A
 * parametrizacao em tempo e a que tem significado fisico — e a que faz a
 * segunda lei de Kepler aparecer no espacamento dos pontos — e e a unica em
 * que "girar a velocidade constante" descreve o que o epiciclo faz.
 *
 * ## Aliasing
 *
 * Com `A` amostras, so os coeficientes com |n| < A/2 sao recuperaveis; acima
 * disso, o que se calcula e um harmonico alto disfarcado de baixo. O construtor
 * RECUSA a combinacao em vez de devolver numero errado.
 *
 * **Mas o indice nao e a garantia inteira, e vale dizer onde ela acaba.** A
 * folga de Nyquist protege contra o aliasing de indice; o que protege contra o
 * aliasing de fato e o espectro da elipse morrer antes de A/2, e ele morre
 * tanto mais devagar quanto mais alongada a orbita. Medido com 720 amostras e
 * 24 harmonicos, o erro de coeficiente contra a solucao fechada e de 3e-16 UA
 * em e = 0,6, 1,4e-14 em e = 0,9 e **2,2e-8 em e = 0,95**. Para as orbitas dos
 * oito planetas — a maior excentricidade e 0,21, em Mercurio — a folga e de
 * varias ordens de grandeza. Para um cometa criado no sandbox, com e acima de
 * 0,9, ela nao e; ali a serie descreve a orbita com erro visivel, e o numero
 * que o laboratorio escreve na tela e o desvio medido, nao um limite prometido.
 */

/** Ate onde a serie e calculada. Alem disso a orbita ja esta no ruido do float64. */
export const TERMOS_MAX = 24;
export const TERMOS_INICIAL = 3;
/** Abaixo disto o residuo e ruido de arredondamento, e nao erro da serie. */
export const PISO_RESIDUO_UA = 1e-12;

const DOIS_PI = 2 * Math.PI;

/**
 * Os coeficientes complexos, com `n` de −N a +N.
 *
 * Guardados em dois arrays de tamanho `2N+1`, indexados por `n + N`: um objeto
 * por harmonico seria 49 alocacoes redesenhadas a cada quadro do laboratorio.
 */
export interface SerieFourier {
  termosMax: number;
  /** Parte real de c_n, em `re[n + termosMax]`. */
  re: Float64Array;
  im: Float64Array;
  /** Quantas amostras entraram. */
  amostras: number;
}

/** Projeta pontos 3D num plano dado por dois vetores ortonormais. */
export function projetarNoPlano(
  pontos: Float64Array,
  p: readonly [number, number, number],
  q: readonly [number, number, number],
): Float64Array {
  const n = pontos.length / 3;
  const saida = new Float64Array(2 * n);
  for (let k = 0; k < n; k++) {
    const x = pontos[3 * k]!;
    const y = pontos[3 * k + 1]!;
    const z = pontos[3 * k + 2]!;
    saida[2 * k] = x * p[0] + y * p[1] + z * p[2];
    saida[2 * k + 1] = x * q[0] + y * q[1] + z * q[2];
  }
  return saida;
}

/**
 * Calcula os coeficientes uma vez. Mostrar mais ou menos harmonicos depois e
 * so truncar a soma — o controle na tela nao recalcula nada.
 */
export function decompor(curva: Float64Array, termosMax = TERMOS_MAX): SerieFourier {
  const amostras = curva.length / 2;
  if (!Number.isInteger(amostras) || amostras < 4) {
    throw new RangeError('a curva precisa de pelo menos 4 pontos, com 2 numeros cada');
  }
  if (2 * termosMax >= amostras) {
    // Recusar, e nao truncar em silencio: um coeficiente sobre a frequencia de
    // Nyquist nao e um coeficiente pequeno, e um harmonico alto lido como
    // baixo — e ele apareceria no desenho como um epiciclo que nao existe.
    throw new RangeError(
      `${amostras} amostras nao bastam para ${termosMax} harmonicos: seriam precisas mais de ${2 * termosMax}`,
    );
  }

  const largura = 2 * termosMax + 1;
  const re = new Float64Array(largura);
  const im = new Float64Array(largura);

  for (let n = -termosMax; n <= termosMax; n++) {
    let somaRe = 0;
    let somaIm = 0;
    for (let k = 0; k < amostras; k++) {
      const x = curva[2 * k]!;
      const y = curva[2 * k + 1]!;
      const fase = (-DOIS_PI * n * k) / amostras;
      const c = Math.cos(fase);
      const s = Math.sin(fase);
      // (x + iy)(c + is)
      somaRe += x * c - y * s;
      somaIm += x * s + y * c;
    }
    re[n + termosMax] = somaRe / amostras;
    im[n + termosMax] = somaIm / amostras;
  }

  return { termosMax, re, im, amostras };
}

/** Soma da serie truncada em |n| <= termos. */
export function reconstruir(s: SerieFourier, t: number, termos: number): [number, number] {
  const T = Math.min(Math.max(0, Math.trunc(termos)), s.termosMax);
  let x = 0;
  let y = 0;
  for (let n = -T; n <= T; n++) {
    const i = n + s.termosMax;
    const fase = DOIS_PI * n * t;
    const c = Math.cos(fase);
    const sn = Math.sin(fase);
    x += s.re[i]! * c - s.im[i]! * sn;
    y += s.re[i]! * sn + s.im[i]! * c;
  }
  return [x, y];
}

/** Um elo da cadeia: o circulo que aquele harmonico desenha. */
export interface Epiciclo {
  /** O harmonico. Nunca zero: o termo constante nao gira, e sai em `excentrico`. */
  n: number;
  /** Centro do circulo — a ponta do elo anterior. */
  centro: [number, number];
  raio: number;
  /** A ponta deste elo, que e o centro do proximo. */
  ponta: [number, number];
}

export interface Cadeia {
  /**
   * O deslocamento fixo de onde a cadeia parte.
   *
   * E o termo `n = 0`, e ele **nao e um epiciclo**: a frequencia dele e zero,
   * entao ele nao gira — e um ponto deslocado, nao um circulo. Desenha-lo como
   * mais um circulo da cadeia seria mostrar um movimento que nao existe.
   *
   * O valor e a POSICAO MEDIA NO TEMPO do corpo, e para uma elipse kepleriana
   * ela fica a `1,5·a·e` do foco, do lado do apoastro — e nao a `a·e`, que e
   * onde esta o centro geometrico. A diferenca e a segunda lei: o corpo passa
   * mais tempo longe, e a media no tempo puxa para la. Ptolomeu deslocava a
   * Terra do centro do deferente; este e o mesmo deslocamento, medido do jeito
   * que a serie o produz.
   */
  excentrico: [number, number];
  /** Os elos que giram, do maior para o menor. O primeiro e o deferente. */
  elos: Epiciclo[];
  /** A ponta do ultimo elo: a posicao reconstruida. */
  ponta: [number, number];
}

/**
 * A cadeia de epiciclos no instante `t`.
 *
 * A ordem e por RAIO decrescente, que e a ordem em que a construcao historica
 * se le: o deferente primeiro, e cada epiciclo montado sobre a ponta do
 * anterior. Para uma orbita kepleriana o maior elo e sempre `n = 1` — medido
 * ate e = 0,9, onde ele vale 0,55 contra 0,19 do segundo.
 *
 * A ponta do ultimo elo E a posicao reconstruida: a cadeia e o desenho da
 * soma, elo por elo, e nao uma ilustracao ao lado dela. `fourier.test.ts`
 * exige que as duas coincidam dentro de 1e-14, porque e essa coincidencia, e
 * nao a semelhanca, que e a tese.
 */
export function cadeiaDeEpiciclos(s: SerieFourier, t: number, termos: number): Cadeia {
  const T = Math.min(Math.max(0, Math.trunc(termos)), s.termosMax);
  const elos: { n: number; raio: number }[] = [];
  for (let n = -T; n <= T; n++) {
    if (n === 0) continue;
    const i = n + s.termosMax;
    elos.push({ n, raio: Math.hypot(s.re[i]!, s.im[i]!) });
  }
  elos.sort((a, b) => b.raio - a.raio || a.n - b.n);

  const excentrico: [number, number] = [s.re[s.termosMax]!, s.im[s.termosMax]!];
  let cx = excentrico[0];
  let cy = excentrico[1];
  const cadeia: Epiciclo[] = [];
  for (const elo of elos) {
    const i = elo.n + s.termosMax;
    const fase = DOIS_PI * elo.n * t;
    const c = Math.cos(fase);
    const sn = Math.sin(fase);
    const px = cx + (s.re[i]! * c - s.im[i]! * sn);
    const py = cy + (s.re[i]! * sn + s.im[i]! * c);
    cadeia.push({ n: elo.n, centro: [cx, cy], raio: elo.raio, ponta: [px, py] });
    cx = px;
    cy = py;
  }
  return { excentrico, elos: cadeia, ponta: [cx, cy] };
}

export interface Desvio {
  medioUa: number;
  maximoUa: number;
}

/** Desvio ponto a ponto entre a serie truncada e a curva de onde ela saiu. */
export function desvio(s: SerieFourier, curva: Float64Array, termos: number): Desvio {
  const n = curva.length / 2;
  let soma = 0;
  let maximo = 0;
  for (let k = 0; k < n; k++) {
    const [x, y] = reconstruir(s, k / n, termos);
    const d = Math.hypot(curva[2 * k]! - x, curva[2 * k + 1]! - y);
    soma += d;
    maximo = Math.max(maximo, d);
  }
  return { medioUa: soma / n, maximoUa: maximo };
}

/** O desvio para cada quantidade de harmonicos, de 1 ate `termosMax`. */
export function convergencia(s: SerieFourier, curva: Float64Array): Desvio[] {
  const saida: Desvio[] = [];
  for (let t = 1; t <= s.termosMax; t++) saida.push(desvio(s, curva, t));
  return saida;
}

/** Quantos harmonicos bastam para o desvio sumir no ruido do float64. */
export function harmonicosAteOPiso(
  s: SerieFourier,
  curva: Float64Array,
  piso = PISO_RESIDUO_UA,
): number | null {
  const c = convergencia(s, curva);
  const i = c.findIndex((d) => d.medioUa <= piso);
  return i < 0 ? null : i + 1;
}
