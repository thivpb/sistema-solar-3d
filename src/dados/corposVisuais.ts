/**
 * O que um corpo PARECE: eixo, rotacao, aneis, cor e mapas.
 *
 * Separado de `carregar.ts` de proposito. Aquele traz o que a fisica usa — GM,
 * posicao, velocidade — e nada mais; este traz o que so o desenho usa. A
 * fronteira e a mesma que o projeto em pygame mantinha entre `fisica/corpo.py`
 * e `ui/tema.py`, ligados pela mesma `chave`.
 *
 * ## Rotacao: IAU WGCCRE 2015
 *
 * Archinal, B. A. et al., *Report of the IAU Working Group on Cartographic
 * Coordinates and Rotational Elements: 2015*, Celestial Mechanics and Dynamical
 * Astronomy 130:22 (2018). https://doi.org/10.1007/s10569-017-9805-5
 *
 * Transcrito a mao, com citacao por valor, e NAO raspado do `OBJ_DATA` do
 * Horizons: aquilo e texto livre cuja formatacao muda de corpo para corpo, e
 * uma expressao regular sobre isso e fonte de erro silencioso. O gerador de
 * efemerides continua lendo o `OBJ_DATA` como CONFERENCIA CRUZADA.
 *
 * **Os termos seculares foram omitidos, e isto e uma escolha declarada.** O
 * polo de Marte, por exemplo, anda `−0,109°` por seculo juliano. Num programa
 * que desenha o eixo inclinado na tela, um decimo de grau por seculo esta
 * varias ordens de grandeza abaixo do que se enxerga. O que NAO se omite e a
 * taxa de rotacao `W_ponto`, que e o que faz o planeta girar.
 *
 * **Tres corpos sao excecao, e os tres quase passaram errados.**
 *
 * A Lua foi a primeira. Descartando os termos periodicos dela, o eixo saiu a
 * 0,02° do norte da ecliptica — praticamente em pe. O valor certo e 1,54°. A
 * razao: no caso da Lua o termo `E1` NAO e uma correcao pequena, ele E a
 * obliquidade. A IAU escreve `delta_0 = 66,5392 + 1,5419 cos E1`, e esse 1,5419
 * e o angulo de Cassini inteiro.
 *
 * **Marte e a segunda, e ficou errada por mais tempo** — inclusive depois de
 * este cabecalho declarar a Lua como excecao UNICA. A IAU 2015 publica
 * `delta_0 = 54,432516` com um termo de amplitude `1,591274°` ao lado, e em
 * J2000 esse termo vale `1,591274 cos(166,32572°) = −1,546`: os 52,886° que
 * toda tabela publica. So a constante deixava o eixo 1,55° fora do lugar.
 * **Netuno e a terceira**, com 0,70° em RA e 0,51° em declinacao.
 *
 * Nenhuma das duas foi encontrada olhando o desenho — 1,5° nao se ve. Foi a
 * conferencia cruzada de `orientacao.test.ts` que as achou, comparando a
 * obliquidade DERIVADA do par (RA, Dec) contra a normal real da orbita com a
 * obliquidade ESCRITA ao lado. Os dois numeros vem da mesma linha deste arquivo
 * e tem de concordar; enquanto ninguem os comparava, discordavam em silencio.
 *
 * ## A armadilha do referencial
 *
 * `alpha_0` e `delta_0` estao no frame **equatorial ICRF**. A simulacao roda no
 * **ecliptico J2000** (`REF_PLANE=ECLIPTIC`, escolhido em `gerar_efemeride.py`).
 * A orientacao e a matriz INTEIRA:
 *
 *     M = Rx(−eps) · Rz(alpha_0 + 90°) · Rx(90° − delta_0) · Rz(W)
 *
 * com `eps = 23,4392911°`. Rodar so o polo deixa o meridiano zero — e portanto
 * a textura — girado. Esquecer o `Rx(−eps)` da planetas com o eixo 23° a mais,
 * um erro que "parece quase certo", que e o pior tipo.
 *
 * ## Aneis: NSSDCA
 *
 * Nao existem no Horizons. Raios em km, do *NASA Space Science Data
 * Coordinated Archive*, ficha de Saturno, convertidos para raios equatoriais
 * (R = 60.268 km) na hora de desenhar.
 */
