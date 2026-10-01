/**
 * A rotação desenhada cabe no quadro — e continua existindo.
 *
 * ## O defeito, em números
 *
 * A escada de tempo vai a 30 dias por segundo. Marte dá uma volta em 1,026 dia,
 * logo 29 voltas por segundo, contra sessenta quadros: 175° de giro entre um
 * quadro e o outro, praticamente meia volta. Dois quadros seguidos mostram
 * lados opostos do planeta. De longe o disco tem três pixels e ninguém vê; com
 * o zoom ele ocupa oitenta por cento da tela, e a textura de 8K que o programa
 * carregou para ser vista vira um serrilhado que pisca.
 *
 * ## O que se mede aqui
 *
 * O deslocamento de um ponto da superfície entre dois quadros, em PIXELS, que é
 * onde o defeito mora — o mesmo giro é invisível num disco de três pixels e um
 * borrão num de seiscentos. E, do outro lado, que o corpo não ficou congelado:
 * um teto que zera a rotação troca um defeito por outro.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

/**
 * Para onde aponta um PONTO DA SUPERFÍCIE, depois da orientação desenhada.
 *
 * O ponto é o meridiano zero no equador — `(1, 0, 0)` no referencial do corpo —
 * girado pelo quaternion que a cena aplicou à malha.
 *
 * **Medir o ângulo do quaternion não serve, e a primeira versão deste arquivo
 * fez isso.** `2·acos(|w|)` é a rotação total desde a identidade, e ela inclui
 * a parte fixa: o polo e a obliquidade. Conforme `W` avança, esse ângulo
 * oscila dentro de uma faixa estreita em vez de varrer meia volta — então, com
 * o teto de giro desligado, o número continuava pequeno e o teste passava
 * verde medindo a inclinação do eixo em vez do giro. Um vetor da superfície não
 * tem esse buraco: ele anda exatamente o que a superfície anda.
 */
const pontoDoMeridiano = (p: Page, chave: string): Promise<number[] | null> =>
  p.evaluate((c) => {
    const q = window.__orientacaoDe?.(c);
    if (!q) return null;
    const [x, y, z, w] = q;
    // (1,0,0) girado pelo quaternion — a primeira coluna da matriz de rotação.
    return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)];
  }, chave);

/** Quantos graus esse ponto andou por quadro, no pior par de leituras. */
async function andouPorQuadro(p: Page, chave: string): Promise<number> {
  const amostras: number[][] = [];
  for (let k = 0; k < 14; k++) {
    const v = await pontoDoMeridiano(p, chave);
    if (v) amostras.push(v);
    await p.waitForTimeout(60);
  }
  expect(amostras.length, 'sem amostras de orientação').toBeGreaterThan(8);

  let maior = 0;
  for (let i = 1; i < amostras.length; i++) {
    const a = amostras[i - 1]!;
    const b = amostras[i]!;
    const cos = Math.min(1, Math.max(-1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!));
    maior = Math.max(maior, Math.acos(cos) * (180 / Math.PI));
  }
  // As leituras caem a 60 ms, ou seja ~3,6 quadros a 60 Hz.
  return maior / 3.6;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
});

test('no topo da escada de tempo, de perto, a superfície não vira serrilha', async ({
  page,
}) => {
  // A escada até o TOPO, que é onde o defeito é maior. Ela chega a 20 anos por
  // segundo — mais de sete mil voltas de Marte por segundo contra sessenta
  // quadros. O número não vai escrito aqui: sobe-se até parar de subir, e o
  // teste continua valendo se a escada mudar.
  let velocidade = '';
  for (let k = 0; k < 40; k++) {
    const antes = await page.locator('.barra__velocidade').innerText();
    await page.keyboard.press(']');
    await page.waitForTimeout(40);
    velocidade = await page.locator('.barra__velocidade').innerText();
    if (velocidade === antes) break;
  }
  expect(velocidade, 'a escada não saiu do lugar').not.toBe('');

  await page.getByRole('option', { name: /^Marte/ }).click();
  await page.keyboard.press('4');
  await page.waitForTimeout(1400);

  const raioPx = await page.evaluate(
    () => (window.__projecoes?.() ?? []).find((x) => x.chave === 'marte')?.raioPx ?? 0,
  );
  expect(raioPx, 'Marte não está grande na tela: o teto nem deveria agir').toBeGreaterThan(200);

  const grausPorQuadro = await andouPorQuadro(page, 'marte');
  const pixelsPorQuadro = grausPorQuadro * (Math.PI / 180) * raioPx;

  // **O limite vai escrito AQUI, e não importado do módulo que está sendo
  // medido.** A primeira versão deste teste comparava com `PIXELS_POR_QUADRO`,
  // e por isso passava verde mesmo com o teto desligado: subir a constante
  // subia junto o limite da comparação, e o teste media a si mesmo. É a
  // armadilha que o `ARQUITETURA.md` cataloga, e ela custa exatamente uma
  // linha para evitar.
  //
  // Medido, no topo da escada, com Marte a 319 px de raio na tela:
  // **1,67 px por quadro com o teto, 179 px sem ele** — cento e sete vezes.
  // O limite de 5 px é o triplo do teto de 1,5, e a folga existe porque as
  // leituras caem a 60 ms e não em quadros exatos.
  expect(
    pixelsPorQuadro,
    `a superfície andou ${pixelsPorQuadro.toFixed(1)} px por quadro`,
  ).toBeLessThan(5);

  // E não congelou: um teto que zera a rotação troca um defeito por outro.
  expect(grausPorQuadro, 'o planeta parou de girar').toBeGreaterThan(0);
});

test('de longe, o giro é o de sempre: o teto não toca em corpo pequeno', async ({ page }) => {
  for (let k = 0; k < 12; k++) await page.keyboard.press(']');
  await page.waitForTimeout(1200);

  const raioPx = await page.evaluate(
    () => (window.__projecoes?.() ?? []).find((x) => x.chave === 'jupiter')?.raioPx ?? 0,
  );
  expect(raioPx, 'a vista geral mudou: Júpiter está grande demais').toBeLessThan(20);

  const grausPorQuadro = await andouPorQuadro(page, 'jupiter');
  // Júpiter gira 870,536°/dia, e no topo da escada isso é muito mais que meia
  // volta por quadro: o ponto da superfície cai em qualquer lugar, e o ângulo
  // entre duas leituras é qualquer coisa até 180°. O que se afirma é só que ele
  // NÃO foi amortecido — continua andando muito mais que o teto de 1,5 px, que
  // num disco de 12 px seriam 7° por quadro.
  expect(
    grausPorQuadro,
    `Júpiter andou ${grausPorQuadro.toFixed(1)}° por quadro de longe`,
  ).toBeGreaterThan(7);
});
