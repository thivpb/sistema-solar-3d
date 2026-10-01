/**
 * O layout, como FUNCAO PURA.
 *
 * `calcular(largura, altura, lateralAberta, metricas) -> Areas`. Sem DOM,
 * sem estado, sem efeito. Isso e herdado do projeto anterior e tem historia:
 * a regra escrita la era "nenhum retangulo no escopo do modulo", porque um
 * retangulo calculado uma vez na importacao foi a causa de a versao anterior
 * aquela nao redimensionar.
 *
 * O que muda no DOM: a funcao nao posiciona nada. Ela EMITE custom properties
 * CSS, e o CSS posiciona. Assim continua havendo uma fonte de verdade so — e o
 * porte das 480 combinacoes de `tests/test_layout.py` continua significando
 * alguma coisa, em vez de virar um teste sobre um objeto que ninguem usa.
 *
 * Os pontos de quebra sao os mesmos: 1220 e 1000 px de largura, 680 de altura.
 * Abaixo do ponto de quebra a lateral vira SOBREPOSICAO, e nao some: sumir
 * tiraria da pessoa a unica lista de corpos navegavel por teclado.
 */
export type Faixa = 'amplo' | 'medio' | 'estreito';
export type Altura = 'normal' | 'baixo';

export const LARGURA_MINIMA = 320;
export const ALTURA_MINIMA = 400;

/** A janela que o programa promete atender por inteiro. Abaixo disso, degrada declarado. */
export const LARGURA_CONFORTAVEL = 960;
export const ALTURA_CONFORTAVEL = 600;

const QUEBRA_AMPLO = 1220;
const QUEBRA_MEDIO = 1000;
const QUEBRA_BAIXO = 680;

export interface Metricas {
  /** 1,0 ou 1,25 — o unico botao da acessibilidade de tamanho. */
  escalaTexto: number;
}

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Areas {
  faixa: Faixa;
  altura: Altura;
  /** Verdadeiro quando a lateral flutua sobre o canvas em vez de dividir espaco. */
  lateralSobreposta: boolean;
  lateralVisivel: boolean;
  barraSuperior: Retangulo;
  lateral: Retangulo;
  canvas: Retangulo;
  /** Custom properties para pendurar em `:root`. O CSS faz o resto. */
  variaveis: Record<string, string>;
}

export function faixaDe(largura: number): Faixa {
  if (largura >= QUEBRA_AMPLO) return 'amplo';
  if (largura >= QUEBRA_MEDIO) return 'medio';
  return 'estreito';
}

export function alturaDe(altura: number): Altura {
  return altura >= QUEBRA_BAIXO ? 'normal' : 'baixo';
}

export function calcular(
  larguraJanela: number,
  alturaJanela: number,
  lateralAberta: boolean,
  metricas: Metricas = { escalaTexto: 1 },
): Areas {
  // Nunca devolve area negativa, nem em janela absurda. A versao anterior
  // quebrava aqui, e o teste das 480 combinacoes nasceu disso.
  const L = Math.max(LARGURA_MINIMA, Math.floor(larguraJanela));
  const A = Math.max(ALTURA_MINIMA, Math.floor(alturaJanela));
  const e = metricas.escalaTexto;

  const faixa = faixaDe(L);
  const altura = alturaDe(A);

  const alturaBarra = Math.round((altura === 'baixo' ? 48 : 56) * e);
  const larguraLateralIdeal = Math.round((faixa === 'amplo' ? 320 : 288) * e);
  // A lateral nunca come mais que 40% da janela: num tablet estreito ela
  // deixaria o canvas menor que a propria lateral.
  const larguraLateral = Math.min(larguraLateralIdeal, Math.floor(L * 0.4));

  const lateralSobreposta = faixa === 'estreito';
  const lateralVisivel = lateralAberta;
  const ocupaEspaco = lateralVisivel && !lateralSobreposta;

  const barraSuperior: Retangulo = { x: 0, y: 0, largura: L, altura: alturaBarra };
  const lateral: Retangulo = {
    x: L - larguraLateral,
    y: alturaBarra,
    largura: larguraLateral,
    altura: A - alturaBarra,
  };
  const canvas: Retangulo = {
    x: 0,
    y: alturaBarra,
    largura: ocupaEspaco ? L - larguraLateral : L,
    altura: A - alturaBarra,
  };

  return {
    faixa,
    altura,
    lateralSobreposta,
    lateralVisivel,
    barraSuperior,
    lateral,
    canvas,
    variaveis: {
      '--escala-texto': String(e),
      '--altura-barra': `${alturaBarra}px`,
      '--largura-lateral': `${larguraLateral}px`,
      '--largura-canvas': `${canvas.largura}px`,
      '--altura-canvas': `${canvas.altura}px`,
      '--gutter': faixa === 'estreito' ? '16px' : '20px',
    },
  };
}

/** Aplica as variaveis num elemento. O unico ponto que toca o DOM neste modulo. */
export function aplicarVariaveis(alvo: { style: CSSStyleDeclaration }, areas: Areas): void {
  for (const [nome, valor] of Object.entries(areas.variaveis)) {
    alvo.style.setProperty(nome, valor);
  }
}