import manifesto from './texturas.json';
// O JSON cru, e nao `dados/luas.ts`: aquele modulo importa ESTE para a cor e o
// nome, e um ciclo reprovaria em `sem-ciclos` do dependency-cruiser.
import luasBrutas from './luas.json';
import {
  BASE_DA_ECLIPTICA,
  baseDoPlano,
  eixoDeRotacaoSincrona,
  meridianoQueEncaraOPai,
} from '../nucleo/planoDeReferencia.ts';
import { posicaoDaLua } from '../nucleo/luas.ts';
import type { ElementosDeLua } from '../contratos/lua.ts';

interface LuaBruta {
  chave: string;
  plano: string;
  raioMedioKm: number;
  noGraus: number;
  inclinacaoGraus: number;
  taxaSideralMedidaGrausDia: number;
  poloUsado: { ra: number; dec: number };
}

const LUAS_BRUTAS = luasBrutas.luas as unknown as readonly LuaBruta[];

export type Procedencia = 'imagem' | 'derivado' | 'calculado' | 'artistico' | 'decorativo';

export interface MapaDeTextura {
  corpo: string;
  papel: string;
  niveis: Record<string, string>;
  /** OBRIGATORIO. Aparece no bloco de fontes, e um teste confere que aparece. */
  procedencia: Procedencia;
  nota?: string;
  fonte: string;
  url: string;
  licenca: string;
}

export const TEXTURAS = manifesto.mapas as MapaDeTextura[];
export const CREDITO_DAS_TEXTURAS = manifesto.credito_obrigatorio;

export function mapaDe(corpo: string, papel: string): MapaDeTextura | undefined {
  return TEXTURAS.find((m) => m.corpo === corpo && m.papel === papel);
}

export interface Rotacao {
  /** Ascensao reta do polo norte, graus, no frame equatorial ICRF. */
  poloRa: number;
  /** Declinacao do polo norte, graus, no frame equatorial ICRF. */
  poloDec: number;
  /** Meridiano zero na epoca J2000, graus. */
  w0: number;
  /** Graus por dia. Negativo em corpo retrogrado. */
  wPorDia: number;
  /** Obliquidade em relacao a propria orbita, graus. So para mostrar na ficha. */
  obliquidadeGraus: number;
  /**
   * Termos periodicos de E1, que so a Lua tem em magnitude relevante.
   * `E1 = 125,045° − 0,0529921°/dia`, e os coeficientes sao os da IAU.
   * Sem eles o eixo da Lua fica 1,5° errado — ou seja, inteiramente errado.
   */
  e1?: { ra: number; dec: number; w: number };
  /**
   * Termos trigonometricos com argumento PROPRIO, medido em seculos julianos.
   *
   * Convencao da IAU, a mesma do SPICE:
   *     alpha = alpha_0 + SOMA a_i sen(theta_i)
   *     delta = delta_0 + SOMA d_i cos(theta_i)
   *     W     = W_0     + SOMA w_i sen(theta_i)
   * com `theta_i = a0_i + porSeculo_i * T`.
   *
   * **Isto existe porque a mesma armadilha da Lua pegou Marte, e por mais
   * tempo.** O cabecalho deste arquivo ja dizia que os termos periodicos sao
   * desprezados "porque valem muito menos que um pixel", com a Lua declarada
   * como unica excecao. Marte e a segunda, e ninguem tinha reparado: a IAU 2015
   * publica `delta_0 = 54,432516` acompanhado de um termo de amplitude
   * **1,591274°**, e em J2000 esse termo vale `1,591274 * cos(166,32572°) =
   * −1,546`, que devolve os 52,886° classicos. Transcrever so a constante
   * deixava o eixo de Marte 1,55° fora do lugar, e a obliquidade contra a
   * orbita dava 23,92° em vez dos 25,19° que a ficha da NASA publica — foi
   * essa discordancia entre os dois numeros do MESMO corpo que denunciou o erro.
   *
   * Os termos minusculos da serie (10^-5 grau) continuam de fora: eles valem o
   * que o cabecalho diz que valem.
   */
  periodicos?: readonly { a0: number; porSeculo: number; ra?: number; dec?: number; w?: number }[];
}

export interface FaixaDeAnel {
  nome: string;
  rInternoKm: number;
  rExternoKm: number;
  /** Profundidade optica normal tipica. Usada quando nao ha textura de alfa. */
  profundidadeOptica: number;
}

