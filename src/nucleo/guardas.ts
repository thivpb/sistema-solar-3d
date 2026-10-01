/**
 * O que impede o sandbox de produzir orbita-lixo.
 *
 * Um corpo criado a 0,1 UA do Sol tem periodo de 11,55 dias. Com passo de meio
 * dia sao 23 passos por orbita, e nesse regime o Yoshida4 nao integra nada:
 * produz uma orbita que precessa e decai. E exatamente o "a orbita continua
 * bonita e fica errada" que o simulador declara como o pecado do projeto — e e
 * o mesmo argumento pelo qual a Lua NAO entra no integrador.
 *
 * Oferecer em silencio um gesto que produz orbitas piores que a da Lua seria
 * incoerente. Entao a criacao e recusada por escrito, com a alternativa junto.
 *
 * **A guarda e sobre o PERIASTRO, nao sobre a distancia no momento do clique.**
 * Perto da velocidade de escape o periastro despenca mesmo com o apoastro
 * grande: um corpo largado a 5 UA com velocidade quase radial passa raspando
 * no Sol, e no instante do clique ele parecia inofensivo.
 */
import { PASSO_CURTO_DIAS, PASSO_PADRAO_DIAS } from './integrador.ts';
import type { ElementosOsculadores } from './efemerides.ts';

/**
 * Minimo de passos por orbita que se aceita. Abaixo disso o erro de
 * truncamento deixa de ser detalhe e vira a forma da orbita.
 */
export const PASSOS_MINIMOS_POR_ORBITA = 40;

/**
 * O veredito e um FATO, nao uma frase.
 *
 * A primeira versao deste modulo montava a mensagem aqui dentro — e saiu com
 * "11.6 dias", com ponto decimal, porque o nucleo nao tem por que saber como se
 * escreve um numero em portugues. Nao e so o ponto: o projeto inteiro mantem
 * toda string de interface num arquivo so, `dados/textos.ts`, justamente para
 * poder ler tudo de uma vez e conferir se a linguagem esta acessivel. Uma
 * frase escondida na fisica escapa dessa revisao.
 *
 * Entao aqui saem os numeros, e a interface compoe a frase.
 */
export type Veredito =
  | { aceito: true }
  | {
      aceito: false;
      /** Qual das duas contas reprovou. A interface escreve frases diferentes. */
      razao: 'poucos-passos-por-volta' | 'periastro-rapido-demais';
      /** Quanto dura uma volta, em dias. A interface decide se escreve em horas. */
      periodoDias: number;
      /** Distancia do ponto mais proximo do Sol, em UA. */
      perielioUa: number;
      /** Quantos pontos de integracao caberiam numa volta com o passo atual. */
      passosPorVolta: number;
      /** Quantos caberiam na passagem pelo periastro. E este que costuma reprovar. */
      passosNoPeriastro: number;
      /** Passo que resolveria, ou null quando nem o curto resolve. */
      passoSugeridoDias: number | null;
    };

export function passosPorOrbita(periodoDias: number, dtDias: number): number {
  return periodoDias / Math.abs(dtDias);
}

/**
 * O tempo orbital LOCAL na passagem pelo periastro: `2*pi*sqrt(q^3/mu)`.
 *
 * **E este o numero que decide, e nao o periodo.** O periodo depende so do
 * semieixo maior, nunca da excentricidade. Numa orbita bem alongada `a` fica
 * grande — o corpo passa quase todo o tempo longe —, o periodo fica longo, e a
 * conta de "passos por volta" da um numero enorme e tranquilizador. So que a
 * passagem pelo periastro, que e exatamente onde o integrador quebra, dura
 * horas.
 *
 * Medido: um corpo largado a 5 UA com 10% da velocidade circular tem
 * a = 2,51 UA, e = 0,990, periodo de 1.455 dias — 2.909 passos por volta, que
 * a versao anterior desta guarda ACEITAVA. O tempo no periastro e de 1,46 dia,
 * ou 2,9 passos, e depois de uma volta o corpo esta expulso do sistema, com
 * `a = Infinity`. Sem NaN, sem aviso: o "a orbita continua bonita e fica
 * errada" literal.
 */
export function passosNoPeriastro(perielioUa: number, mu: number, dtDias: number): number {
  if (!(perielioUa > 0) || !(mu > 0)) return Infinity;
  return (2 * Math.PI * Math.sqrt(perielioUa ** 3 / mu)) / Math.abs(dtDias);
}

/**
 * Diz se um corpo com estes elementos pode ser integrado com este passo.
 *
 * `mu` e `GM_sol + GM_corpo`, o mesmo que `elementosOsculadores` usou — sem
 * ele nao ha como converter periastro em tempo.
 */
