/**
 * Onde cada nome cabe sem cobrir outro.
 *
 * Porte do algoritmo de `src/projecao/rotulos.py`, que parece trivial e nao e.
 * Tres coisas nele foram descobertas por uso, e todas sobrevivem aqui:
 *
 * 1. **Histerese.** Tenta primeiro a direcao do quadro anterior. Sem isso os
 *    nomes trocam de lado toda vez que dois planetas se cruzam, e a tela fica
 *    piscando. O teste da versao anterior limitava a 2 trocas de direcao em 40
 *    quadros — sem histerese eram dezenas.
 * 2. **Os retangulos da interface sao obstaculos.** A barra lateral entra na
 *    lista de ocupados, entao o nome de Netuno nunca e desenhado por baixo dela.
 * 3. **Escada de abreviacao.** Nome inteiro, depois abreviado, depois so o
 *    ponto. O corpo SELECIONADO nunca e abreviado: se alguem escolheu ver
 *    aquele, e o nome dele que precisa caber.
 *
 * Uma quarta entra so no 3D: **banda morta de movimento**. Enquanto a camera
 * gira depressa, a escolha de direcao fica CONGELADA e os rotulos apenas
 * reancoram. Quem gira a camera esta olhando o movimento, nao lendo nomes — e
 * resolver de novo a cada quadro durante um giro produz um formigueiro.
 */
export interface Candidato {
  chave: string;
  nome: string;
  abreviacao: string;
  /** Posicao na tela, em pixels CSS. */
  x: number;
  y: number;
  /** Raio aparente do corpo, em pixels. O rotulo comeca fora dele. */
  raioPx: number;
  /** Maior e melhor: acompanhado > A > B > mais proximo > maior. */
  prioridade: number;
  ocluido: boolean;
  /** O selecionado nunca e abreviado. */
  nuncaAbreviar: boolean;
  /**
   * O papel do corpo agora: escolhido como A, como B, ou acompanhado.
   *
   * Vai ESCRITO na placa — "A", "B" — e o acompanhado ganha um anel
   * tracejado. Nunca so por cor: a regra vale aqui como vale na lista.
   */
  papel: Papel | null;
}

/** O que distingue um corpo dos outros neste instante. */
export type Papel = 'a' | 'b' | 'acompanhado';

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export type Forma = 'inteiro' | 'abreviado' | 'ponto';

export interface RotuloColocado {
  chave: string;
  texto: string;
  forma: Forma;
  papel: Papel | null;
  /** Raio do corpo na tela, em pixels. O anel do acompanhado desenha por ele. */
  raioPx: number;
  /** Centro do corpo na tela. O anel e centrado aqui, e nao na placa. */
  centroX: number;
  centroY: number;
  /** Canto superior esquerdo da placa, em pixels CSS. */
  x: number;
  y: number;
  largura: number;
  altura: number;
  ocluido: boolean;
}

/** Oito direcoes em volta do corpo, na ordem de preferencia. */
const DIRECOES: readonly (readonly [number, number])[] = [
  [1, 0], [1, -1], [1, 1], [-1, 0], [-1, -1], [-1, 1], [0, -1], [0, 1],
];

/** Sete empurroes verticais, do menor para o maior, alternando o lado. */
const EMPURROES = [0, -1, 1, -2, 2, -3, 3];

const FOLGA = 4;

function colide(a: Retangulo, b: Retangulo): boolean {
  return (
    a.x < b.x + b.largura && a.x + a.largura > b.x && a.y < b.y + b.altura && a.y + a.altura > b.y
  );
}

export interface Opcoes {
  larguraTela: number;
  alturaTela: number;
  alturaDoTexto: number;
  /** Retangulos da interface. Nenhum rotulo e colocado sobre eles. */
  obstaculos: readonly Retangulo[];
  medir: (texto: string) => number;
  /** Direcao escolhida no quadro anterior, por chave. A histerese vive aqui. */
  memoria: Map<string, number>;
  /** Acima deste valor a escolha de direcao fica congelada. Radianos por segundo. */
  camaraGirandoRapido: boolean;
  /** No maximo este tanto de rotulos. Mais que isso ninguem le. */
  teto: number;
}

export function colocar(candidatos: readonly Candidato[], opcoes: Opcoes): RotuloColocado[] {
  const { larguraTela: L, alturaTela: A, alturaDoTexto: H } = opcoes;

  // Fora da tela nao entra na disputa.
  const visiveis = candidatos
    .filter((c) => c.x > -50 && c.x < L + 50 && c.y > -50 && c.y < A + 50)
    .sort((a, b) => b.prioridade - a.prioridade)
    .slice(0, opcoes.teto);

  const ocupados: Retangulo[] = [...opcoes.obstaculos];
  const saida: RotuloColocado[] = [];

  for (const c of visiveis) {
    // Um corpo com papel nunca vira ponto: o distintivo "A" precisa de placa
    // para caber escrito, e um ponto de seis pixels nao carrega palavra
    // nenhuma. Se nao couber inteiro, cabe abreviado.
    const formas: { forma: Forma; texto: string }[] = c.nuncaAbreviar
      ? [{ forma: 'inteiro', texto: c.nome }]
      : c.papel
        ? [
            { forma: 'inteiro', texto: c.nome },
            { forma: 'abreviado', texto: c.abreviacao },
          ]
        : [
            { forma: 'inteiro', texto: c.nome },
            { forma: 'abreviado', texto: c.abreviacao },
            { forma: 'ponto', texto: '' },
          ];

    // Histerese: a direcao do quadro anterior vem primeiro. Durante um giro
    // rapido ela e a UNICA tentada — os rotulos so reancoram.
    const lembrada = opcoes.memoria.get(c.chave);
    const ordem =
      lembrada === undefined
        ? DIRECOES.map((_, i) => i)
        : [lembrada, ...DIRECOES.map((_, i) => i).filter((i) => i !== lembrada)];
    const direcoes = opcoes.camaraGirandoRapido && lembrada !== undefined ? [lembrada] : ordem;

    let colocado: RotuloColocado | null = null;

    for (const { forma, texto } of formas) {
      const largura = forma === 'ponto' ? 6 : opcoes.medir(texto) + 10;
      const altura = forma === 'ponto' ? 6 : H + 6;
      const afastamento = c.raioPx + 6;

      for (const iDir of direcoes) {
        const [dx, dy] = DIRECOES[iDir]!;
        for (const empurrao of EMPURROES) {
          const x = c.x + dx * afastamento - (dx < 0 ? largura : 0) - (dx === 0 ? largura / 2 : 0);
          const y = c.y + dy * afastamento + empurrao * (altura + FOLGA) - altura / 2;
          const r: Retangulo = { x, y, largura, altura };
          if (x < 0 || y < 0 || x + largura > L || y + altura > A) continue;
          if (ocupados.some((o) => colide(r, o))) continue;

          opcoes.memoria.set(c.chave, iDir);
          colocado = {
            chave: c.chave,
            texto,
            forma,
            papel: c.papel,
            raioPx: c.raioPx,
            centroX: c.x,
            centroY: c.y,
            x,
            y,
            largura,
            altura,
            ocluido: c.ocluido,
          };
          ocupados.push(r);
          break;
        }
        if (colocado) break;
      }
      if (colocado) break;
    }

    if (colocado) saida.push(colocado);
  }

  return saida;
}

/** "Mercúrio" -> "Mer.". A escada tem so um degrau, e e o bastante. */
export function abreviar(nome: string): string {
  if (nome.length <= 4) return nome;
  return `${nome.slice(0, 3)}.`;
}