/**
 * O halo de atmosfera no limbo.
 *
 * **E um modelo aproximado, e nao transferencia radiativa.** O que se calcula e
 * o caminho optico atraves de uma casca de espessura `alturaKm`, mais forte na
 * borda do disco — onde a linha de visada atravessa mais ar — e so no lado
 * iluminado. Isso reproduz o que se ve: o arco azul sobre a Terra, o limbo
 * laranja de Titan, a bruma de Venus. O que NAO se calcula e espalhamento
 * multiplo, dependencia de comprimento de onda ou a cor do ceu visto de dentro.
 *
 * A `alturaKm` e a altura de escala da atmosfera, da ficha da NASA — a altura em
 * que a pressao cai por um fator `e`. A `cor` e medida no sentido fraco: ela vem
 * da cor dominante do limbo em imagens publicadas, e nao de um espectro. Por
 * isso ela entra no bloco "o que a tela simplifica", como toda licenca visual
 * deste programa, e `honestidade.test.ts` reprova se sair de la.
 */
export interface Atmosfera {
  /** Altura de escala, em km. Define a espessura da casca desenhada. */
  alturaKm: number;
  /** Cor do halo, linear. Ver a nota sobre procedencia acima. */
  cor: readonly [number, number, number];
  /** Quao opaca a casca fica no limbo, de 0 a 1. Medida no olho, nao no espectro. */
  densidade: number;
}

export interface CorpoVisual {
  chave: string;
  /** Raio equatorial, km. O raio da efemeride e o medio volumetrico. */
  raioEquatorialKm: number;
  /** Achatamento (a−b)/a. Saturno tem 9,8%: da para ver. */
  achatamento: number;
  rotacao: Rotacao;
  /** O halo no limbo. Ausente em corpo sem atmosfera perceptivel. */
  atmosfera?: Atmosfera;
  aneis?: FaixaDeAnel[];
  /** Albedo geometrico, da NASA Planetary Fact Sheet. Modula quanto o corpo reflete. */
  albedoGeometrico: number;
}

