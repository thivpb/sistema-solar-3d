/**
 * O laboratorio de Fourier na tela.
 *
 * O teste que nao pode faltar e o do AVISO. A cadeia de epiciclos descreve a
 * orbita com a precisao que se queira, e alguem que veja isso girando sem ler
 * mais nada sai daqui achando que o programa simula epiciclos. Ele nao simula.
 * O aviso e a diferenca entre o laboratorio ensinar a tese do TCC e ensinar o
 * contrario dela.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';
import { LABORATORIO } from '../../src/dados/textos.ts';

async function acionar(pagina: Page, rotulo: string): Promise<void> {
  const ok = await pagina.evaluate((alvo) => {
    const dialogo = document.querySelector('dialog[open]');
    const raiz: ParentNode = dialogo ?? document.body;
    const el = [...raiz.querySelectorAll('button:not([disabled]), summary, [role="option"]')].find(
      (e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()
        .replace(/,\s*(lua|\d+ luas?|criado por você|selecionado como A|escolhido como B|acompanhado)/g, '') === alvo,
    );
    if (!(el instanceof HTMLElement)) return false;
    el.focus();
    return document.activeElement === el;
  }, rotulo);
  expect(ok, `nao achei "${rotulo}"`).toBe(true);
  await pagina.keyboard.press('Enter');
  await pagina.waitForTimeout(60);
}

/** Os dois desvios escritos na lamina, em km. */
async function desvios(pagina: Page): Promise<{ medio: number; maximo: number }> {
  const valores = await pagina.locator('.lab .ficha__dados').innerText();
  const numeros = [...valores.matchAll(/([\d.]+(?:,\d+)?) km/g)].map((m) =>
    Number(m[1]!.replace(/\./g, '').replace(',', '.')),
  );
  return { medio: numeros[0]!, maximo: numeros[1]! };
}

async function abrirLaboratorio(pagina: Page, corpo: string): Promise<void> {
  await abrir(pagina);
  await expect(pagina.getByRole('banner')).toBeVisible();
  await acionar(pagina, corpo);
  await expect(pagina.locator('.ficha__dados')).toBeVisible();
  // O laboratório é um destino, e destinos moram em "Ir para" — "Mais opções"
  // passou a ser só sobre como a cena é desenhada.
  await acionar(pagina, 'Ir para');
  await acionar(pagina, 'Explorar a matemática');
  await expect(pagina.locator('.lab')).toBeVisible();
}

test('o aviso de construção histórica aparece antes do gráfico', async ({ page }) => {
  await abrirLaboratorio(page, 'Mercúrio');

  const aviso = page.locator('.lab__aviso');
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveText(LABORATORIO.avisoHistorico);

  // Antes do gráfico na ORDEM DO DOCUMENTO, que é a ordem em que tanto a
  // leitura visual quanto o leitor de tela encontram as coisas.
  const avisoPrimeiro = await page.evaluate(() => {
    const a = document.querySelector('.lab__aviso');
    const g = document.querySelector('.lab__grafico');
    if (!a || !g) return false;
    return (a.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(avisoPrimeiro, 'o aviso ficou depois do gráfico').toBe(true);
});

test('abrir o laboratório pausa a simulação', async ({ page }) => {
  // A pausa é o que torna a elipse, a data e os números de desvio coerentes
  // entre si: com o tempo correndo, a órbita osculadora que está decomposta
  // não seria mais a que está desenhada na cena.
  await abrirLaboratorio(page, 'Marte');
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
});

test('mais epiciclos, menos desvio — e o número aparece escrito', async ({ page }) => {
  await abrirLaboratorio(page, 'Mercúrio');

  const controle = page.getByRole('slider', { name: /Epiciclos/ });
  await controle.fill('1');
  await page.waitForTimeout(80);
  const com1 = await desvios(page);

  await controle.fill('8');
  await page.waitForTimeout(80);
  const com8 = await desvios(page);

  expect(com1.maximo, 'um epiciclo já descreveria Mercúrio?').toBeGreaterThan(1000);
  expect(com8.maximo, `1 → ${com1.maximo} km, 8 → ${com8.maximo} km`).toBeLessThan(com1.maximo / 10);
  expect(com8.medio).toBeLessThanOrEqual(com8.maximo);
});

test('o número de círculos desenhados acompanha o controle', async ({ page }) => {
  await abrirLaboratorio(page, 'Marte');
  const controle = page.getByRole('slider', { name: /Epiciclos/ });

  for (const n of [1, 3, 10]) {
    await controle.fill(String(n));
    await page.waitForTimeout(80);
    // Um elo por harmônico com |n| <= termos, menos o n = 0, que não gira.
    const circulos = await page.locator('.lab__grafico g circle').count();
    expect(circulos, `com ${n} no controle`).toBe(2 * n);
  }
});

test('o controle funciona com as setas do teclado', async ({ page }) => {
  await abrirLaboratorio(page, 'Marte');
  const controle = page.getByRole('slider', { name: /Epiciclos/ });
  await controle.focus();
  const antes = Number(await controle.inputValue());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(Number(await controle.inputValue())).toBe(antes + 2);
});

test('o gráfico tem descrição em texto, com o desvio dentro', async ({ page }) => {
  // Um <svg> é um retângulo para quem usa leitor de tela, exatamente como o
  // canvas da cena. O número que o desenho mostra precisa estar escrito.
  await abrirLaboratorio(page, 'Mercúrio');
  await page.getByRole('slider', { name: /Epiciclos/ }).fill('4');
  await page.waitForTimeout(80);
  const descricao = await page.locator('.lab__grafico').getAttribute('aria-label');
  expect(descricao).toMatch(/A órbita de Mercúrio e a soma de 4 epiciclos/);
  expect(descricao).toMatch(/desvio máximo entre as duas é de [\d.,]+ km/);
});

test('o Sol não tem volta para decompor, e a lâmina diz isso', async ({ page }) => {
  await abrirLaboratorio(page, 'Sol');
  await expect(page.locator('.lab')).toContainText(LABORATORIO.semOrbita);
  await expect(page.locator('.lab__grafico')).toHaveCount(0);
});

test('Esc fecha a lâmina e o painel lateral volta', async ({ page }) => {
  await abrirLaboratorio(page, 'Marte');
  await expect(page.locator('.lateral')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab')).toHaveCount(0);
  await expect(page.locator('.lateral')).toBeVisible();
});
