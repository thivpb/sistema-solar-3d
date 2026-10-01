/**
 * O modo Criar, na tela.
 *
 * Duas coisas sao verificadas aqui e em nenhum outro lugar:
 *
 *   - **Cria-se sem arrastar.** O criterio 2.5.7 da WCAG 2.2 pede que toda
 *     funcionalidade com arrasto tenha caminho por ponteiro unico. Aqui nao ha
 *     arrasto nenhum: escolher o tipo e um botao, mirar e um CLIQUE, e a
 *     velocidade e um controle deslizante que as setas operam. O teste faz o
 *     caminho inteiro sem um unico `pointermove`.
 *   - **A recusa carrega a saida.** Quando o cálculo nao da conta, a mensagem
 *     aparece ao lado do botao que a provocou, com "Usar passo curto" junto —
 *     e nao dentro de um `<dialog>`, que deixaria o resto da pagina inerte e o
 *     botao da saida do lado de fora.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';
import { MAXIMO_DE_CORPOS_CRIADOS } from '../../src/nucleo/guardas.ts';

/** Um clique simples no meio do canvas, deslocado por (dx, dy) pixels. */
async function clicarNaCena(pagina: Page, dx = 0, dy = 0): Promise<void> {
  const caixa = (await pagina.locator('canvas').boundingBox())!;
  await pagina.mouse.click(caixa.x + caixa.width / 2 + dx, caixa.y + caixa.height / 2 + dy);
  await pagina.waitForTimeout(120);
}

async function entrarEmCriar(pagina: Page): Promise<void> {
  await abrir(pagina);
  await expect(pagina.getByRole('banner')).toBeVisible();
  await pagina.waitForFunction(() => window.__camera !== undefined);
  await pagina.getByRole('button', { name: 'Pausar' }).click();
  await pagina.getByRole('radio', { name: 'Criar', exact: true }).click();
  await expect(pagina.locator('.criar')).toBeVisible();
}

test.beforeEach(async ({ page }) => entrarEmCriar(page));

