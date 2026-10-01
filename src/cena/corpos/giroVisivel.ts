/**
 * Quanto do giro real de um corpo cabe num quadro.
 *
 * ## O defeito, medido na tela
 *
 * A escada de velocidade vai a 30 dias por segundo. Marte dá uma volta em 1,026
 * dia, então a 30 d/s ele dá **29 voltas por segundo** — e a tela tem sessenta
 * quadros. Entre um quadro e o outro o planeta gira 175°: praticamente meia
 * volta. Isso não é rotação rápida, é *aliasing*: a superfície vira um
 * serrilhado que pisca, e dois quadros seguidos mostram lados opostos do
 * planeta. De longe ninguém vê, porque o disco tem três pixels. Com o zoom —
 * que virou o gesto central do programa — ele ocupa oitenta por cento da tela,
 * e a textura de 8K que o programa carregou para ser vista fica ilegível.
 *
 * ## A regra: um teto em PIXELS por quadro, e não em graus
 *
 * O que estraga a imagem não é a taxa angular, é quanto a superfície ANDA NA
 * TELA entre dois quadros. O mesmo giro é invisível num disco de três pixels e
 * um borrão num disco de seiscentos. Então o teto é medido onde o defeito
 * mora:
 *
 *     pixels = |ΔW| · (π/180) · raioEmPixels
 *
 * e o giro desenhado é reduzido pelo fator que traz esse número para o teto.
 *
 * Duas consequências que valem por si:
 *
 *   - **Um corpo pequeno nunca é amortecido.** Abaixo de `RAIO_MINIMO_PX` o
 *     fator é exatamente 1. A vista geral, que é onde todas as imagens douradas
 *     e o teste de precisão moram, continua byte por byte o que era.
 *   - **Parado, nada acontece.** Com a simulação pausada `ΔW` é zero, o fator é
 *     1 e não há o que amortecer. Os testes que pausam antes de fotografar não
 *     veem diferença nenhuma.
 *
 * ## O que isto custa, e por que vai declarado
 *
 * O meridiano desenhado passa a ATRASAR em relação ao real, e o atraso não
 * volta sozinho: depois de olhar Marte de perto por um minuto a 30 d/s, a
 * longitude desenhada está anos-luz — literalmente, anos de rotação — atrás da
 * que a IAU daria para aquela data. O EIXO continua certo, a inclinação
 * continua certa, o terminador continua geometricamente certo; o que fica
 * errado é *qual* meridiano está de frente.
 *
 * É licença visual, tem entrada nomeada no bloco "o que a tela simplifica" e é
 * amarrada por `honestidade.test.ts`. "Voltar ao início" zera o atraso, como
 * zera todo o resto.
 */

/**
 * Quantos pixels a superfície pode andar entre dois quadros.
 *
 * **Medido, e não escolhido.** A 60 Hz, 1,5 px por quadro são 90 px por segundo
 * de deriva na tela — movimento que o olho lê como movimento, e não como
 * tremor. Acima de uns 3 px por quadro a textura começa a cintilar mesmo com
 * mipmap e anisotropia; abaixo de 1 px o giro deixa de ser perceptível e o
 * planeta parece congelado, que é o outro defeito.
 */
export const PIXELS_POR_QUADRO = 1.5;

/**
 * Abaixo deste raio aparente o corpo é um ponto, e um ponto não tem textura
 * para borrar. O fator é exatamente 1 — sem amortecimento, sem atraso, sem
 * diferença nenhuma em relação ao programa de antes.
 *
 * Oito pixels é o disco a partir do qual `posicionador.ts` já considera que há
 * o que rotular; é o mesmo limiar de "dá para ver que é um corpo".
 */
export const RAIO_MINIMO_PX = 8;

/**
 * O fator pelo qual multiplicar o giro real, de 0 (congelado) a 1 (intacto).
 *
 * Pura: sem estado, sem tempo, sem `three`. Quem integra o atraso é a cena.
 */
export function amortecimentoDoGiro(deltaWGraus: number, raioEmPixels: number): number {
  if (!(raioEmPixels > RAIO_MINIMO_PX)) return 1;
  const pixels = Math.abs(deltaWGraus) * (Math.PI / 180) * raioEmPixels;
  if (!(pixels > PIXELS_POR_QUADRO)) return 1;
  return PIXELS_POR_QUADRO / pixels;
}
