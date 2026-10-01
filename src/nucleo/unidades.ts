/**
 * Unidades. Sao as do JPL, e nao as do SI, de proposito.
 *
 *     posicao      UA
 *     velocidade   UA/dia
 *     gravidade    GM em UA^3/dia^2  (GM junto, nunca G e M separados)
 *     tempo        dias na escala TDB, contados a partir da epoca
 *
 * Nessas unidades os numeros da efemeride entram como estao, sem conversao e
 * sem etapa intermediaria onde um fator possa se perder. Converter para o SI
 * daria GM da ordem de 1e20 e posicoes da ordem de 1e11, e a soma de um termo
 * grande com um pequeno passaria a perder digitos onde hoje nao perde.
 *
 * A conversao para quilometro e para km/s existe so para MOSTRAR numero na
 * tela. Nenhuma conta de fisica passa por aqui.
 */

/** Unidade astronomica em km. Valor do cabecalho do DE440, nao arredondado. */
export const UA_KM = 149597870.7;

export const DIA_S = 86400.0;

/** Dias de um ano juliano. E a definicao usada no projeto inteiro: 365,25. */
export const ANO_DIAS = 365.25;

export const GRAUS_POR_RAD = 180 / Math.PI;

export const uaParaKm = (ua: number): number => ua * UA_KM;

export const kmParaUa = (km: number): number => km / UA_KM;

/** UA/dia -> km/s. A velocidade que aparece nas fichas. */
export const kmPorS = (uaPorDia: number): number => (uaPorDia * UA_KM) / DIA_S;

export const grausDeRad = (rad: number): number => rad * GRAUS_POR_RAD;

/**
 * UA/dia^2 -> m/s^2. Existe so para a tela da matematica do Sol, onde o
 * numero precisa ser comparavel com a gravidade que a pessoa conhece: os
 * 9,8 m/s^2 da superficie da Terra. Em UA/dia^2 a aceleracao do Sol da 4e-11,
 * um numero que nao diz nada a ninguem.
 */
export const mPorS2 = (uaPorDia2: number): number =>
  (uaPorDia2 * UA_KM * 1000) / (DIA_S * DIA_S);
