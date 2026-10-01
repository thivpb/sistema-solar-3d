/**
 * O UNICO lugar onde as distancias desenhadas deixam de ser proporcionais as
 * reais.
 *
 * **Por que existe.** Netuno esta 77 vezes mais longe do Sol que Mercurio.
 * Numa tela mostrando o sistema inteiro em escala real, os quatro internos
 * ocupam a largura de um dedo e nao da para explorar nada ali.
 *
 * **Por que e opcional e desligada por padrao.** Comprimir distancia e uma
 * mentira util, e mentira util precisa vir com etiqueta. Quando ligada, o
 * visor escreve "DISTANCIAS COMPRIMIDAS — o desenho nao esta em escala", a
 * Ajuda declara a licenca, e a regua linear e SUBSTITUIDA pelo aviso em vez de
 * ficar ao lado dele: regua reta sobre escala nao-linear e mentira grafica.
 *
 * **A regra que nao se quebra:** este modulo mexe em coordenada de desenho e
 * so. Nada daqui volta para o estado fisico, e `src/nucleo/` nao pode nem
 * importar este arquivo — o dependency-cruiser verifica. O mesmo vale dentro
 * da cena: a iluminacao e a exposicao continuam medindo a distancia REAL,
 * porque senao Netuno, desenhado a 5,5 UA, receberia trinta vezes mais luz do
 * que recebe, e a compressao estaria alterando um resultado fisico visivel.
 *
 * Portado de `src/projecao/escala_visual.py` sem mudanca de matematica, com
 * uma diferenca: la era 2D e aqui o raio e o de tres dimensoes.
 */

/** A distancia que fica inalterada. Com 1 UA, a orbita da Terra nao se mexe. */
export const R_REFERENCIA_UA = 1;

/** Abaixo disto nao ha direcao radial definida, e o fator seria divisao por zero. */
const R_MINIMO = 1e-9;

/**
 * `r_desenhado = R·raiz(r_real / R)`.
 *
 * A raiz quadrada, e nao o logaritmo: o log manda o centro para menos
 * infinito e precisa de um piso arbitrario, e a raiz e monotona, suave e vale
 * zero em zero. Com R = 1 UA, Mercurio vai de 0,39 para 0,62 e Netuno de 30,1
 * para 5,5 — a razao entre o mais longe e o mais perto cai de 77:1 para 8,8:1,
 * e os oito cabem na mesma tela com folga visivel entre eles.
 */
export function comprimirRaio(rUa: number): number {
  return rUa <= 0 ? 0 : R_REFERENCIA_UA * Math.sqrt(rUa / R_REFERENCIA_UA);
}

/** O fator pelo qual multiplicar o vetor radial. 1 quando nao ha compressao. */
export function fatorEm(rUa: number): number {
  return rUa > R_MINIMO ? comprimirRaio(rUa) / rUa : 1;
}

/**
 * Comprime um ponto em torno de `origem`, preservando a DIRECAO.
 *
 * O angulo nao muda, entao a posicao angular dos planetas continua correta: se
 * Marte esta em oposicao, ele aparece em oposicao. O que muda e so o quanto
 * ele parece longe.
 *
 * A origem e a posicao MEDIDA do Sol, e nao a origem do referencial, que e o
 * baricentro do Sistema Solar. Comprimir em torno do baricentro deslocaria o
 * Sol do centro do desenho por um valor que cresce com a compressao.
 */
export function comprimirPonto(
  p: readonly [number, number, number],
  origem: readonly [number, number, number],
): [number, number, number] {
  const dx = p[0] - origem[0];
  const dy = p[1] - origem[1];
  const dz = p[2] - origem[2];
  const f = fatorEm(Math.hypot(dx, dy, dz));
  return [origem[0] + dx * f, origem[1] + dy * f, origem[2] + dz * f];
}

/**
 * Comprime um buffer inteiro de posicoes em torno do corpo `iOrigem`.
 *
 * Escreve em `saida`, que pode ser o mesmo buffer da entrada — a conta de cada
 * corpo so depende dele proprio e da origem, e a origem e lida antes do laco.
 */
export function comprimirBuffer(
  posUa: Float64Array,
  n: number,
  saida: Float64Array,
  iOrigem = 0,
): void {
  const ox = posUa[3 * iOrigem]!;
  const oy = posUa[3 * iOrigem + 1]!;
  const oz = posUa[3 * iOrigem + 2]!;
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    const dx = posUa[k]! - ox;
    const dy = posUa[k + 1]! - oy;
    const dz = posUa[k + 2]! - oz;
    const f = fatorEm(Math.hypot(dx, dy, dz));
    saida[k] = ox + dx * f;
    saida[k + 1] = oy + dy * f;
    saida[k + 2] = oz + dz * f;
  }
}

/** Comprime pontos ja RELATIVOS a origem, no lugar. Para as fitas e as trilhas. */
export function comprimirRelativos(buffer: Float32Array, n: number): void {
  for (let k = 0; k < n; k++) {
    const i = 3 * k;
    const f = fatorEm(Math.hypot(buffer[i]!, buffer[i + 1]!, buffer[i + 2]!));
    buffer[i] = buffer[i]! * f;
    buffer[i + 1] = buffer[i + 1]! * f;
    buffer[i + 2] = buffer[i + 2]! * f;
  }
}
