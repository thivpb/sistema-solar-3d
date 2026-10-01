/**
 * O problema de dois corpos resolvido de forma analitica.
 *
 * Existe para duas coisas, e para nenhuma terceira:
 *
 *   1. **As luas.** Elas nao entram no integrador. A Lua da uma volta em 27,3
 *      dias, o que com dt = 0,5 dia sao 55 passos por orbita; Io, em 1,77 dia,
 *      teria 3,5. Nesse regime Yoshida4 nao integra nada — precessa. Baixar o
 *      passo global para atender a Io destruiria o desempenho de tudo o mais e,
 *      pior, mudaria a camada dinamica que esta validada contra o JPL. Entao as
 *      luas sao propagadas por aqui, com elementos medios e taxas seculares, e
 *      a deriva que isso custa e medida e publicada em vez de escondida.
 *   2. **O laboratorio de Fourier**, que precisa da orbita kepleriana pura para
 *      comparar com a serie.
 *
 * **A visao geral do Sistema Solar NAO passa por aqui.** As posicoes dos nove
 * corpos dinamicos saem da integracao numerica, e e ela que a efemeride valida.
 * Misturar as duas coisas seria trocar a fonte de um resultado sem avisar.
 *
 * Veio de `src/fisica/kepler.py` do projeto anterior, com duas diferencas que
 * importam: aquele era 2D e so servia ao laboratorio, e o solver dele partia
 * de `E = M`, que para excentricidade alta nao converge — e o sandbox deixa
 * criar cometas.
 */
const DOIS_PI = 2 * Math.PI;

/**
 * Elementos keplerianos classicos, com as taxas seculares.
 *
 * Os angulos ficam em RADIANOS aqui dentro. As tabelas do JPL vem em graus, e
 * a conversao acontece uma vez, na leitura do dado — nunca no meio de uma
 * conta, que e onde um fator perdido some.
 */
export interface ElementosClassicos {
  /** Semieixo maior, UA. */
  aUa: number;
  e: number;
  /** Inclinacao sobre o plano de referencia, rad. */
  iRad: number;
  /** Longitude do no ascendente, rad. */
  nodoRad: number;
  /** Argumento do periastro, rad. */
  periastroRad: number;
  /** Anomalia media NA EPOCA, rad. */
  anomaliaMediaRad: number;
  /** Movimento medio, rad/dia. Vem da tabela, e nao de sqrt(mu/a^3). */
  movimentoMedioRadDia: number;
  /** Precessao do no, rad/dia. Negativa quando o no regride. */
  taxaDoNodoRadDia: number;
  /** Precessao do periastro, rad/dia. */
  taxaDoPeriastroRadDia: number;
}

/**
 * Resolve E − e·sen(E) = M.
 *
 * **O chute inicial nao e `E = M`.** Aquele e o do projeto anterior, e serve
 * para as excentricidades dos oito planetas, todas abaixo de 0,21. Acima de
 * uns 0,8 ele oscila entre dois valores e nunca converge, e um cometa criado
 * no sandbox chega perto de 1. O chute de Danby custa um seno a mais e
 * converge em toda a faixa.
 *
 * **E ha rede de seguranca.** Newton pode divergir, e um laco que sai por
 * `max_iter` devolvendo lixo e pior que um que demora: o lixo vira uma lua no
 * lugar errado, sem aviso. Se Newton nao fechar, a bissecao fecha — ela e
 * lenta e nunca falha, porque `E − e·sen(E) − M` e monotona em E.
 */
/*
 * Devolve E com `E − e·sen(E) = M`, com M reduzido a [0, 2π). O proprio E pode
 * cair um ULP fora desse intervalo nos extremos — em M = 0 o resultado e
 * −1e−17 e nao 0 —, o que e inofensivo porque so `sen(E)` e `cos(E)` saem
 * daqui, mas importa saber ao comparar angulos.
 */
export function resolverKepler(anomaliaMedia: number, e: number, tolerancia = 1e-13): number {
  const M = normalizarAngulo(anomaliaMedia);
  if (e < 1e-12) return M;

  // Danby: o chute cai do lado certo do periastro, que e onde `E = M` erra.
  let E = M + 0.85 * e * Math.sign(Math.sin(M) === 0 ? 1 : Math.sin(M));

  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const df = 1 - e * Math.cos(E);
    // `df` vai a zero no periastro de uma orbita quase parabolica. Sem esta
    // guarda o passo explode e o resultado sai NaN — e NaN se propaga calado
    // pela posicao, pela matriz e pelo buffer da GPU.
    if (Math.abs(df) < 1e-14) break;
    const passo = f / df;
    E -= passo;
    if (Math.abs(passo) < tolerancia) return E;
  }

  // Bissecao: E fica sempre em [M − e, M + e], porque |E − M| = |e·sen(E)| <= e.
  let baixo = M - e;
  let alto = M + e;
  for (let k = 0; k < 200; k++) {
    const meio = 0.5 * (baixo + alto);
    if (meio - e * Math.sin(meio) - M > 0) alto = meio;
    else baixo = meio;
    if (alto - baixo < tolerancia) break;
  }
  return 0.5 * (baixo + alto);
}

