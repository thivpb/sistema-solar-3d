/**
 * O modo imersivo: a cena toma a tela, e W A S D voam.
 *
 * O que este arquivo existe para impedir são as três formas de o modo ficar
 * errado sem parecer errado:
 *
 *   1. **Uma sala sem porta.** Os controles recuam; se a única saída fosse uma
 *      tecla, a tecla seria a única forma de fazer alguma coisa — proibido.
 *   2. **Uma tela bonita e muda.** Os corpos estão ampliados e a exposição pode
 *      estar multiplicada. Esconder as licenças no modo mais bonito é escondê-las
 *      exatamente onde elas mais importam.
 *   3. **Teclas que fazem duas coisas.** Fora do modo, `G` guarda uma imagem;
 *      dentro dele, `W`, `A`, `S`, `D`, `Q` e `E` são do voo e de mais ninguém.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

const camera = (p: Page): Promise<{ pivo: number[]; raio: number; azimute: number }> =>
  p.evaluate(() => ({
    pivo: [...(window.__camera?.pivo ?? [0, 0, 0])],
    raio: window.__camera?.raio ?? 0,
    azimute: window.__camera?.azimute ?? 0,
  }));

const distancia = (a: number[], b: number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** Segura uma tecla por um tempo e devolve quanto o pivô andou, em UA. */
async function voarPor(p: Page, tecla: string, ms: number): Promise<number> {
  const antes = await camera(p);
  await p.keyboard.down(tecla);
  await p.waitForTimeout(ms);
  await p.keyboard.up(tecla);
  await p.waitForTimeout(120);
  return distancia((await camera(p)).pivo, antes.pivo);
}

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
});

test('entra e sai por controle escrito, sem depender de atalho', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  await expect(page.getByRole('banner')).toHaveCount(0);
  await expect(page.getByRole('complementary')).toHaveCount(0);

  const sair = page.getByRole('button', { name: 'Sair do modo imersivo' });
  await expect(sair).toBeVisible();
  await sair.click();

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('complementary')).toBeVisible();
});

test('Esc sai do modo — mas só depois de não haver caixa para fechar', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  await expect(page.getByRole('banner')).toHaveCount(0);

  // A ajuda abre por dentro do modo. O primeiro Esc é dela.
  await page.keyboard.press('F1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // E o modo continua: uma tecla, uma coisa.
  await expect(page.getByRole('banner')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('banner')).toBeVisible();
});

test('W A S D movem o pivô, e as direções opostas se desfazem', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  const partida = await camera(page);

  const frente = await voarPor(page, 'w', 400);
  expect(frente).toBeGreaterThan(0.5);

  // Voltar pelo mesmo caminho devolve ao ponto de partida. Não é exato — o
  // tempo de cada tecla difere —, mas tem de ser MUITO menor que a ida: se o
  // S andasse para o mesmo lado que o W, esta distância dobraria em vez de
  // encolher, e nenhuma comparação com zero pegaria isso.
  await voarPor(page, 's', 400);
  const volta = distancia((await camera(page)).pivo, partida.pivo);
  expect(volta).toBeLessThan(frente * 0.35);

  // A e D andam numa direção diferente da do W: se a base estivesse errada e
  // os três empurrassem para o mesmo lado, isto passaria despercebido.
  const antesDoLado = await camera(page);
  await voarPor(page, 'd', 300);
  const depoisDoLado = await camera(page);
  const deslocamento = depoisDoLado.pivo.map((v, k) => v - antesDoLado.pivo[k]!);
  expect(Math.hypot(...deslocamento)).toBeGreaterThan(0.3);
});

test('voar NÃO é aproximar: o raio e os ângulos não se mexem', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  const antes = await camera(page);
  await voarPor(page, 'w', 300);
  const depois = await camera(page);
  expect(depois.raio).toBeCloseTo(antes.raio, 12);
  expect(depois.azimute).toBeCloseTo(antes.azimute, 12);
});

test('soltar a tecla para o voo', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  await voarPor(page, 'w', 250);
  const parado = await camera(page);
  await page.waitForTimeout(500);
  expect(distancia((await camera(page)).pivo, parado.pivo)).toBeLessThan(1e-9);
});

test('fora do modo as mesmas teclas não voam', async ({ page }) => {
  const antes = await camera(page);
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  expect(distancia((await camera(page)).pivo, antes.pivo)).toBeLessThan(1e-9);
});

test('as licenças visuais continuam escritas dentro do modo', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  const licencas = page.locator('.imersivo__licencas');
  // Os corpos estão ampliados por padrão, e isso é uma licença — a etiqueta
  // tem de estar lá, e com o texto inteiro, não uma versão curta.
  await expect(licencas).toContainText('Corpos desenhados maiores que o tamanho real');

  // E o rodapé antigo do visor recolheu, em vez de desenhar por baixo da tira.
  await expect(page.locator('.visor__leitura')).toBeHidden();
});

test('a tira diz quais teclas restaram e a que velocidade se voa', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  const tira = page.locator('.imersivo__tira');
  for (const k of ['W', 'A', 'S', 'D', 'Q', 'E', 'Shift', 'Esc']) {
    await expect(tira.getByText(k, { exact: true })).toBeVisible();
  }
  await expect(tira).toContainText(/voando a .* UA por segundo/);
});

test('aproximar desacelera o voo, e o número escrito acompanha', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  const tira = page.locator('.imersivo__velocidade');
  const ler = async (): Promise<number> => {
    const t = (await tira.textContent()) ?? '';
    return Number((/voando a ([\d.,]+) UA/.exec(t)?.[1] ?? '0').replace(/\./g, '').replace(',', '.'));
  };
  const longe = await ler();
  const andouLonge = await voarPor(page, 'w', 300);

  // Aproximar dez vezes divide a velocidade por dez, porque ela é uma fração
  // do raio. É isso que faz o zoom ser o controle de velocidade do voo.
  await page.evaluate(() => {
    if (window.__camera) window.__camera.raio /= 10;
  });
  await page.waitForTimeout(120);
  const perto = await ler();
  expect(perto).toBeLessThan(longe / 5);

  const andouPerto = await voarPor(page, 'w', 300);
  expect(andouPerto).toBeLessThan(andouLonge / 5);
});

test('entrar no modo solta o corpo acompanhado, em vez de brigar com ele', async ({ page }) => {
  // Acompanhar reescreve o pivô a cada quadro; o voo também o move. Os dois
  // juntos fariam as teclas não terem efeito visível nenhum.
  await page.getByRole('option', { name: /^Júpiter/ }).click();
  // O botão da FICHA, na lateral. A barra de cima tem o seu, escrito "Soltar
  // Júpiter", e um localizador por "Soltar" pega os dois.
  const naFicha = page.locator('.ficha').getByRole('button', { name: 'Acompanhar' });
  await naFicha.click();
  await expect(page.locator('.ficha').getByRole('button', { name: 'Soltar' })).toBeVisible();

  await page.getByRole('radio', { name: 'Voar' }).click();
  expect(await voarPor(page, 'w', 350)).toBeGreaterThan(0.3);
});
