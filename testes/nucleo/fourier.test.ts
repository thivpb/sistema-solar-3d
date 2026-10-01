/**
 * A serie de Fourier da orbita, e a cadeia de epiciclos.
 *
 * O teste que sustenta a tese inteira e o ultimo deste arquivo: a ponta da
 * cadeia de epiciclos tem de cair EXATAMENTE sobre a soma da serie. Se cair
 * perto, a cadeia desenhada e uma ilustracao bonita ao lado da matematica — e
 * nao a matematica. Essa diferenca e a coisa que o laboratorio existe para
 * mostrar.
 */
import { describe, expect, it } from 'vitest';
import {
  TERMOS_MAX,
  cadeiaDeEpiciclos,
  convergencia,
  decompor,
  desvio,
  harmonicosAteOPiso,
  projetarNoPlano,
  reconstruir,
} from '@nucleo/fourier.ts';
import { amostrarNoTempo, type ElementosClassicos } from '@nucleo/kepler.ts';

const GM_SOL = 2.9591220828411951e-4;
const DOIS_PI = 2 * Math.PI;
const AMOSTRAS = 720;

function elipse(e: number): ElementosClassicos {
  return {
    aUa: 1,
    e,
    iRad: 0,
    nodoRad: 0,
    periastroRad: 0,
    anomaliaMediaRad: 0,
    movimentoMedioRadDia: DOIS_PI / 365.25,
    taxaDoNodoRadDia: 0,
    taxaDoPeriastroRadDia: 0,
  };
}

/** A mesma curva num semieixo maior. Para conferir tolerancias em escala. */
function escalar(curva: Float64Array, fator: number): Float64Array {
  const saida = new Float64Array(curva.length);
  for (let i = 0; i < curva.length; i++) saida[i] = curva[i]! * fator;
  return saida;
}

/** A orbita no proprio plano, em 2D, amostrada igualmente espacada no tempo. */
function curvaDe(e: number, amostras = AMOSTRAS): Float64Array {
  return projetarNoPlano(amostrarNoTempo(elipse(e), GM_SOL, amostras), [1, 0, 0], [0, 1, 0]);
}

describe('decomposicao', () => {
  it('recusa mais harmonicos do que a amostragem sustenta', () => {
    // Acima de Nyquist o coeficiente calculado nao e pequeno: e um harmonico
    // alto lido como baixo, e ele viraria um epiciclo que nao existe.
    expect(() => decompor(curvaDe(0.2, 40), 20)).toThrow(RangeError);
    expect(() => decompor(curvaDe(0.2, 40), 19)).not.toThrow();
  });

  it('uma circunferencia tem um harmonico so', () => {
    const s = decompor(curvaDe(0), 8);
    const modulo = (n: number): number => Math.hypot(s.re[n + 8]!, s.im[n + 8]!);
    expect(modulo(1), 'o deferente').toBeCloseTo(1, 12);
    for (const n of [-3, -2, -1, 0, 2, 3]) {
      expect(modulo(n), `n=${n} deveria ser zero`).toBeLessThan(1e-12);
    }
  });

  it('o termo constante e a posicao MEDIA NO TEMPO: 1,5·a·e, e nao a·e', () => {
    // O centro geometrico da elipse esta a a·e do foco. A media no tempo esta
    // a 1,5·a·e, do lado do apoastro, porque o corpo passa mais tempo longe —
    // e a segunda lei de Kepler aparecendo num coeficiente. A primeira versao
    // deste teste afirmava a·e, e o teste reprovou a afirmacao.
    for (const e of [0.1, 0.3, 0.6, 0.9]) {
      const s = decompor(curvaDe(e));
      const cx = s.re[s.termosMax]!;
      const cy = s.im[s.termosMax]!;
      expect(Math.hypot(cx, cy), `e=${e}`).toBeCloseTo(1.5 * e, 6);
      // O periastro foi posto em +x, entao a media cai do lado oposto.
      expect(cx, `e=${e}: a media caiu do lado do periastro`).toBeLessThan(0);
      expect(Math.abs(cy), `e=${e}`).toBeLessThan(1e-9);
    }
  });

  it('o maior elo que GIRA e sempre o n = 1 — o deferente', () => {
    // Ate e = 0,9, onde ele vale 0,55 contra 0,19 do segundo. O termo
    // constante chega a ser maior (1,35 em e = 0,9), mas ele nao gira: e o
    // deslocamento do excentrico, e nao um epiciclo.
    for (const e of [0, 0.1, 0.4, 0.7, 0.9]) {
      const s = decompor(curvaDe(e));
      const { elos } = cadeiaDeEpiciclos(s, 0.3, TERMOS_MAX);
      expect(elos[0]!.n, `e=${e}: o deferente deixou de ser o maior`).toBe(1);
      expect(elos.every((l) => l.n !== 0), 'o termo constante entrou na cadeia como circulo').toBe(true);
    }
  });
});

