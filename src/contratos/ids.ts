/**
 * Tipos que TODA camada pode ver, e que NENHUMA camada importa de volta.
 *
 * Esta pasta existe por um motivo estrutural: se `Instantaneo` morasse em
 * `src/app/`, a regra "a cena nao importa app" teria de ser liberada para a
 * cena poder desenhar — e com ela entrariam `acoes.ts` e `aplicar.ts`. Essa e
 * a porta pela qual "a cena abre um modal" e "a cena despacha uma acao"
 * entram. O teste antigo em Python proibia `src/projecao -> src.app`
 * exatamente por isso.
 */

/** Chave estavel de um corpo. E a mesma do catalogo, do tema e dos textos. */
export type IdCorpo = string;

/**
 * Como um corpo entra na simulacao. A distincao e fisica, nao cosmetica.
 *
 *   dinamico    entra no integrador N-corpos e puxa todo mundo. Sao o Sol e os
 *               oito baricentros planetarios — a camada validada contra o JPL.
 *   cinematico  a posicao vem de um modelo analitico, nao da integracao. Sao as
 *               luas e o centro da Terra. Nao puxam nada e nao sao puxados.
 *   teste       corpos criados no sandbox. Entram no integrador, mas sua
 *               presenca significa que o sistema deixou de ser o do JPL.
 */
export type Papel = 'dinamico' | 'cinematico' | 'teste';

/** Identidade fisica de um corpo: o que ele e, nao onde ele esta. */
export interface Corpo {
  readonly chave: IdCorpo;
  readonly nome: string;
  readonly papel: Papel;
  /** UA^3/dia^2 */
  readonly gm: number;
  /** Raio medio volumetrico real, em km. A tela desenha ampliado, e diz que ampliou. */
  readonly raioKm: number;
  readonly idHorizons: string;
  /**
   * Verdadeiro quando o ponto simulado e o baricentro de um sistema planetario,
   * e nao o centro do planeta. Vale para os oito, e so importa de verdade para
   * a Terra: o baricentro Terra-Lua fica a ~4.671 km do centro do planeta.
   */
  readonly eBaricentro: boolean;
}

/**
 * Vocabulario que a cena E o app precisam nomear.
 *
 * Moram aqui pelo mesmo motivo que `IdCorpo`: `enquadramento.ts` precisa saber
 * o que e um modo de camera, e se ele importasse isso de `app/acoes.ts` a
 * regra "a cena nao ve o app" cairia — e com ela entrariam o reducer e as
 * acoes. O lint de arquitetura pegou exatamente essa importacao e foi assim
 * que estes tipos vieram parar aqui.
 */
export type Modo = 'sistema' | 'internos' | 'acompanhar' | 'perto';

export type Vista = 'perspectiva' | 'ortografica';

export type EscalaVisual = 'real' | 'maquete';

/**
 * O quanto as luas participam da tela.
 *
 * Nao e um booleano porque as tres respostas uteis nao sao duas. "Sem" limpa a
 * cena para olhar o sistema; "so" faz das luas o assunto, e e a resposta para
 * quem chegou perto de Jupiter e quer ver as quatro, nao o disco de Jupiter.
 *
 * O que "so" NAO faz e apagar os planetas. Uma lua desenhada sem o corpo que
 * ela orbita nao diz em torno de que ela gira — seria uma tela mais limpa
 * dizendo menos. Ela muda quem ganha nome e quem ganha caminho desenhado.
 */
export type VisibilidadeDasLuas = 'com' | 'sem' | 'so';

/** O que a pessoa esta fazendo: olhando, mexendo, ou voando. */
export type ModoDeUso = 'explorar' | 'criar' | 'voar';
