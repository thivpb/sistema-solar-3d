/**
 * Os enquadramentos nomeados. Cada um e uma distancia e um alvo, com o motivo escrito.
 *
 * Os valores dos tres primeiros vem da versao anterior, onde foram escolhidos
 * olhando a tela: 31,5 UA poe Netuno na borda; 1,75 UA da para ver os quatro
 * internos sem perder Marte; acompanhar usa o afelio do corpo vezes 1,25 para
 * a orbita inteira caber com folga.
 */
import type { Modo } from '../../contratos/ids.ts';
import { comprimirRaio } from '../escala/escalaVisual.ts';

export interface Alvo {
  pivo: [number, number, number];
  raio: number;
}

export const RAIO_SISTEMA_UA = 31.5;
export const RAIO_INTERNOS_UA = 1.75;

export interface DadosDoAlvo {
  posicao: [number, number, number];
  /** Afelio em UA, quando o corpo tem orbita fechada. */
  afelioUa: number | null;
  raioKm: number;
}

const UA_KM = 149597870.7;

/**
 * `maquete` comprime SO os enquadramentos que medem o sistema inteiro.
 *
 * 'sistema' e 'internos' sao distancias heliocentricas, e com a compressao
 * ligada o sistema desenhado cabe em 5,5 UA: manter 31,5 poria os oito
 * planetas num aglomerado de meia dezena de pixels.
 *
 * 'perto' e 'acompanhar' NAO passam por aqui, e a razao importa. 'perto' e
 * tres raios do proprio corpo — uma distancia LOCAL, de 1e-5 UA, que a raiz
 * quadrada inflaria trezentas vezes e jogaria a camera para fora da orbita da
 * lua mais distante. 'acompanhar' usa o afelio, que ja chega comprimido de
 * quem mediu a orbita. Comprimir duas vezes e o erro obvio; comprimir uma
 * escala local e o erro que parece certo.
 */
export function enquadrar(
  modo: Modo,
  sol: [number, number, number],
  alvo: DadosDoAlvo | null,
  maquete = false,
): Alvo {
  const daCena = (r: number): number => (maquete ? comprimirRaio(r) : r);
  switch (modo) {
    case 'sistema':
      return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };

    case 'internos':
      return { pivo: [...sol], raio: daCena(RAIO_INTERNOS_UA) };

    case 'acompanhar':
      if (!alvo) return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };
      // O Sol nao tem afelio; para ele o enquadramento e um raio fixo que
      // mostra a regiao onde ele bamboleia em volta do baricentro.
      return { pivo: [...alvo.posicao], raio: alvo.afelioUa !== null ? alvo.afelioUa * 1.25 : 1 };

    case 'perto':
      if (!alvo) return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };
      // Orbita baixa: da para ver o horizonte curvar e o terminador cruzar.
      // 3 raios do corpo poe a esfera inteira na tela com folga.
      return { pivo: [...alvo.posicao], raio: (alvo.raioKm / UA_KM) * 3 };

    default: {
      const _exaustivo: never = modo;
      void _exaustivo;
      return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };
    }
  }
}