describe('convergencia', () => {
  it('mais harmonicos nunca pioram a aproximacao', () => {
    const curva = curvaDe(0.3);
    const s = decompor(curva);
    const c = convergencia(s, curva);
    for (let i = 1; i < c.length; i++) {
      expect(c[i]!.medioUa, `harmonico ${i + 1} piorou`).toBeLessThanOrEqual(c[i - 1]!.medioUa * 1.000001);
    }
    expect(c[0]!.medioUa, 'um harmonico so ja descreveria tudo?').toBeGreaterThan(1e-4);
  });

  it('a serie converge, e quanto mais alongada a orbita mais termos precisa', () => {
    // A observacao pedagogica inteira do laboratorio: Vênus fecha com poucos
    // epiciclos, Mercurio precisa de mais. Se este teste passar com um numero
    // igual para os dois, o laboratorio nao esta mostrando nada.
    const contas = [0.0068, 0.0934, 0.2056, 0.5].map((e) => {
      const curva = curvaDe(e);
      const s = decompor(curva);
      const c = convergencia(s, curva);
      return c.findIndex((d) => d.maximoUa < 1e-6) + 1;
    });
    for (let i = 1; i < contas.length; i++) {
      expect(contas[i]!, `e maior deveria pedir mais termos: ${contas.join(', ')}`)
        .toBeGreaterThan(contas[i - 1]!);
    }
  });

  it('uma circunferencia fecha com um harmonico e o desvio some no ruido', () => {
    const curva = curvaDe(0);
    const s = decompor(curva);
    expect(desvio(s, curva, 1).maximoUa).toBeLessThan(1e-13);
    expect(harmonicosAteOPiso(s, curva)).toBe(1);
  });

  it('a Terra fecha dentro de 1 km com poucos harmonicos', () => {
    // 1 km = 6,7e-9 UA. O limiar e frouxo de proposito: o valor apertado
    // viraria um teste que quebra sozinho quando a amostragem mudar.
    const curva = curvaDe(0.0167);
    const s = decompor(curva);
    const termos = convergencia(s, curva).findIndex((d) => d.maximoUa < 6.7e-9) + 1;
    expect(termos).toBeGreaterThan(0);
    expect(termos, `a Terra precisou de ${termos} harmonicos`).toBeLessThanOrEqual(6);
  });
});

describe('a cadeia de epiciclos E a serie', () => {
  it('a ponta do ultimo elo cai exatamente sobre a soma da serie', () => {
    // Este e o teste da tese. Um desenho que so se PARECE com a serie seria
    // uma ilustracao; a cadeia tem de ser a propria soma, elo por elo.
    // A tolerancia e RELATIVA ao semieixo, e nao absoluta em UA.
    //
    // A ponta e a soma de ate 49 termos complexos de modulo ate |c_1| ~ a. Um
    // limiar absoluto de 1e-15 UA e menos de um ULP do resultado para Netuno,
    // onde a = 30,07 e 1 ULP ja vale 3,6e-15 UA: o teste estaria exigindo mais
    // precisao do que o float64 tem, e reprovaria um codigo certo assim que
    // alguem o rodasse numa orbita externa.
    for (const aUa of [1, 30.07]) {
      const s = decompor(escalar(curvaDe(0.35), aUa));
      for (const termos of [1, 2, 5, 12, TERMOS_MAX]) {
        for (const t of [0, 0.13, 0.5, 0.77, 0.99]) {
          const { ponta } = cadeiaDeEpiciclos(s, t, termos);
          const [x, y] = reconstruir(s, t, termos);
          expect(Math.hypot(ponta[0] - x, ponta[1] - y) / aUa, `a=${aUa} termos=${termos} t=${t}`)
            .toBeLessThan(1e-14);
        }
      }
    }
  });

  it('cada elo comeca onde o anterior termina', () => {
    const s = decompor(curvaDe(0.35));
    const { excentrico, elos } = cadeiaDeEpiciclos(s, 0.42, 8);
    // A cadeia parte do excentrico, e nao da origem: a origem e o foco, onde
    // fica o corpo central.
    expect(elos[0]!.centro).toEqual(excentrico);
    for (let i = 1; i < elos.length; i++) {
      expect(elos[i]!.centro[0], `elo ${i}`).toBeCloseTo(elos[i - 1]!.ponta[0], 15);
      expect(elos[i]!.centro[1], `elo ${i}`).toBeCloseTo(elos[i - 1]!.ponta[1], 15);
    }
  });

  it('o raio de cada elo nao muda com o tempo — e um circulo, nao uma elipse', () => {
    // O que distingue um epiciclo de um termo qualquer da serie: o
    // comprimento do ponteiro e FIXO e so a fase gira. Era isto que a
    // decomposicao real de x e y separadas nao dava.
    const s = decompor(curvaDe(0.35));
    const raios = (t: number): number[] => cadeiaDeEpiciclos(s, t, 6).elos.map((e) => e.raio);
    const r0 = raios(0);
    for (const t of [0.2, 0.45, 0.8]) {
      raios(t).forEach((r, i) => expect(r, `elo ${i} em t=${t}`).toBeCloseTo(r0[i]!, 15));
    }
  });

  it('a cadeia completa percorre a orbita inteira', () => {
    const curva = curvaDe(0.35);
    const s = decompor(curva);
    for (let k = 0; k < AMOSTRAS; k += 37) {
      const { ponta } = cadeiaDeEpiciclos(s, k / AMOSTRAS, TERMOS_MAX);
      const d = Math.hypot(ponta[0] - curva[2 * k]!, ponta[1] - curva[2 * k + 1]!);
      expect(d, `amostra ${k}`).toBeLessThan(1e-9);
    }
  });
});

