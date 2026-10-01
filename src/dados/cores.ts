/**
 * A cor de cada corpo, e as derivadas dela.
 *
 * **Por que isto nao mora em `interface/tema.ts`.** A cena precisa da cor para
 * desenhar as fitas de orbita e de rastro, e a regra de camadas proibe
 * `cena -> interface` — proibe de proposito, porque por essa porta entrariam o
 * reducer e as acoes. A cor de um corpo e um fato congelado como qualquer
 * outro deste pacote; o tema continua dono das cores de INTERFACE e da
 * conferencia de contraste.
 *
 * A regra que vem junto continua valendo, e em maiusculas:
 *
 *     COR DE PLANETA NAO E COR DE TEXTO.
 *
 * Netuno da 4,4997:1 contra o fundo e reprova como texto, por pouco. A regra
 * vale para todos mesmo assim: uma excecao por corpo seria uma armadilha na
 * proxima cor que entrasse.
 */
export type Cor = readonly [number, number, number];

/** Interpola entre duas cores. t = 0 devolve a, t = 1 devolve b. */
export function misturar(a: Cor, b: Cor, t: number): Cor {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** O fundo do espaco. Repetido aqui porque as cores derivadas partem dele. */
export const FUNDO: Cor = [12, 14, 22];

export const COR_DOS_CORPOS: Record<string, Cor> = {
  sol: [255, 199, 61],
  mercurio: [181, 165, 142],
  venus: [235, 168, 92],
  terra: [96, 154, 245],
  marte: [208, 88, 72],
  jupiter: [206, 156, 112],
  saturno: [222, 199, 137],
  urano: [137, 214, 224],
  netuno: [76, 118, 217],
  lua: [190, 188, 184],
  fobos: [150, 140, 132],
  deimos: [150, 140, 132],
  io: [226, 200, 110],
  europa: [216, 208, 196],
  ganimedes: [178, 166, 152],
  calisto: [140, 128, 118],
  tita: [226, 176, 96],
  encelado: [235, 240, 245],
  titania: [170, 175, 180],
  oberon: [160, 152, 148],
  miranda: [175, 178, 182],
  tritao: [205, 195, 200],
};

export const corDoCorpo = (chave: string): Cor => COR_DOS_CORPOS[chave] ?? [152, 159, 178];

/** Trilha mais discreta que o disco, para nao competir com ele. */
export const corDaTrilha = (chave: string): Cor => misturar(FUNDO, corDoCorpo(chave), 0.55);

export const corDaOrbita = (chave: string, destacada = false): Cor =>
  misturar(FUNDO, corDoCorpo(chave), destacada ? 0.55 : 0.3);

/** As cores que NUNCA podem ser usadas como texto, e por que. */
export const NUNCA_COMO_TEXTO = Object.keys(COR_DOS_CORPOS);

/** Cor dos aneis de distancia. Decorativa: nao carrega informacao sozinha. */
export const TEMA_GRADE: Cor = [40, 46, 64];