export function avaliarCriacao(
  elementos: ElementosOsculadores,
  mu: number,
  dtDias = PASSO_PADRAO_DIAS,
): Veredito {
  // Uma hiperbole nao tem periodo, mas PODE ter periastro minusculo — e ai o
  // corpo nao "so vai embora": ele vai embora por um caminho que o integrador
  // inventou. Medido num caso quase radial: dE/E = 1,5e3 em 2.000 dias.
  const noPeriastro = passosNoPeriastro(elementos.perielio, mu, dtDias);
  const naVolta = elementos.ligada ? passosPorOrbita(elementos.periodoDias, dtDias) : Infinity;
  const passos = Math.min(noPeriastro, naVolta);

  if (!Number.isFinite(passos) || passos >= PASSOS_MINIMOS_POR_ORBITA) return { aceito: true };

  const noPeriastroCurto = passosNoPeriastro(elementos.perielio, mu, PASSO_CURTO_DIAS);
  const naVoltaCurto = elementos.ligada
    ? passosPorOrbita(elementos.periodoDias, PASSO_CURTO_DIAS)
    : Infinity;
  const cabeNoPassoCurto = Math.min(noPeriastroCurto, naVoltaCurto) >= PASSOS_MINIMOS_POR_ORBITA;

  return {
    aceito: false,
    razao: noPeriastro < naVolta ? 'periastro-rapido-demais' : 'poucos-passos-por-volta',
    periodoDias: elementos.periodoDias,
    perielioUa: elementos.perielio,
    passosPorVolta: naVolta,
    passosNoPeriastro: noPeriastro,
    passoSugeridoDias: cabeNoPassoCurto ? PASSO_CURTO_DIAS : null,
  };
}

// -- a guarda de vizinhanca --------------------------------------------------

/**
 * A separacao minima que um corpo precisa guardar de outro, em UA.
 *
 * O criterio e o MESMO do periastro, aplicado ao vizinho: o tempo orbital
 * local em torno dele, `2*pi*sqrt(d^3/gm)`, tem de caber em pelo menos
 * `PASSOS_MINIMOS_POR_ORBITA` passos. Invertendo:
 *
 *     d_min = (gm * (N*dt / 2*pi)^2)^(1/3)
 *
 * **A conta usa a GM DO VIZINHO, e nunca a soma das duas.** A diferenca
 * importa e nao e sutil: as predefinicoes "Asteroide" e "Cometa" tem massa
 * EXATAMENTE zero, e uma formula com `mu = gm_i + gm_j` daria `d_min = 0` para
 * um par delas — a guarda aceitaria dois corpos sobrepostos. Com a GM do
 * vizinho, esse par realmente nao tem restricao nenhuma, e esta certo: dois
 * corpos sem massa nao se puxam, e encostar um no outro nao produz aceleracao
 * nenhuma. O que a guarda precisa impedir e chegar perto de quem TEM massa.
 *
 * Sem ela, um corpo criado em cima de Jupiter gera `1/r^3 = Infinity` no
 * primeiro passo, e o NaN contamina os nove corpos validados num unico quadro
 * — sem colisao, sem aviso, sem como desfazer.
 */
export function separacaoMinima(gmDoVizinho: number, dtDias = PASSO_PADRAO_DIAS): number {
  if (!(gmDoVizinho > 0)) return 0;
  return Math.cbrt(gmDoVizinho * ((PASSOS_MINIMOS_POR_ORBITA * Math.abs(dtDias)) / (2 * Math.PI)) ** 2);
}

export type VereditoDeVizinhanca =
  | { aceito: true }
  | {
      aceito: false;
      /** Indice do corpo de quem se chegou perto demais. */
      vizinho: number;
      distanciaUa: number;
      minimaUa: number;
    };

/**
 * Diz se ha espaco para um corpo novo nesta posicao.
 *
 * Percorre todos os corpos com massa e devolve o PIOR caso — o que estiver
 * proporcionalmente mais perto do proprio minimo. Devolver o primeiro que
 * reprova daria uma mensagem que muda com a ordem do catalogo.
 */
export function avaliarVizinhanca(
  estado: { pos: Float64Array; gm: Float64Array; n: number },
  pos: readonly [number, number, number],
  dtDias = PASSO_PADRAO_DIAS,
  ignorar = -1,
): VereditoDeVizinhanca {
  let pior: { vizinho: number; distanciaUa: number; minimaUa: number; folga: number } | null = null;
  for (let j = 0; j < estado.n; j++) {
    if (j === ignorar) continue;
    const minima = separacaoMinima(estado.gm[j]!, dtDias);
    if (minima <= 0) continue;
    const d = Math.hypot(
      pos[0] - estado.pos[3 * j]!,
      pos[1] - estado.pos[3 * j + 1]!,
      pos[2] - estado.pos[3 * j + 2]!,
    );
    const folga = d / minima;
    if (folga < 1 && (!pior || folga < pior.folga)) {
      pior = { vizinho: j, distanciaUa: d, minimaUa: minima, folga };
    }
  }
  return pior ? { aceito: false, ...pior } : { aceito: true };
}

/**
 * Teto de corpos criados.
 *
 * O custo por quadro cresce como n² em tres lugares ao mesmo tempo — o laco de
 * forcas, esta guarda e as distancias da cena. Sem teto, algumas centenas de
 * cliques derrubam a taxa de quadros, a calibragem corta a escada de
 * velocidade, e nada na tela liga uma coisa a outra.
 *
 * Quarenta e o numero que mantem o pior caso em 1.176 pares, que e menos de um
 * decimo do orcamento de um quadro na maquina mais modesta que o projeto mede.
 */
export const MAXIMO_DE_CORPOS_CRIADOS = 40;