/** Anomalia verdadeira a partir da excentrica. A forma com meio angulo nao perde quadrante. */
export function anomaliaVerdadeira(E: number, e: number): number {
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

export interface EstadoRelativo {
  /** Posicao em relacao ao corpo central, UA, no plano de referencia dos elementos. */
  pos: [number, number, number];
  /** Velocidade em relacao ao corpo central, UA/dia. */
  vel: [number, number, number];
}

/**
 * Elementos -> posicao e velocidade, em 3D.
 *
 * A rotacao completa e `Rz(nodo) · Rx(i) · Rz(periastro)`, aplicada aos vetores
 * da base perifocal. Vale escrever por que a ordem e essa e nao outra: `Rz`
 * primeiro leva o periastro para o no, `Rx` inclina o plano, e o segundo `Rz`
 * gira o no para a longitude certa. Trocar duas dessas gira a orbita para um
 * lugar plausivel e errado — o tipo de erro que so aparece quando alguem
 * compara com uma foto.
 *
 * **O plano de referencia sai daqui como entrou.** Se os elementos estao no
 * equador do planeta, a saida esta no equador do planeta. Quem converte para a
 * ecliptica da cena e quem sabe qual plano aquela tabela usava — e cada
 * planeta usa um. Fazer a conversao aqui obrigaria este modulo a conhecer os
 * corpos, e ele nao conhece nenhum.
 */
export function estadoDeElementos(
  el: ElementosClassicos,
  mu: number,
  diasDesdeAEpoca: number,
): EstadoRelativo {
  const M = el.anomaliaMediaRad + el.movimentoMedioRadDia * diasDesdeAEpoca;
  const nodo = el.nodoRad + el.taxaDoNodoRadDia * diasDesdeAEpoca;
  const periastro = el.periastroRad + el.taxaDoPeriastroRadDia * diasDesdeAEpoca;

  const E = resolverKepler(M, el.e);
  const a = el.aUa;
  const e = el.e;
  const r = a * (1 - e * Math.cos(E));

  // Base perifocal: x para o periastro, y a 90 graus no sentido do movimento.
  const xP = a * (Math.cos(E) - e);
  const yP = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Velocidade perifocal. `sqrt(mu*a)/r` e a forma que nao passa pela anomalia
  // verdadeira e por isso nao perde precisao perto do periastro.
  const fator = Math.sqrt(mu * a) / r;
  const vxP = -fator * Math.sin(E);
  const vyP = fator * Math.sqrt(1 - e * e) * Math.cos(E);

  const cO = Math.cos(nodo);
  const sO = Math.sin(nodo);
  const ci = Math.cos(el.iRad);
  const si = Math.sin(el.iRad);
  const cw = Math.cos(periastro);
  const sw = Math.sin(periastro);

  // As colunas da matriz Rz(nodo)·Rx(i)·Rz(periastro), escritas abertas: uma
  // multiplicacao de matriz 3x3 aqui custaria 27 produtos por corpo por quadro
  // para chegar no mesmo lugar.
  const p0 = cO * cw - sO * sw * ci;
  const p1 = sO * cw + cO * sw * ci;
  const p2 = sw * si;
  const q0 = -cO * sw - sO * cw * ci;
  const q1 = -sO * sw + cO * cw * ci;
  const q2 = cw * si;

  return {
    pos: [p0 * xP + q0 * yP, p1 * xP + q1 * yP, p2 * xP + q2 * yP],
    vel: [p0 * vxP + q0 * vyP, p1 * vxP + q1 * vyP, p2 * vxP + q2 * vyP],
  };
}

/**
 * Uma volta inteira em `n` pontos igualmente espacados NO TEMPO.
 *
 * O espacamento temporal, e nao angular, e o que faz a segunda lei de Kepler
 * aparecer sozinha no desenho: os pontos ficam juntos perto do foco, onde o
 * corpo corre, e espalhados longe dele, onde ele se arrasta. Essa observacao e
 * herdada literal do projeto anterior, e e tambem a amostragem que o
 * laboratorio de Fourier precisa — amostrar em angulo daria outros
 * coeficientes, de outra funcao.
 */
export function amostrarNoTempo(el: ElementosClassicos, mu: number, n: number): Float64Array {
  const saida = new Float64Array(3 * n);
  const periodo = DOIS_PI / el.movimentoMedioRadDia;
  for (let k = 0; k < n; k++) {
    const { pos } = estadoDeElementos(el, mu, (k / n) * periodo);
    saida[3 * k] = pos[0];
    saida[3 * k + 1] = pos[1];
    saida[3 * k + 2] = pos[2];
  }
  return saida;
}

/** Para [0, 2π). O resto de JS pode ser negativo, e o chute de Danby depende do sinal. */
export function normalizarAngulo(a: number): number {
  const r = a % DOIS_PI;
  return r < 0 ? r + DOIS_PI : r;
}

export const grausParaRad = (g: number): number => (g * Math.PI) / 180;