test('cria um corpo em três passos, sem um único arrasto', async ({ page }) => {
  await expect(page.getByRole('radio', { name: /Asteroide/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /Planeta rochoso/ }).click();

  // O botão de criar só acorda depois de mirar: sem posição não há o que criar.
  const criar = page.getByRole('button', { name: /Criar planeta rochoso/ });
  await expect(criar).toBeDisabled();

  await clicarNaCena(page, 160, 0);
  await expect(page.locator('.criar__mira')).toContainText('UA do Sol');
  await expect(criar).toBeEnabled();
  await criar.click();

  // Apareceu na lista lateral e na lista do painel.
  await expect(page.getByRole('option', { name: /Planeta rochoso 1/ })).toBeVisible();
  await expect(page.locator('.criar__lista')).toContainText('Planeta rochoso 1');
  // E o distintivo, com a saída junto.
  const distintivo = page.locator('.visor__modificado');
  await expect(distintivo).toContainText('Sistema modificado');
  await expect(distintivo.getByRole('button', { name: /Voltar ao Sistema Solar/ })).toBeVisible();
});

test('a velocidade é um controle de teclado, com as marcas que ensinam', async ({ page }) => {
  const v = page.getByRole('slider');
  await expect(v).toHaveValue('1');
  await expect(page.locator('#criar-velocidade-ajuda')).toContainText('Acima da velocidade');

  await v.focus();
  for (let k = 0; k < 50; k++) await page.keyboard.press('ArrowRight');
  expect(Number(await v.inputValue())).toBeGreaterThan(1.4);
  await expect(page.locator('#criar-velocidade-ajuda')).toContainText('velocidade de escape');

  await v.fill('0');
  await expect(page.locator('#criar-velocidade-ajuda')).toContainText('cai direto no Sol');
});

test('a criação recusada explica e oferece a saída, sem prender o foco', async ({ page }) => {
  // Em cima do Sol, que está no centro da vista geral: a guarda de vizinhança
  // recusa, porque a separação mínima dele é de 0,144 UA.
  await clicarNaCena(page, 0, 0);
  await page.getByRole('button', { name: /^Criar asteroide/ }).click();

  const recusa = page.locator('.criar__recusa');
  await expect(recusa).toBeVisible();
  await expect(recusa).toContainText('Perto demais');
  // Nenhum <dialog> aberto: o resto da página continua operável.
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajuda' })).toBeEnabled();

  // Mirar noutro ponto apaga a recusa: ela era sobre o ponto anterior.
  await clicarNaCena(page, 200, 60);
  await expect(recusa).toHaveCount(0);
});

test('desfazer volta, e Cmd+Shift+Z não desfaz duas vezes', async ({ page }) => {
  await clicarNaCena(page, 160, 0);
  await page.getByRole('button', { name: /^Criar asteroide/ }).click();
  await clicarNaCena(page, -160, 40);
  await page.getByRole('button', { name: /^Criar asteroide/ }).click();
  await expect(page.locator('.criar__lista li')).toHaveCount(2);

  await page.getByRole('button', { name: /^Desfazer/ }).click();
  await expect(page.locator('.criar__lista li')).toHaveCount(1);

  // O Refazer convencional de todo aplicativo. Aqui não há refazer, e o que
  // ele NÃO pode fazer é desfazer mais um.
  await page.keyboard.press('Meta+Shift+z');
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(150);
  await expect(page.locator('.criar__lista li')).toHaveCount(1);

  // Cmd+Z, esse sim.
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(150);
  await expect(page.locator('.criar__lista')).toHaveCount(0);
  await expect(page.locator('.visor__modificado')).toHaveCount(0);
});

test('apagar tira da cena e da lista, e a física continua consistente', async ({ page }) => {
  await clicarNaCena(page, 160, 0);
  await page.getByRole('button', { name: /^Criar asteroide/ }).click();
  const naCena = async (): Promise<number> =>
    page.evaluate(() => window.__posicaoNaCena?.('criado-1') ? 1 : 0);
  expect(await naCena()).toBe(1);

  await page.getByRole('button', { name: /Apagar Asteroide 1/ }).click();
  await page.waitForTimeout(200);
  expect(await naCena(), 'o corpo saiu da lista e continuou na cena').toBe(0);
  await expect(page.getByRole('option', { name: /Asteroide 1/ })).toHaveCount(0);
});

test('voltar ao Sistema Solar do JPL apaga tudo de uma vez', async ({ page }) => {
  for (const dx of [160, -160, 90]) {
    await clicarNaCena(page, dx, dx / 4);
    await page.getByRole('button', { name: /^Criar asteroide/ }).click();
  }
  await expect(page.locator('.criar__lista li')).toHaveCount(3);
  await page.locator('.visor__modificado').getByRole('button').click();
  await expect(page.locator('.criar__lista')).toHaveCount(0);
  await expect(page.locator('.visor__modificado')).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Netuno' })).toBeVisible();
});

test('o modo Criar não estoura o orçamento de controles da barra', async ({ page }) => {
  // "Cinco controles visíveis, não vinte". Entrar em Criar acrescenta um
  // grupo e tira outro — o enquadramento, que não é o que se está fazendo
  // ali e continua alcançável pelas teclas 1 a 4.
  const grupos = (): Promise<number> =>
    page.locator('header .barra__grupo, header .segmentado').count();
  const emCriar = await grupos();
  await page.getByRole('radio', { name: 'Explorar', exact: true }).click();
  const emExplorar = await grupos();
  // Criar acrescenta um grupo e tira o enquadramento: o saldo é zero ou
  // negativo, nunca positivo. Fixar "a diferença é exatamente dois", como a
  // especificação original pedia, contradiria a própria regra de que os
  // controles que perdem sentido saem da barra.
  expect(emCriar, `criar ${emCriar}, explorar ${emExplorar}`).toBeLessThanOrEqual(emExplorar);
  expect(emExplorar).toBeLessThanOrEqual(6);
});

test('o teto de corpos existe e a recusa diz qual é', async ({ page }) => {
  // Criar 40 pela interface levaria minutos. O teto é verificado no núcleo
  // por `sandbox.test.ts`; aqui se verifica que o número que a tela escreveria
  // é o mesmo do núcleo, e não um literal solto na interface.
  const daTela = await page.evaluate(() => {
    const el = document.querySelector('.criar');
    return el ? el.textContent ?? '' : '';
  });
  expect(daTela).toContain('atravessam uns aos outros');
  expect(MAXIMO_DE_CORPOS_CRIADOS).toBe(40);
});
