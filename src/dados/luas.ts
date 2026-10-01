/**
 * As treze luas desenhadas, com a procedencia de cada numero.
 *
 * O JSON e gerado por `ferramentas/gerar_luas.mjs` e conferido por
 * `ferramentas/conferir_luas.mjs`. Nenhuma das duas roda em uso normal; o
 * programa nao acessa a internet.
 *
 * **Tres coisas neste arquivo divergem da fonte, e todas vao escritas.**
 *
 *   1. **O polo de Urano sai invertido.** As luas uranianas usam o plano
 *      equatorial do planeta e a tabela deixa as colunas de polo em branco.
 *      Com o polo da IAU (257,311 / −15,175) elas saem retrogradas: medido,
 *      Titania erra 601.748 km contra 814 km com o polo invertido. Urano gira
 *      ao contrario da propria orbita, e o polo "norte" da IAU aponta contra o
 *      momento angular das luas.
 *   2. **A coluna P nao e o periodo sideral de todas.** Em Io a diferenca e de
 *      0,36%, que em um ano vale 270 graus de fase. O periodo usado e MEDIDO,
 *      casando a fase entre duas janelas de vetores do Horizons separadas por
 *      dezesseis anos.
 *   3. **Tres anomalias medias da tabela nao reproduzem a posicao.** Tita e o
 *      caso extremo: a celula diz 11,7 graus e o valor que fecha e 214,8 — a
 *      diferenca de 203 graus poe a lua do outro lado de Saturno, com 2,4
 *      milhoes de km de erro. O valor medido e o usado, e o da tabela fica
 *      gravado ao lado em `anomaliaMediaDaTabelaGraus`.
 */
import bruto from './luas.json' with { type: 'json' };
import efemeride from './efemeride_2026-01-01.json' with { type: 'json' };
import deriva from './derivaDasLuas.json' with { type: 'json' };
import type { BaseDoPlano, ElementosDeLua } from '../contratos/lua.ts';
import { BASE_DA_ECLIPTICA, baseDoPlano } from '../nucleo/planoDeReferencia.ts';

/**
 * Os nomes em portugues.
 *
 * O JSON guarda o nome como o JPL o escreve — Moon, Phobos, Ganymede —, porque
 * ele e transcricao da fonte e transcricao nao se traduz. O que aparece na
 * tela e outra coisa, e o projeto inteiro e em portugues.
 */
const NOMES: Record<string, string> = {
  lua: 'Lua', fobos: 'Fobos', deimos: 'Deimos', io: 'Io', europa: 'Europa',
  ganimedes: 'Ganimedes', calisto: 'Calisto', encelado: 'Encélado', tita: 'Titã',
  titania: 'Titânia', oberon: 'Oberon', miranda: 'Miranda', tritao: 'Tritão',
};

export const EPOCA_DAS_LUAS_JD = bruto.epoca.jd;

/**
 * A razao entre a massa da Terra e a da Lua, do cabecalho do DE440.
 *
 * Vem da efemeride, e nao da tabela de parametros fisicos das luas, porque e
 * ela que define o baricentro que o integrador move. Os dois numeros divergem
 * em 2,4e-8 — vinte e quatro mil vezes mais que o fechamento exigido —, e usar
 * o outro poria o centro da Terra a um centesimo de milimetro do lugar certo
 * enquanto quebraria a identidade que mantem a massa do par exata.
 */
export const EMRAT = efemeride.constantes_de440.EMRAT;
export const FONTES_DAS_LUAS = bruto.fontes;

export interface LuaCompleta extends ElementosDeLua {
  /** Como a fonte a chama. Fica gravado para que a procedência case. */
  nomeNaFonte: string;
  base: BaseDoPlano;
  /** O maior desvio medido contra o Horizons na janela retida, em km. */
  erroMaximoKm: number;
}

/**
 * As bases sao calculadas UMA vez, na carga.
 *
 * Elas nao mudam: dependem so do polo, que e constante no modelo. Recalcular
 * por quadro custaria treze senos e treze cossenos para chegar ao mesmo lugar.
 */
export const LUAS: readonly LuaCompleta[] = bruto.luas.map((l) => {
  const erro = deriva.luas.find((d) => d.chave === l.chave);
  if (!erro) throw new Error(`${l.chave} nao tem erro medido em derivaDasLuas.json`);
  return {
    chave: l.chave,
    nome: NOMES[l.chave] ?? l.nome,
    nomeNaFonte: l.nome,
    pai: l.pai,
    plano: l.plano,
    aKm: l.aKm,
    excentricidade: l.excentricidade,
    inclinacaoGraus: l.inclinacaoGraus,
    noGraus: l.noGraus,
    periastroGraus: l.periastroGraus,
    anomaliaMediaGraus: l.anomaliaMediaGraus,
    taxaDoNoGrausDia: l.taxaDoNoGrausDia,
    taxaDoPeriastroGrausDia: l.taxaDoPeriastroGrausDia,
    taxaDaAnomaliaMediaGrausDia: l.taxaDaAnomaliaMediaGrausDia,
    taxaSideralMedidaGrausDia: l.taxaSideralMedidaGrausDia,
    raioMedioKm: l.raioMedioKm,
    gmUa3Dia2: l.gmUa3Dia2,
    poloUsado: l.plano === 'ecliptic' ? null : l.poloUsado,
    base: l.plano === 'ecliptic' ? BASE_DA_ECLIPTICA : baseDoPlano(l.poloUsado.ra, l.poloUsado.dec),
    erroMaximoKm: erro.erroMaximoKm,
  };
});

/** O pior desvio entre as treze. Vai escrito no bloco de honestidade. */
export const PIOR_DESVIO = deriva.pior;
export const JANELA_DA_CONFERENCIA = deriva.janela;

export const luasDe = (pai: string): readonly LuaCompleta[] => LUAS.filter((l) => l.pai === pai);