/**
 * Um oraculo independente para os coeficientes.
 *
 * Ate aqui, todo teste deste arquivo compara o codigo com ele mesmo: a serie
 * e calculada a partir de uma curva que saiu de `amostrarNoTempo`, que por sua
 * vez chama `resolverKepler`. Se os tres compartilhassem um erro — uma
 * convencao de fase trocada, um sinal — os tres concordariam, e a suite
 * inteira ficaria verde sobre uma orbita errada.
 *
 * Este oraculo calcula `c_n` por outro caminho: integra na ANOMALIA EXCENTRICA
 * em vez do tempo, usando a substituicao `dM = (1 − e·cos E)·dE`. Com isso ele
 *
 *   - nunca resolve a equacao de Kepler (E e a variavel de integracao),
 *   - nunca usa a amostragem no tempo,
 *   - e nao passa por nenhuma linha de `fourier.ts`.
 *
 * A regra do trapezio sobre um integrando periodico e suave converge
 * exponencialmente, entao 4.096 nos ja dao precisao de maquina — e por isso
 * nao ha aqui nenhuma tolerancia inventada para acomodar o metodo.
 *
 *     c_n = (1/2π) ∫ z(E)·e^(−in(E − e·sen E))·(1 − e·cos E) dE
 */
function coeficientePorQuadratura(a: number, e: number, n: number, nos = 4096): [number, number] {
  let somaRe = 0;
  let somaIm = 0;
  const b = a * Math.sqrt(1 - e * e);
  for (let k = 0; k < nos; k++) {
    const E = (DOIS_PI * k) / nos;
    const zx = a * (Math.cos(E) - e);
    const zy = b * Math.sin(E);
    const M = E - e * Math.sin(E);
    const fase = -n * M;
    const c = Math.cos(fase);
    const s = Math.sin(fase);
    const jacobiano = 1 - e * Math.cos(E);
    somaRe += (zx * c - zy * s) * jacobiano;
    somaIm += (zx * s + zy * c) * jacobiano;
  }
  return [somaRe / nos, somaIm / nos];
}

describe('conferido contra uma fonte independente do codigo', () => {
  it('cada coeficiente bate com a quadratura em anomalia excentrica', () => {
    for (const e of [0, 0.0167, 0.2056, 0.5, 0.8]) {
      const s = decompor(curvaDe(e, 2048), 12);
      for (let n = -8; n <= 8; n++) {
        const [re, im] = coeficientePorQuadratura(1, e, n);
        const i = n + s.termosMax;
        expect(s.re[i]!, `e=${e} n=${n} (real)`).toBeCloseTo(re, 10);
        expect(s.im[i]!, `e=${e} n=${n} (imag)`).toBeCloseTo(im, 10);
      }
    }
  });

  it('o oraculo reproduz o resultado classico da posicao media', () => {
    // Guarda contra o oraculo estar errado JUNTO: a media temporal de uma
    // orbita kepleriana fica a −3ae/2 do foco, e isso se deriva no papel.
    for (const e of [0.1, 0.4, 0.75]) {
      const [re, im] = coeficientePorQuadratura(1, e, 0);
      expect(re, `e=${e}`).toBeCloseTo(-1.5 * e, 12);
      expect(im, `e=${e}`).toBeCloseTo(0, 12);
    }
  });

  it('o oraculo pega uma convencao de fase trocada', () => {
    // O teste acima so vale se reprovar o erro que ele existe para pegar.
    // Com o sinal do expoente invertido, c_n e c_−n trocam de lugar — e para
    // uma orbita excentrica eles sao bem diferentes.
    const e = 0.5;
    const certo = coeficientePorQuadratura(1, e, 2);
    const trocado = coeficientePorQuadratura(1, e, -2);
    expect(Math.hypot(certo[0] - trocado[0], certo[1] - trocado[1])).toBeGreaterThan(1e-3);
  });
});

