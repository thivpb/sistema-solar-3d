/**
 * Uma frase sobre cada corpo, e os numeros congelados da NASA.
 *
 * **Sao descricoes, nao dados da simulacao.** Distancia, velocidade e periodo
 * na ficha vem sempre do estado calculado na hora; o que esta aqui e o
 * contexto que ajuda a entender o que se esta vendo, mais os numeros que a
 * simulacao nao calcula — massa, gravidade na superficie, temperatura,
 * atmosfera, quantidade de luas.
 *
 * **Nada daqui alimenta o integrador.** A massa em `10^24 kg` existe para
 * aparecer escrita; quem entra na fisica e o GM em UA^3/dia^2, que vem da
 * efemeride. Sao numeros da mesma grandeza medidos por caminhos diferentes, e
 * misturar os dois seria trocar a fonte do resultado sem avisar.
 */

export const FONTE_TABELA = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
export const DATA_DA_TABELA = '18/03/2025';
export const DATA_DA_CONSULTA = '21/09/2026';

export interface Ficha {
  frase: string;
  curiosidade: string;
}

export const FICHAS: Record<string, Ficha> = {
  sol: {
    frase:
      'Concentra 99,8% de toda a massa do Sistema Solar — é a gravidade dele que segura todo o resto.',
    curiosidade:
      'Mesmo assim ele não fica parado: Júpiter o balança o suficiente para que os dois girem em ' +
      'torno de um ponto fora da superfície solar.',
  },
  mercurio: {
    frase: 'O mais próximo do Sol e o mais rápido: completa uma volta em 88 dias.',
    curiosidade:
      'A órbita dele é a mais alongada dos oito. A distância até o Sol varia quase 50% entre o ' +
      'ponto mais próximo e o mais distante.',
  },
  venus: {
    frase: 'O planeta de órbita mais circular — a distância dele ao Sol quase não muda ao longo do ano.',
    curiosidade:
      'Gira ao contrário de todos os outros, e tão devagar que um dia dele dura mais que um ano. ' +
      'Aqui dá para ver: deixe o tempo correr e repare no sentido.',
  },
  terra: {
    frase: 'Leva 365 dias para dar uma volta — é essa volta que define o nosso ano.',
    curiosidade:
      'Na física desta simulação, o ponto que se integra é o centro de massa da Terra e da Lua ' +
      'juntas. Ele fica a uns 4.671 km do centro do planeta, e é por isso que a Terra desenhada ' +
      'não está exatamente sobre ele.',
  },
  marte: {
    frase: 'Leva quase dois anos para dar uma volta no Sol.',
    curiosidade:
      'A órbita é bem alongada: Marte chega a 1,38 UA do Sol e se afasta até 1,67 UA, uma ' +
      'variação de 20%.',
  },
  jupiter: {
    frase: 'O maior planeta: tem mais massa que todos os outros sete somados.',
    curiosidade:
      'É ele quem mais perturba as órbitas dos vizinhos e quem faz o Sol balançar de forma ' +
      'perceptível.',
  },
  saturno: {
    frase: 'Leva cerca de 29 anos para completar uma volta.',
    // REESCRITO: a versão anterior dizia que os anéis "não aparecem aqui".
    curiosidade:
      'Os anéis vão de 1,11 a 2,33 raios do planeta, e o vão escuro no meio é a Divisão de ' +
      'Cassini. Aproxime-se e repare na sombra do planeta caindo sobre eles — e na sombra deles ' +
      'caindo sobre as nuvens.',
  },
  urano: {
    frase: 'Está 19 vezes mais longe do Sol que a Terra e leva 84 anos para dar uma volta.',
    curiosidade:
      'Gira deitado: o eixo dele está a quase 98° do plano da órbita, então ele rola ao longo do ' +
      'caminho em vez de girar como um pião. Foi o primeiro planeta descoberto com telescópio, ' +
      'em 1781.',
  },
  netuno: {
    frase: 'O mais distante dos oito: uma volta leva cerca de 165 anos.',
    curiosidade:
      'Desde que foi descoberto, em 1846, ele completou pouco mais de uma volta em torno do Sol.',
  },
  lua: {
    frase: 'A única lua da Terra, e a maior do Sistema Solar em relação ao planeta que orbita.',
    curiosidade:
      'Mostra sempre a mesma face para nós: o tempo que ela leva para girar em torno do próprio ' +
      'eixo é o mesmo que leva para dar uma volta na Terra.',
  },
  io: {
    frase: 'O corpo com mais vulcões ativos do Sistema Solar.',
    curiosidade:
      'Júpiter e as luas vizinhas a apertam e soltam a cada volta, e é esse amassamento que ' +
      'derrete o interior dela.',
  },
  europa: {
    frase: 'Uma crosta de gelo sobre um oceano de água líquida, maior que todos os da Terra somados.',
    curiosidade: 'A superfície é a mais lisa que se conhece: quase não há crateras.',
  },
  ganimedes: {
    frase: 'A maior lua do Sistema Solar — maior que Mercúrio.',
    curiosidade: 'É a única lua conhecida com campo magnético próprio.',
  },
  calisto: {
    frase: 'A lua mais craterada que se conhece.',
    curiosidade:
      'A superfície dela tem cerca de 4 bilhões de anos e praticamente não mudou desde então.',
  },
  tita: {
    frase: 'A única lua com atmosfera densa, e o único outro lugar com líquido na superfície.',
    curiosidade: 'Os lagos e rios de Titã são de metano e etano, não de água.',
  },
  encelado: {
    frase: 'Pequena e brilhante: reflete quase toda a luz que recebe.',
    curiosidade:
      'Do polo sul saem jatos de água que alimentam um dos anéis de Saturno.',
  },
  fobos: {
    frase: 'A maior das duas luas de Marte, e mesmo assim tem só 22 km de ponta a ponta.',
    curiosidade:
      'Dá uma volta em Marte em 7,6 horas — mais rápido do que Marte gira. Vista de lá, ela ' +
      'nasce no oeste.',
  },
  deimos: {
    frase: 'A menor lua de Marte: 12 km.',
    curiosidade: 'É tão pequena que, da superfície de Marte, mal se distingue de uma estrela.',
  },
  titania: {
    frase: 'A maior lua de Urano.',
    curiosidade: 'Como o planeta gira deitado, a órbita dela também está quase na vertical.',
  },
  oberon: {
    frase: 'A segunda maior lua de Urano, e a mais distante das cinco grandes.',
    curiosidade: 'A superfície escura é coberta de crateras antigas.',
  },
  miranda: {
    frase: 'A menor das cinco luas grandes de Urano, e a mais estranha.',
    curiosidade:
      'Tem um penhasco de 20 km de altura, o mais alto conhecido no Sistema Solar.',
  },
  tritao: {
    frase: 'A maior lua de Netuno — e a única lua grande que orbita ao contrário.',
    curiosidade:
      'Orbitar ao contrário significa que ela não se formou ali: Netuno a capturou. E significa ' +
      'que ela está caindo devagar, e um dia será despedaçada.',
  },
};