export const CORPOS_VISUAIS: Record<string, CorpoVisual> = {
  sol: {
    chave: 'sol',
    raioEquatorialKm: 695700,
    achatamento: 0,
    rotacao: { poloRa: 286.13, poloDec: 63.87, w0: 84.176, wPorDia: 14.1844, obliquidadeGraus: 7.25 },
    albedoGeometrico: 1,
  },
  mercurio: {
    chave: 'mercurio',
    raioEquatorialKm: 2440.53,
    achatamento: 0.0009,
    rotacao: { poloRa: 281.0103, poloDec: 61.4155, w0: 329.5988, wPorDia: 6.1385108, obliquidadeGraus: 0.034 },
    albedoGeometrico: 0.142,
  },
  venus: {
    // A atmosfera de Venus E o que se ve: a superficie nunca aparece. Altura de
    // escala 15,9 km, e a cor amarelo-palida do topo das nuvens de acido
    // sulfurico.
    atmosfera: { alturaKm: 15.9, cor: [1.0, 0.88, 0.62], densidade: 0.95 },
    chave: 'venus',
    raioEquatorialKm: 6051.8,
    achatamento: 0,
    // RETROGRADO: gira ao contrario de todos os outros, e devagar — um dia de
    // Venus dura 243 dias terrestres. O programa antigo so ESCREVIA isso; aqui
    // fica visivel.
    rotacao: { poloRa: 272.76, poloDec: 67.16, w0: 160.2, wPorDia: -1.4813688, obliquidadeGraus: 177.36 },
    albedoGeometrico: 0.689,
  },
  terra: {
    // Altura de escala 8,5 km. O azul e o do espalhamento Rayleigh, que e a
    // razao de o ceu ser azul e de o limbo aparecer como um arco fino.
    atmosfera: { alturaKm: 8.5, cor: [0.33, 0.52, 1.0], densidade: 0.55 },
    chave: 'terra',
    raioEquatorialKm: 6378.137,
    achatamento: 0.0033528,
    rotacao: { poloRa: 0, poloDec: 90, w0: 190.147, wPorDia: 360.9856235, obliquidadeGraus: 23.44 },
    albedoGeometrico: 0.434,
  },
  marte: {
    // Altura de escala 11,1 km — maior que a da Terra, apesar de a atmosfera ser
    // cem vezes mais rarefeita, porque a gravidade e menor. A cor e a da poeira
    // suspensa.
    atmosfera: { alturaKm: 11.1, cor: [0.85, 0.62, 0.45], densidade: 0.3 },
    chave: 'marte',
    raioEquatorialKm: 3396.19,
    achatamento: 0.00589,
    // Os tres termos grandes da serie da IAU 2015. Sem eles o eixo sai 1,55°
    // torto; ver `periodicos` em `Rotacao`. Os argumentos sao os angulos 15, 20
    // e 26 do sistema de Marte (`BODY4_NUT_PREC_ANGLES`), todos com a mesma
    // taxa de 0,5042615°/seculo — a precessao do eixo, de ~71.400 anos.
    rotacao: {
      poloRa: 317.269202,
      poloDec: 54.432516,
      w0: 176.049863,
      wPorDia: 350.891982443297,
      obliquidadeGraus: 25.19,
      periodicos: [
        { a0: 79.398797, porSeculo: 0.5042615, ra: 0.419057 },
        { a0: 166.325722, porSeculo: 0.5042615, dec: 1.591274 },
        { a0: 95.391654, porSeculo: 0.5042615, w: 0.584542 },
      ],
    },
    albedoGeometrico: 0.17,
  },
  jupiter: {
    // Num gigante gasoso nao ha superficie: a casca desenhada e a bruma acima do
    // nivel de 1 bar, que e onde a tabela mede tudo.
    atmosfera: { alturaKm: 27, cor: [0.95, 0.85, 0.72], densidade: 0.4 },
    chave: 'jupiter',
    raioEquatorialKm: 71492,
    achatamento: 0.06487,
    // Sistema III, que e a rotacao do campo magnetico — a unica definicao util
    // para um corpo sem superficie, onde cada latitude gira numa velocidade.
    rotacao: { poloRa: 268.056595, poloDec: 64.495303, w0: 284.95, wPorDia: 870.536, obliquidadeGraus: 3.13 },
    aneis: [
      { nome: 'halo', rInternoKm: 92000, rExternoKm: 122500, profundidadeOptica: 1e-6 },
      { nome: 'principal', rInternoKm: 122500, rExternoKm: 129000, profundidadeOptica: 5e-6 },
      { nome: 'gossamer', rInternoKm: 129000, rExternoKm: 222000, profundidadeOptica: 1e-7 },
    ],
    albedoGeometrico: 0.538,
  },
  saturno: {
    // Altura de escala 59,5 km, a maior dos oito.
    atmosfera: { alturaKm: 59.5, cor: [0.95, 0.88, 0.7], densidade: 0.35 },
    chave: 'saturno',
    raioEquatorialKm: 60268,
    achatamento: 0.09796,
    rotacao: { poloRa: 40.589, poloDec: 83.537, w0: 38.9, wPorDia: 810.7939024, obliquidadeGraus: 26.73 },
    aneis: [
      { nome: 'D', rInternoKm: 66900, rExternoKm: 74510, profundidadeOptica: 0.01 },
      { nome: 'C', rInternoKm: 74658, rExternoKm: 92000, profundidadeOptica: 0.1 },
      { nome: 'B', rInternoKm: 92000, rExternoKm: 117580, profundidadeOptica: 1.5 },
      { nome: 'Divisão de Cassini', rInternoKm: 117580, rExternoKm: 122170, profundidadeOptica: 0.08 },
      { nome: 'A', rInternoKm: 122170, rExternoKm: 136775, profundidadeOptica: 0.6 },
      { nome: 'F', rInternoKm: 140180, rExternoKm: 140680, profundidadeOptica: 0.1 },
    ],
    albedoGeometrico: 0.499,
  },
  urano: {
    // O metano absorve o vermelho, e e isso que deixa o limbo esverdeado.
    atmosfera: { alturaKm: 27.7, cor: [0.6, 0.88, 0.92], densidade: 0.45 },
    chave: 'urano',
    raioEquatorialKm: 25559,
    achatamento: 0.02293,
    // DEITADO: obliquidade de 97,8°, entao ele rola pela orbita em vez de
    // girar como um piao. E retrogrado pela convencao da IAU, que define o
    // norte pelo lado do polo, e nao pelo sentido do giro.
    rotacao: { poloRa: 257.311, poloDec: -15.175, w0: 203.81, wPorDia: -501.1600928, obliquidadeGraus: 97.77 },
    aneis: [
      { nome: 'internos', rInternoKm: 41837, rExternoKm: 50024, profundidadeOptica: 0.3 },
      { nome: 'épsilon', rInternoKm: 51149, rExternoKm: 51249, profundidadeOptica: 1.5 },
    ],
    albedoGeometrico: 0.488,
  },
  netuno: {
    // Mesma quimica de Urano, com mais metano — daí o azul mais fundo.
    atmosfera: { alturaKm: 19.7, cor: [0.42, 0.62, 0.95], densidade: 0.45 },
    chave: 'netuno',
    raioEquatorialKm: 24764,
    achatamento: 0.01708,
    // O termo de N entrou. Ele foi omitido por "valer menos de 1°", e vale 0,70°
    // em RA e 0,51° em declinacao — o bastante para a obliquidade derivada dar
    // 27,85° contra os 28,32° que a tabela publica. Meio grau e pouco para a
    // tela e demais para dois numeros do mesmo corpo discordarem em silencio.
    // `N = 357,85° + 52,316°/seculo`, que e o angulo 1 do sistema de Netuno.
    rotacao: {
      poloRa: 299.36,
      poloDec: 43.46,
      w0: 253.18,
      wPorDia: 536.3128492,
      obliquidadeGraus: 28.32,
      periodicos: [{ a0: 357.85, porSeculo: 52.316, ra: 0.7, dec: -0.51, w: -0.48 }],
    },
    aneis: [
      { nome: 'Galle a Adams', rInternoKm: 41900, rExternoKm: 62933, profundidadeOptica: 0.01 },
    ],
    albedoGeometrico: 0.442,
  },
  lua: {
    chave: 'lua',
    raioEquatorialKm: 1738.1,
    achatamento: 0.0012,
    rotacao: {
      poloRa: 269.9949,
      poloDec: 66.5392,
      w0: 38.3213,
      wPorDia: 13.17635815,
      obliquidadeGraus: 6.68,
      // O 1,5419 aqui e o angulo de Cassini inteiro, e nao uma correcao.
      e1: { ra: -3.8787, dec: 1.5419, w: 3.561 },
    },
    albedoGeometrico: 0.136,
  },
};

