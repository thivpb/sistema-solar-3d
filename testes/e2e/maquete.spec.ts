/**
 * O modo maquete comprime de verdade — e so o desenho.
 *
 * Este arquivo existe por causa de um defeito achado numa auditoria: o
 * alternador, o estado, o aviso falado, a etiqueta na tela e a declaracao na
 * Ajuda existiam todos, e NADA comprimia. O programa afirmava ao usuario uma
 * licenca que nao tomava.
 *
 * Por isso os dois lados sao medidos aqui: que a compressao ACONTECE, e que
 * ela NAO vaza para a luz nem para os numeros das fichas. Declarar licenca a
 * mais e o mesmo defeito que declarar licenca a menos.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';


async function ligarMaquete(pagina: Page): Promise<void> {
  await pagina.locator('summary', { hasText: 'Mais opções' }).click();
  const alternador = pagina.getByRole('checkbox', { name: /Modo maquete/ });
  await alternador.focus();
  await pagina.keyboard.press(' ');
  await expect(alternador).toBeChecked();
  await pagina.waitForTimeout(250);
}

const naCena = (pagina: Page, chave: string): Promise<{ r: number } | null> =>
  pagina.evaluate((c) => window.__posicaoNaCena?.(c) ?? null, chave);

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__posicaoNaCena !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(200);
});

test('as distâncias desenhadas passam a ser a raiz quadrada das reais', async ({ page }) => {
  const antes: Record<string, number> = {};
  for (const c of ['mercurio', 'terra', 'jupiter', 'netuno']) {
    antes[c] = (await naCena(page, c))!.r;
  }

  await ligarMaquete(page);

  for (const c of ['mercurio', 'terra', 'jupiter', 'netuno']) {
    const depois = (await naCena(page, c))!.r;
    expect(depois, `${c}: ${antes[c]} → ${depois}`).toBeCloseTo(Math.sqrt(antes[c]!), 4);
  }

  // A Terra quase não se mexe: 1 UA é o ponto fixo da compressão, e ela está
  // a 0,983 UA. "Quase", e não "exatamente" — a primeira versão deste teste
  // exigiu igualdade e reprovou um código certo por 0,8%.
  const terraDepois = (await naCena(page, 'terra'))!.r;
  expect(Math.abs(terraDepois - antes['terra']!) / antes['terra']!).toBeLessThan(0.01);
  // A razão entre o mais longe e o mais perto cai para a RAIZ dela — é essa
  // queda que abre espaço entre os internos, e é a razão de ser do modo.
  //
  // A relação é afirmada em vez do valor: 77:1 é a razão dos semieixos, e no
  // instante de partida Mercúrio está perto do afélio, o que dá 64:1. Fixar
  // "77" faria o teste depender da data da efeméride.
  const razaoAntes = antes['netuno']! / antes['mercurio']!;
  const razaoDepois = (await naCena(page, 'netuno'))!.r / (await naCena(page, 'mercurio'))!.r;
  expect(razaoAntes, 'o sistema real deveria ser muito desigual').toBeGreaterThan(55);
  expect(razaoDepois).toBeCloseTo(Math.sqrt(razaoAntes), 3);
  expect(razaoDepois, 'a compressão precisa caber numa tela').toBeLessThan(11);
});

test('a direção não muda: quem está em oposição continua em oposição', async ({ page }) => {
  const angulo = async (c: string): Promise<number> => {
    const p = await page.evaluate((k) => window.__posicaoNaCena?.(k) ?? null, c);
    return Math.atan2(p!.y, p!.x);
  };
  const antes = await Promise.all(['mercurio', 'marte', 'netuno'].map(angulo));
  await ligarMaquete(page);
  const depois = await Promise.all(['mercurio', 'marte', 'netuno'].map(angulo));
  antes.forEach((a, i) => expect(depois[i]!, `corpo ${i}`).toBeCloseTo(a, 6));
});

test('a luz que cada corpo recebe NÃO muda — ela mede a distância real', async ({ page }) => {
  // Se a irradiância seguisse a posição desenhada, Netuno a 5,5 UA visuais
  // receberia trinta vezes mais luz do que recebe, e a compressão estaria
  // alterando um resultado físico visível.
  const luz = (c: string): Promise<number | null> =>
    page.evaluate((k) => window.__irradianciaDe?.(k) ?? null, c);

  const antes = { terra: await luz('terra'), netuno: await luz('netuno') };
  await ligarMaquete(page);
  const depois = { terra: await luz('terra'), netuno: await luz('netuno') };

  expect(antes.netuno).toBeGreaterThan(0);
  expect(depois.terra).toBeCloseTo(antes.terra!, 10);
  expect(depois.netuno).toBeCloseTo(antes.netuno!, 12);
  // E continua valendo 1/d² com a distância REAL: Netuno recebe ~900x menos.
  expect(antes.terra! / antes.netuno!).toBeGreaterThan(700);
});

test('os números da ficha continuam reais', async ({ page }) => {
  await page.getByRole('option', { name: 'Netuno' }).click();
  await page.waitForTimeout(250);
  const antes = await page.locator('.ficha__dados').innerText();
  await ligarMaquete(page);
  expect(await page.locator('.ficha__dados').innerText()).toBe(antes);
  expect(antes).toMatch(/29,|30,/); // Netuno está a ~30 UA, não a 5,5
});

test('a régua é SUBSTITUÍDA pelo aviso, e não posta ao lado dele', async ({ page }) => {
  // Régua linear sobre escala não-linear é mentira gráfica. Mostrá-la junto
  // com o aviso seria pior que sozinha: pareceria que o aviso a qualifica.
  await expect(page.locator('.visor__leitura')).toContainText('largura visível');
  await ligarMaquete(page);
  const leitura = await page.locator('.visor__leitura').innerText();
  expect(leitura).toContain('DISTÂNCIAS COMPRIMIDAS');
  expect(leitura).not.toContain('largura visível');
  expect(leitura).not.toContain('do alvo');
});

test('ligar a compressão reenquadra, em vez de deixar o sistema virar um ponto', async ({ page }) => {
  // O sistema desenhado encolhe por um fator de 5,5. Sem reenquadrar, a
  // câmera fica a 31,5 UA de algo que agora cabe em 5,5.
  const raio = (): Promise<number> => page.evaluate(() => window.__camera!.raio);
  const antes = await raio();
  await ligarMaquete(page);
  await page.waitForTimeout(700); // a transição de câmera tem prazo fixo
  const depois = await raio();
  expect(antes).toBeCloseTo(31.5, 1);
  expect(depois, `${antes} → ${depois}`).toBeLessThan(antes / 3);
  expect(depois).toBeCloseTo(Math.sqrt(31.5), 1);
});

test('os anéis de distância encolhem junto, senão marcariam o lugar errado', async ({ page }) => {
  const terra = (await naCena(page, 'terra'))!.r;
  await ligarMaquete(page);
  // O anel de 1 UA continua passando pela órbita da Terra: os dois foram
  // comprimidos pela mesma curva. Se só as órbitas encolhessem, o anel de
  // 30 UA passaria a cruzar órbitas que estão a 5 UA dele.
  const terraDepois = (await naCena(page, 'terra'))!.r;
  expect(Math.abs(terraDepois - terra) / terra).toBeLessThan(0.01);
  const marte = (await naCena(page, 'marte'))!.r;
  expect(marte, 'Marte deveria ficar entre o anel de 1 UA e o de 5').toBeGreaterThan(1);
  expect(marte).toBeLessThan(Math.sqrt(5));
});

test('desligar volta tudo ao lugar', async ({ page }) => {
  const antes = (await naCena(page, 'jupiter'))!.r;
  await ligarMaquete(page);
  expect((await naCena(page, 'jupiter'))!.r).toBeLessThan(antes / 2);
  const alternador = page.getByRole('checkbox', { name: /Modo maquete/ });
  await alternador.focus();
  await page.keyboard.press(' ');
  await page.waitForTimeout(250);
  expect((await naCena(page, 'jupiter'))!.r).toBeCloseTo(antes, 4);
  await expect(page.locator('.visor__leitura')).toContainText('largura visível');
});