export const ficha = (chave: string): Ficha =>
  FICHAS[chave] ?? { frase: '', curiosidade: '' };

export interface DadosDePlaneta {
  massa1e24kg: number;
  /** Aceleração efetiva no equador, m/s². */
  gravidade: number;
  /** Rotação sideral em horas. NEGATIVA em corpo retrógrado. */
  rotacaoH: number;
  diaSolarH: number;
  temperaturaC: number;
  luas: number;
  aneis: boolean;
  atmosfera: string;
  temperaturaReferencia: string;
  fonte: string;
}

function montar(
  massa1e24kg: number,
  gravidade: number,
  rotacaoH: number,
  diaSolarH: number,
  temperaturaC: number,
  luas: number,
  aneis: boolean,
  atmosfera: string,
  slug: string,
): DadosDePlaneta {
  return {
    massa1e24kg,
    gravidade,
    rotacaoH,
    diaSolarH,
    temperaturaC,
    luas,
    aneis,
    atmosfera,
    // Num gigante gasoso nao ha superficie: a temperatura tabelada e a de uma
    // altitude escolhida, e dizer so "temperatura" esconderia isso.
    temperaturaReferencia: aneis
      ? 'medida a 1 bar de pressão na atmosfera — não há superfície sólida ali'
      : 'a média da superfície, da ficha da NASA',
    fonte: `${FONTE_TABELA}${slug}fact.html`,
  };
}

/** A contagem de luas e o retrato da tabela de 18/03/2025, e nao um censo atual. */
export const PLANETAS: Record<string, DadosDePlaneta> = {
  mercurio: montar(0.33, 3.7, 1407.6, 4222.6, 167, 0, false, 'Exosfera muito tênue, com sódio, magnésio e oxigênio.', 'mercury'),
  venus: montar(4.87, 8.9, -5832.5, 2802.0, 464, 0, false, 'Predomina dióxido de carbono (96,5%), seguido de nitrogênio.', 'venus'),
  terra: montar(5.97, 9.8, 23.9, 24.0, 15, 1, false, 'Ar seco: cerca de 78% de nitrogênio e 21% de oxigênio.', 'earth'),
  marte: montar(0.642, 3.7, 24.6, 24.7, -65, 2, false, 'Atmosfera tênue, principalmente dióxido de carbono.', 'mars'),
  jupiter: montar(1898, 23.1, 9.9, 9.9, -108, 95, true, 'Principalmente hidrogênio e hélio; traços de metano.', 'jupiter'),
  saturno: montar(568, 9.0, 10.7, 10.7, -139, 274, true, 'Principalmente hidrogênio e hélio; traços de metano.', 'saturn'),
  urano: montar(86.8, 8.7, -17.2, 17.2, -197, 28, true, 'Hidrogênio e hélio, com metano (cerca de 2,3%).', 'uranus'),
  netuno: montar(102, 11.0, 16.1, 16.1, -201, 16, true, 'Hidrogênio e hélio, com metano (cerca de 1,5%).', 'neptune'),
};