describe('a curva que o laboratorio usa sai do estado da simulacao', () => {
  it('e amostrada no TEMPO, e nao em angulo como a elipse desenhada', async () => {
    const { criarEstado } = await import('@nucleo/estado.ts');
    const { curvaDoLaboratorio, elipseOsculadora } = await import('@nucleo/efemerides.ts');

    // Sol na origem e um corpo em 1 UA com 80% da velocidade circular: uma
    // orbita alongada o bastante para as duas amostragens se separarem.
    const vCirc = Math.sqrt(GM_SOL / 1);
    const estado = criarEstado({
      gm: [GM_SOL, 0],
      pos: [0, 0, 0, 1, 0, 0],
      vel: [0, 0, 0, 0, 0.8 * vCirc, 0],
      tDias: 0,
    });

    const lab = curvaDoLaboratorio(estado, 1, 360)!;
    expect(lab).not.toBeNull();
    expect(lab.excentricidade).toBeCloseTo(0.36, 2);

    const passoLab = (k: number): number =>
      Math.hypot(
        lab.pontos[2 * ((k + 1) % 360)]! - lab.pontos[2 * k]!,
        lab.pontos[2 * ((k + 1) % 360) + 1]! - lab.pontos[2 * k + 1]!,
      );
    // Amostrada no tempo: o passo perto do periastro (k = 0) e bem maior.
    expect(passoLab(0) / passoLab(180)).toBeGreaterThan(2);

    // A elipse desenhada, na mesma orbita, tem passo quase uniforme — ela e
    // parametrizada pela geometria. As duas coexistem porque respondem
    // perguntas diferentes.
    const desenho = elipseOsculadora(estado, 1, 361);
    const passoDesenho = (k: number): number =>
      Math.hypot(
        desenho[3 * (k + 1)]! - desenho[3 * k]!,
        desenho[3 * (k + 1) + 1]! - desenho[3 * k + 1]!,
        desenho[3 * (k + 1) + 2]! - desenho[3 * k + 2]!,
      );
    expect(passoDesenho(0) / passoDesenho(180)).toBeLessThan(1.6);
  });

  it('a fase atual diz onde o corpo esta na volta', async () => {
    const { criarEstado } = await import('@nucleo/estado.ts');
    const { curvaDoLaboratorio } = await import('@nucleo/efemerides.ts');
    const vCirc = Math.sqrt(GM_SOL / 1);

    // Largado no periastro (o corpo esta no ponto mais proximo e se afasta):
    // com v abaixo da circular em +y a partir de (1,0,0), (1,0,0) e o AFELIO.
    const noAfelio = criarEstado({
      gm: [GM_SOL, 0],
      pos: [0, 0, 0, 1, 0, 0],
      vel: [0, 0, 0, 0, 0.8 * vCirc, 0],
      tDias: 0,
    });
    expect(curvaDoLaboratorio(noAfelio, 1, 64)!.faseAtual).toBeCloseTo(0.5, 6);

    // Acima da circular, o mesmo ponto vira o PERIASTRO.
    const noPeriastro = criarEstado({
      gm: [GM_SOL, 0],
      pos: [0, 0, 0, 1, 0, 0],
      vel: [0, 0, 0, 0, 1.2 * vCirc, 0],
      tDias: 0,
    });
    const f = curvaDoLaboratorio(noPeriastro, 1, 64)!.faseAtual;
    expect(Math.min(f, 1 - f)).toBeCloseTo(0, 6);
  });

  it('devolve nulo quando a orbita nao esta ligada', async () => {
    const { criarEstado } = await import('@nucleo/estado.ts');
    const { curvaDoLaboratorio } = await import('@nucleo/efemerides.ts');
    const fuga = criarEstado({
      gm: [GM_SOL, 0],
      pos: [0, 0, 0, 1, 0, 0],
      vel: [0, 0, 0, 0, 2 * Math.sqrt(GM_SOL), 0],
      tDias: 0,
    });
    expect(curvaDoLaboratorio(fuga, 1, 64)).toBeNull();
  });
});
