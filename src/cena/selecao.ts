/**
 * Que corpo esta sob este pixel.
 *
 * **Em espaco de TELA, e nao por raio contra esfera em 3D.** A diferenca nao e
 * de desempenho, e de correcao: os corpos sao desenhados com o raio EXAGERADO
 * — Mercurio a 30 UA tem 2.400 km de raio real e aparece com uns 3 pixels —, e
 * um raio lancado contra a esfera de raio real erraria quase todos os cliques
 * que a pessoa considera acertos. O que se clica e o disco desenhado, e o
 * disco desenhado e o que `projetar` devolve, calculado com as MESMAS matrizes
 * que desenharam o quadro.
 *
 * O mesmo argumento vale para a oclusao: quem esta atras de outro corpo nao e
 * clicavel, e `projetar` ja sabe disso porque os rotulos precisam da mesma
 * informacao.
 */

/** O que `cena.projetar` devolve, reduzido ao que a escolha precisa. */
export interface Alvo {
  chave: string;
  x: number;
  y: number;
  raioPx: number;
  naFrente: boolean;
  ocluido: boolean;
  distanciaUa: number;
}

/**
 * Raio minimo de acerto, em pixels CSS.
 *
 * Doze pixels de raio sao vinte e quatro de diametro, que e o alvo minimo de
 * ponteiro do criterio 2.5.8 da WCAG 2.2. Sem esse piso, escolher Mercurio na
 * visao geral — tres pixels de disco — exigiria precisao de cirurgiao, e a
 * regra "todo gesto de ponteiro tem caminho por teclado" viraria "so o teclado
 * funciona de verdade".
 */
export const ALVO_MINIMO_PX = 12;

/**
 * O corpo sob o ponto, ou nulo.
 *
 * Entre varios acertos ganha aquele cujo CENTRO esta mais perto do clique, em
 * fracao do proprio alvo — e nao o mais perto da camera nem o de disco maior.
 * Corpos escondidos atras de outro so ganham de ninguem.
 */
export function corpoSobOPonto(
  alvos: readonly Alvo[],
  xCss: number,
  yCss: number,
  alvoMinimoPx = ALVO_MINIMO_PX,
): string | null {
  let melhor: { chave: string; nota: number; distanciaUa: number } | null = null;

  for (const a of alvos) {
    if (!a.naFrente) continue;
    const alcance = Math.max(a.raioPx, alvoMinimoPx);
    const d = Math.hypot(a.x - xCss, a.y - yCss);
    if (d > alcance) continue;

    // **A nota e a distancia RELATIVA ao proprio alvo**, e nao a absoluta.
    //
    // Um criterio de "o mais perto da camera ganha" parece certo e nao e: na
    // visao geral os quatro planetas internos cabem dentro do disco do Sol
    // mais o alvo minimo de ponteiro, e clicar em cima da Terra escolhia o
    // Sol — que por acaso estava mais perto. Com a nota relativa, quem tem o
    // centro mais proximo do clique ganha, que e a leitura de quem clicou.
    //
    // Um corpo escondido leva um ponto de penalidade, e com isso perde para
    // QUALQUER corpo visivel que tenha sido atingido: as notas de quem esta a
    // vista ficam todas abaixo de 1. Ele ainda ganha de ninguem, e um clique
    // numa regiao onde so ha corpo escondido nao vira um nada silencioso.
    const nota = d / alcance + (a.ocluido ? 1 : 0);
    if (!melhor || nota < melhor.nota || (nota === melhor.nota && a.distanciaUa < melhor.distanciaUa)) {
      melhor = { chave: a.chave, nota, distanciaUa: a.distanciaUa };
    }
  }
  return melhor?.chave ?? null;
}

/**
 * O ponto do mundo sob o cursor, no plano que passa pelo pivo.
 *
 * E o que o zoom ancorado precisa: para manter fixo o que esta sob o cursor,
 * primeiro e preciso saber o que esta sob o cursor. O plano escolhido e o que
 * passa pelo pivo e e perpendicular a direcao de vista — e a mesma superficie
 * que `larguraVisivelUa` mede, entao o zoom e a leitura do campo de visao
 * falam da mesma coisa.
 */
export function pontoNoPlanoDoPivo(
  olhoUa: readonly [number, number, number],
  direcaoDoCursor: readonly [number, number, number],
  direcaoDeVista: readonly [number, number, number],
  raio: number,
): [number, number, number] | null {
  const cos =
    direcaoDoCursor[0] * direcaoDeVista[0] +
    direcaoDoCursor[1] * direcaoDeVista[1] +
    direcaoDoCursor[2] * direcaoDeVista[2];
  // Perto de zero o raio e quase paralelo ao plano e a interseccao dispara
  // para o infinito. Sem esta guarda, um cursor na borda de um campo de visao
  // largo devolveria uma ancora a unidades astronomicas de distancia.
  if (!(Math.abs(cos) > 0.2)) return null;
  const t = raio / cos;
  return [
    olhoUa[0] + t * direcaoDoCursor[0],
    olhoUa[1] + t * direcaoDoCursor[1],
    olhoUa[2] + t * direcaoDoCursor[2],
  ];
}
