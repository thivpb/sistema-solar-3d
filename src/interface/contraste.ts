/**
 * A formula de contraste da WCAG 2.2, e a composicao de cor com alfa.
 *
 * Fica separada do tema porque tem dois usuarios: o teste que percorre os
 * pares da paleta, e o teste ponta a ponta que mede o contraste REAL entre os
 * pixels de um rotulo e os da placa atras dele, no compositado final da cena.
 *
 * Quando os dois discordam, quem manda e o empirico. O analitico e derivado
 * dele, nunca o contrario: uma placa translucida sobre uma cena com bloom tem
 * atras de si uma cor que nenhuma tabela previu.
 */
export type Cor = readonly [number, number, number];

export const BRANCO: Cor = [255, 255, 255];
export const PRETO: Cor = [0, 0, 0];

function canal(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa, conforme a definicao da WCAG. */
export function luminancia(cor: Cor): number {
  return 0.2126 * canal(cor[0]) + 0.7152 * canal(cor[1]) + 0.0722 * canal(cor[2]);
}

/** Razao de contraste entre duas cores. Vai de 1:1 a 21:1. */
export function contraste(a: Cor, b: Cor): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Interpola entre duas cores. t = 0 devolve a, t = 1 devolve b. */
export function misturar(a: Cor, b: Cor, t: number): Cor {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Compoe `frente` com opacidade `alfa` sobre `atras`.
 *
 * **A composicao acontece sobre sRGB de 8 bits, nao em luz linear.** E assim
 * que o navegador mistura, e a diferenca nao e academica: compondo em luz
 * linear, a conta diz que a placa precisaria de alfa 0,86 para passar nos
 * 4,5:1; compondo em sRGB, o alfa 0,667 que o projeto ja usava da 5,37:1 e
 * passa. Errar isso faria escurecer uma placa que nao precisava.
 */
export function compor(frente: Cor, alfa: number, atras: Cor): Cor {
  return misturar(atras, frente, alfa);
}

export const passa = (a: Cor, b: Cor, minimo: number): boolean => contraste(a, b) >= minimo;

export const paraCss = (c: Cor): string => `rgb(${c[0]} ${c[1]} ${c[2]})`;
