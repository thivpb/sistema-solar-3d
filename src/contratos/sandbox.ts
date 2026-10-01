/**
 * O sandbox, como dado.
 *
 * Mora em `contratos/` e nao em `app/` pelo mesmo motivo que `Instantaneo`: a
 * cena precisa saber que predefinicao um corpo tem para escolher a cor, e
 * `src/dados/predefinicoes.ts` precisa do mesmo tipo. Se `Predefinicao`
 * morasse em `app/acoes.ts`, os dois teriam de importar de la — e as regras
 * `cena-nao-ve-app` e `dados-nao-ve-a-tela` do dependency-cruiser proibem
 * isso INCLUSIVE para `import type`. So `nucleo-isolado` abre excecao para
 * tipo puro; as outras seis nao, e o lint quebraria.
 */
export type Predefinicao = 'asteroide' | 'cometa' | 'rochoso' | 'gasoso' | 'estrela';

export const PREDEFINICOES: readonly Predefinicao[] = [
  'asteroide',
  'cometa',
  'rochoso',
  'gasoso',
  'estrela',
];

/**
 * Um corpo criado por quem usa o programa.
 *
 * `criadoEm` guarda o dia simulado da criacao — nao a hora do relogio. E o que
 * permite a ficha dizer "criado no dia 1.234 da simulacao" sem depender de
 * quando a pessoa estava sentada ali.
 */
export interface CorpoCriado {
  chave: string;
  nome: string;
  predefinicao: Predefinicao;
  criadoEmDiaSimulado: number;
}