/**
 * As doze luas sem ficha propria, DERIVADAS de `luas.json`.
 *
 * **O defeito que isto conserta.** `corpos/fabrica.ts` fazia
 * `CORPOS_VISUAIS[chave] ?? CORPOS_VISUAIS['terra']`, e das treze luas so a
 * nossa tinha entrada aqui. Io, Europa, Ganimedes, Calisto, Encelado, Tita,
 * Fobos, Deimos, Titania, Oberon, Miranda e Tritao eram desenhadas com **a
 * rotacao da Terra** — uma volta por dia sideral, eixo a 23,44° da ecliptica,
 * achatamento e albedo da Terra. A tres pixels de diametro ninguem ve. O
 * defeito ficou anos invisivel e ficaria visivel no instante em que alguem
 * chegasse perto.
 *
 * **Nada aqui e escrito a mao: tudo sai do que o gerador ja mediu.** Sao corpos
 * travados por mare — o periodo de rotacao E o orbital, e o eixo E o polo do
 * plano em que a orbita se assenta. Os dois numeros estao em `luas.json`,
 * medidos contra o Horizons por `ferramentas/gerar_luas.mjs`, com o erro de
 * cada alternativa gravado ao lado. Transcrever de novo, a mao, seria criar uma
 * segunda copia para divergir da primeira.
 *
 * **`w0 = 0` e uma licenca, e esta declarada.** O meridiano zero da maioria
 * destas luas nao esta publicado, e fixa-lo em zero significa que a LONGITUDE
 * desenhada e arbitraria: a textura comeca num lugar escolhido, nao medido. O
 * eixo e o periodo, esses sao medidos. A distincao vai escrita no bloco "o que
 * a tela simplifica" e na ficha de cada lua.
 */
