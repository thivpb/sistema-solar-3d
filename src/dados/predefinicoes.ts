/**
 * As cinco predefinicoes do sandbox, com nome escrito.
 *
 * **Ninguem precisa saber o que e GM.** A escolha e por nome — Asteroide,
 * Cometa, Planeta rochoso, Gigante gasoso, Estrela —, e cada uma carrega massa
 * e raio de um objeto de verdade, com a fonte junto. Um campo numerico pedindo
 * "GM em UA^3/dia^2" seria a interface que este projeto existe para nao ter.
 *
 * **Procedencia.** `src/dados/` e definido como fatos congelados COM
 * procedencia, e as cinco linhas seguem a regra: cada uma aponta o corpo real
 * de onde os numeros vieram. "Um asteroide tipico" nao e procedencia; Ceres e.
 *
 * As duas primeiras tem massa EXATAMENTE zero, e isso e uma escolha declarada:
 * a massa de Ceres e 1,6e-19 UA^3/dia^2, ou seja 4,7e-10 da massa do Sol, e
 * arredonda-la para zero muda a trajetoria dos nove corpos validados em
 * exatamente nada — enquanto garante, POR CONSTRUCAO, que criar um asteroide
 * nao possa perturbar a efemeride. `insercaoNaoPerturba.test.ts` exige
 * trajetorias bit a bit identicas, e so massa zero entrega isso.
 */
import type { Predefinicao } from '../contratos/sandbox.ts';

export interface Receita {
  chave: Predefinicao;
  nome: string;
  /** Uma frase dizendo o que e, para quem nunca viu a palavra. */
  descricao: string;
  /** GM em UA^3/dia^2. Zero nas duas primeiras, de proposito. */
  gm: number;
  raioKm: number;
  cor: readonly [number, number, number];
  /** De onde vieram massa e raio. Sem isto, a linha nao entra. */
  fonte: string;
}

const GM_SOLAR = 2.9591220828411951e-4;

export const RECEITAS: readonly Receita[] = [
  {
    chave: 'asteroide',
    nome: 'Asteroide',
    descricao: 'Uma pedra de algumas centenas de quilômetros. Não puxa nada de forma perceptível.',
    gm: 0,
    raioKm: 469.7,
    cor: [150, 142, 130],
    fonte: 'raio médio de Ceres, NASA/NSSDCA. A massa entra como zero — ver o comentário do módulo.',
  },
  {
    chave: 'cometa',
    nome: 'Cometa',
    descricao: 'Um núcleo de gelo e poeira, de poucos quilômetros, em órbita bem alongada.',
    gm: 0,
    raioKm: 5.5,
    cor: [190, 200, 210],
    fonte: 'raio médio do núcleo do 1P/Halley medido pela Giotto, 5,5 km. A massa entra como zero.',
  },
  {
    chave: 'rochoso',
    nome: 'Planeta rochoso',
    descricao: 'Do tamanho da Terra. Massa suficiente para perturbar os vizinhos com o tempo.',
    gm: 8.887692446707102e-10,
    raioKm: 6371.0,
    cor: [140, 160, 190],
    fonte: 'GM e raio da Terra: GMB × EMRAT/(1+EMRAT) do cabeçalho do DE440, e NASA/NSSDCA.',
  },
  {
    chave: 'gasoso',
    nome: 'Gigante gasoso',
    descricao: 'Do tamanho de Júpiter. Move o Sol e desarruma as órbitas em volta.',
    gm: 2.825345825225792e-7,
    raioKm: 69911.0,
    cor: [200, 175, 140],
    fonte: 'GM de sistema de Júpiter (GM5) do cabeçalho do DE440, e raio equatorial NASA/NSSDCA.',
  },
  {
    chave: 'estrela',
    nome: 'Estrela',
    descricao: 'Um décimo do Sol — uma anã vermelha. O Sistema Solar não sobrevive a ela por perto.',
    gm: GM_SOLAR * 0.1,
    raioKm: 695700 * 0.15,
    cor: [255, 190, 140],
    fonte:
      'um décimo da GM solar do DE440; o raio é o de uma anã M de 0,1 massa solar, cerca de 0,15 ' +
      'raio solar (relação massa-raio da sequência principal). É uma escolha declarada, não uma medida.',
  },
];

export const receitaDe = (chave: Predefinicao): Receita => {
  const r = RECEITAS.find((x) => x.chave === chave);
  if (!r) throw new RangeError(`predefinicao desconhecida: ${chave}`);
  return r;
};
