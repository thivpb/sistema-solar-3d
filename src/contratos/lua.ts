/**
 * Os elementos de uma lua, como o programa os usa.
 *
 * Mora em `contratos/` porque atravessa a fronteira: `src/dados/` le o JSON e
 * publica isto, `src/nucleo/` propaga e `src/cena/` desenha. Se morasse em
 * `dados/`, o nucleo teria de importar de la — e a regra que o mantem isolado
 * existe justamente para que a fisica nao dependa de nenhum catalogo.
 *
 * **Angulos em GRAUS aqui**, como na fonte. A conversao para radianos acontece
 * uma vez, na entrada da propagacao, e nunca no meio de uma conta.
 */
export interface ElementosDeLua {
  chave: string;
  nome: string;
  /** A chave do corpo que ela orbita, no catalogo dinamico. */
  pai: string;
  /** 'ecliptic' | 'Laplace' | 'equatorial', como a fonte declara. */
  plano: string;
  aKm: number;
  excentricidade: number;
  inclinacaoGraus: number;
  noGraus: number;
  periastroGraus: number;
  anomaliaMediaGraus: number;
  taxaDoNoGrausDia: number;
  taxaDoPeriastroGrausDia: number;
  taxaDaAnomaliaMediaGrausDia: number;
  /**
   * Taxa SIDERAL medida, graus/dia. `n = Mponto + periastroPonto + noPonto*cos(i)`.
   *
   * Ela nao e a taxa da anomalia media, e a diferenca importa: em Io vale 0,37%,
   * que em um ano sao 270 graus de fase. E ela, e nao a anomalistica, que da o
   * periodo de ROTACAO de uma lua travada por mare — ver `corposVisuais.ts`.
   */
  taxaSideralMedidaGrausDia: number;
  raioMedioKm: number;
  gmUa3Dia2: number;
  /** O polo do plano de referencia, em ICRF. Nulo para o plano da ecliptica. */
  poloUsado: { ra: number; dec: number } | null;
}

/** Base ortonormal do plano de referencia, em coordenadas eclipticas J2000. */
export interface BaseDoPlano {
  x: readonly [number, number, number];
  y: readonly [number, number, number];
  z: readonly [number, number, number];
}