function visuaisDasLuas(): Record<string, CorpoVisual> {
  const saida: Record<string, CorpoVisual> = {};
  const r: [number, number, number] = [0, 0, 0];

  for (const l of LUAS_BRUTAS) {
    // A nossa Lua tem ficha propria, com os termos de E1 que valem a
    // obliquidade inteira dela. Derivar por cima seria perde-los.
    if (l.chave === 'lua') continue;

    const base =
      l.plano === 'ecliptic' ? BASE_DA_ECLIPTICA : baseDoPlano(l.poloUsado.ra, l.poloUsado.dec);

    // O eixo: a normal da ORBITA. Ver `eixoDeRotacaoSincrona` — nao e o polo do
    // planeta, e em Tritao os dois sao quase opostos.
    const eixo = eixoDeRotacaoSincrona(base, l.noGraus, l.inclinacaoGraus);

    // O meridiano zero que encara o planeta na epoca. `posicaoDaLua` devolve a
    // lua RELATIVA ao planeta, entao a direcao para o planeta e o oposto dela.
    posicaoDaLua(l as unknown as ElementosDeLua, base, 0, r);
    const d = Math.hypot(r[0], r[1], r[2]);
    const paraOPai: [number, number, number] = [-r[0] / d, -r[1] / d, -r[2] / d];

    saida[l.chave] = {
      chave: l.chave,
      raioEquatorialKm: l.raioMedioKm,
      // Achatamento zero significa "nao sabemos", e nao "e uma esfera
      // perfeita" — que em Fobos seria falso com folga. Desenhar um
      // achatamento inventado seria pior que nao desenhar.
      achatamento: 0,
      rotacao: {
        poloRa: eixo.ra,
        poloDec: eixo.dec,
        w0: meridianoQueEncaraOPai(eixo.ra, eixo.dec, paraOPai),
        // Positiva por construcao: a normal da orbita e destra com o movimento.
        wPorDia: l.taxaSideralMedidaGrausDia,
        // Zero contra a PROPRIA orbita, que e o que obliquidade quer dizer.
        obliquidadeGraus: 0,
      },
      albedoGeometrico: ALBEDO_DAS_LUAS[l.chave] ?? 0.2,
    };
  }
  return saida;
}

/**
 * Albedo geometrico, das fichas do NSSDCA/JPL. Consultado em 21/09/2026.
 *
 * Entra separado porque e a unica coisa destas luas que NAO esta em
 * `luas.json`: aquele arquivo descreve a orbita, nao a superficie. So alimenta
 * o brilho difuso; nenhum numero da fisica passa por aqui.
 *
 * Encelado passa de 1 e isso nao e erro de digitacao: albedo GEOMETRICO pode
 * exceder a unidade num corpo que espalha de volta na direcao da fonte, e o
 * gelo fresco dos jatos do polo sul dela faz exatamente isso. E a superficie
 * mais reflexiva do Sistema Solar.
 */
const ALBEDO_DAS_LUAS: Record<string, number> = {
  fobos: 0.071,
  deimos: 0.068,
  io: 0.63,
  europa: 0.67,
  ganimedes: 0.43,
  calisto: 0.17,
  encelado: 1.38,
  tita: 0.22,
  titania: 0.35,
  oberon: 0.31,
  miranda: 0.32,
  tritao: 0.76,
};

/**
 * A ficha de quem nao tem ficha: os corpos criados no sandbox.
 *
 * **Neutra, e nao a da Terra.** O padrao anterior era
 * `CORPOS_VISUAIS[chave] ?? CORPOS_VISUAIS['terra']`, e ele dava a um asteroide
 * inventado a rotacao da Terra, a obliquidade da Terra, o achatamento da Terra
 * e — o que ninguem tinha notado — **a atmosfera da Terra**: uma pedra criada
 * no sandbox saia com halo azul de Rayleigh no limbo.
 *
 * Aqui ela nao gira. Um corpo que nao gira parece inerte, que e o que ele e: o
 * programa nao sabe o periodo de rotacao de uma coisa que a pessoa acabou de
 * inventar. Girar uma vez por dia sideral com o eixo a 23,44° seria uma
 * afirmacao, e uma afirmacao falsa.
 */
export const CORPO_GENERICO: CorpoVisual = {
  chave: 'generico',
  raioEquatorialKm: 1,
  achatamento: 0,
  rotacao: { poloRa: 0, poloDec: 90, w0: 0, wPorDia: 0, obliquidadeGraus: 0 },
  albedoGeometrico: 0.1,
};

Object.assign(CORPOS_VISUAIS, visuaisDasLuas());

/** Obliquidade da ecliptica em J2000, graus. Leva o ICRF equatorial para a eclíptica. */
export const OBLIQUIDADE_DA_ECLIPTICA = 23.4392911;

/** Raio equatorial de Saturno, para converter os raios dos anéis. */
export const raioEquatorialUa = (chave: string): number =>
  (CORPOS_VISUAIS[chave]?.raioEquatorialKm ?? 1) / 149597870.7;
