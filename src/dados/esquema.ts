/**
 * A forma do arquivo de efemeride, escrita como tipo.
 *
 * O arquivo e gerado por `ferramentas/gerar_efemeride.py` a partir do JPL e
 * fica versionado junto com o codigo. E o que permite abrir o programa sem
 * internet: nada aqui vai a rede.
 *
 * O esquema 2 acrescenta rotacao, aneis e luas. `carregar.ts` aceita 1 e 2,
 * entao o arquivo de hoje continua abrindo depois de a fase F6 estender o
 * gerador.
 */

export interface CorpoNaEfemeride {
  nome: string;
  id_horizons: string;
  /** Id do CENTRO do planeta (199, 299, ...). O raio vem deste, nao do baricentro. */
  id_horizons_centro?: string;
  gm_au3_dia2: number;
  raio_km: number;
  posicao_ua: [number, number, number];
  velocidade_ua_dia: [number, number, number];
}

export interface PontoDeValidacao {
  calendario_tdb: string;
  jd_tdb: number;
  dias_desde_a_epoca: number;
  corpos: Record<string, { posicao_ua: [number, number, number]; velocidade_ua_dia: [number, number, number] }>;
}

export interface Procedencia {
  epoca: { calendario_tdb: string; jd_tdb: number };
  escala_de_tempo: string;
  unidades: Record<string, string>;
  convencao_de_centros: unknown;
  vetores_de_estado: {
    fonte: string;
    efemeride_citada_pelo_horizons: string[];
    centro: string;
    referencial: string;
    correcao: string;
  };
  raios_fisicos: unknown;
  parametros_gravitacionais: unknown;
}

export interface ConstantesDe440 {
  AU_km: number;
  EMRAT: number;
  CLIGHT_km_s: number;
  DENUM: number;
}

export interface ArquivoEfemeride {
  esquema?: number;
  _leia_isto?: string;
  ordem: string[];
  corpos: Record<string, CorpoNaEfemeride>;
  procedencia: Procedencia;
  constantes_de440: ConstantesDe440;
  validacao?: Record<string, PontoDeValidacao>;
}
