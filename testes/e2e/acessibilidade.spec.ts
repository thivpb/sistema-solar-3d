/**
 * A suite que a fase F2 existe para ter: o programa e acessivel ANTES de
 * mostrar qualquer coisa.
 *
 * A ordem nao e acidental. O jeito conhecido de perder acessibilidade e fazer
 * a cena bonita primeiro e prometer arrumar depois — e ai a perda fica
 * invisivel ate alguem com leitor de tela abrir o programa.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

async function semViolacoes(pagina: Page, onde: string): Promise<void> {
  const r = await new AxeBuilder({ page: pagina })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const resumo = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x)`).join('\n');
  expect(r.violations, `${onde}\n${resumo}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
});

test('a tela principal nao tem violacao', async ({ page }) => {
  await semViolacoes(page, 'tela principal');
});

test('cada modal nao tem violacao', async ({ page }) => {
  const telas: [string, () => Promise<void>][] = [
    ['Ajuda', async () => page.getByRole('button', { name: 'Ajuda' }).click()],
    ['Ver como tabela', async () => page.getByRole('button', { name: 'Ver como tabela' }).click()],
    ['Comparar corpos', async () => page.getByRole('button', { name: 'Comparar corpos' }).click()],
  ];
  for (const [nome, abrirTela] of telas) {
    await abrirTela();
    await expect(page.getByRole('dialog')).toBeVisible();
    await semViolacoes(page, `modal ${nome}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
});

test('o modo imersivo nao tem violacao, e a saida e um botao escrito', async ({ page }) => {
  // Um modo que recolhe a barra e a lateral e onde a acessibilidade mais pode
  // se perder sem ninguem notar: quem esta olhando a cena nao repara que os
  // controles sumiram, e quem usa leitor de tela fica sem nada.
  await page.getByRole('radio', { name: 'Voar' }).click();
  await expect(page.getByRole('banner')).toHaveCount(0);
  await semViolacoes(page, 'modo imersivo');

  // A saida e um BOTAO, e nao so a tecla Esc: nenhum atalho pode ser a unica
  // forma de fazer alguma coisa, e sair de um modo sem controles e o caso em
  // que essa regra mais importa.
  const sair = page.getByRole('button', { name: 'Sair do modo imersivo' });
  await expect(sair).toBeVisible();
  await sair.click();
  await expect(page.getByRole('banner')).toBeVisible();
});

test('a ficha inteira na lateral nao tem violacao', async ({ page }) => {
  // Ela era um `<dialog>`, cujo comportamento de foco vem do navegador. Como
  // secao da lateral, ela passou a ser HTML comum — e HTML comum e onde os
  // niveis de titulo saem de ordem e as listas de definicao saem malformadas.
  await page.getByRole('option', { name: /^Saturno/ }).click();
  await page.getByRole('button', { name: 'Ficha inteira' }).click();
  await expect(page.locator('.ficha--inteira')).toBeVisible();
  await semViolacoes(page, 'ficha inteira na lateral');
});

test('todo botao tem texto: icone nunca sozinho', async ({ page }) => {
  // "Requisito do projeto e boa pratica: o controle precisa dizer por escrito
  // o que faz. Um icone de engrenagem exige que a pessoa ja conheca a
  // convencao. 'Mais opcoes' nao exige."
  const vazios = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => {
        const texto = (b.textContent ?? '').trim();
        const rotulo = (b.getAttribute('aria-label') ?? '').trim();
        return texto === '' && rotulo === '';
      })
      .map((b) => b.outerHTML.slice(0, 120)),
  );
  expect(vazios).toEqual([]);
});

test('o primeiro Tab chega no link de pular', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /pular/i })).toBeFocused();
});

test('todo interativo e alcancavel por Tab', async ({ page }) => {
  const alcancados = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return `${a.tagName}:${(a.textContent ?? '').trim().slice(0, 30)}:${a.getAttribute('aria-label') ?? ''}`;
    });
    if (id) alcancados.add(id);
  }
  // Os controles principais tem de estar entre eles.
  const esperados = ['Pausar', 'Ajuda', 'Sistema completo', 'Comparar corpos'];
  for (const e of esperados) {
    expect([...alcancados].some((a) => a.includes(e)), `${e} inalcancavel por Tab`).toBe(true);
  }
});

test('o anel de foco aparece no teclado e NAO no clique de mouse', async ({ page }) => {
  // O botao precisa de tres coisas: nao abrir modal, nao mover o foco, e NAO
  // mudar de texto ao ser clicado. "Pausar" falha na terceira — vira
  // "Continuar", e o localizador para de resolver. "Ajuda" falha nas duas
  // primeiras: abre um dialogo, e fechar com Esc devolve o foco COM anel,
  // que e o comportamento certo do navegador e nao um defeito.
  const botao = page.getByRole('button', { name: 'Alinhar ao plano (T)' });

  await botao.click();
  expect(
    await botao.evaluate((b) => b.matches(':focus-visible')),
    'anel de foco apareceu depois de um clique de mouse',
  ).toBe(false);

  await page.keyboard.press('Tab');
  const algumVisivel = await page.evaluate(() => document.activeElement?.matches(':focus-visible') ?? false);
  expect(algumVisivel, 'nenhum anel de foco ao navegar por teclado').toBe(true);
});

test('o modal prende o foco e devolve para quem o abriu', async ({ page }) => {
  const abridor = page.getByRole('button', { name: 'Ajuda' });
  await abridor.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  // O foco esta DENTRO do dialogo.
  const dentro = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    return d ? d.contains(document.activeElement) : false;
  });
  expect(dentro, 'o foco nao entrou no modal').toBe(true);

  // O fundo ficou inerte: Tab nao escapa para a barra.
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const aindaDentro = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    return d ? d.contains(document.activeElement) : false;
  });
  expect(aindaDentro, 'o Tab escapou do modal').toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(abridor).toBeFocused();
});

test('a lista de corpos e um listbox com tabindex movel', async ({ page }) => {
  const lista = page.getByRole('listbox', { name: /corpos/i });
  await expect(lista).toBeVisible();
  const opcoes = page.getByRole('option');
  await expect(opcoes).toHaveCount(9);

  // Um Tab so entra na lista; as setas percorrem. Nove botoes gastariam nove Tabs.
  const comTab = await lista.evaluate(
    (l) => [...l.querySelectorAll('[role="option"]')].filter((o) => o.getAttribute('tabindex') === '0').length,
  );
  expect(comTab).toBe(1);

  await opcoes.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { selected: true })).toHaveAttribute('data-chave', 'mercurio');
});

test('a cena tem equivalente em texto — um canvas nao e legivel', async ({ page }) => {
  await page.getByRole('button', { name: 'Ver como tabela' }).click();
  // São DUAS tabelas: os nove corpos da física e as treze luas. As luas eram
  // desenhadas e rotuladas e não existiam para quem usa leitor de tela — elas
  // não estão na lista lateral, porque não são corpos da física.
  const tabelas = page.getByRole('table');
  await expect(tabelas).toHaveCount(2);

  const corpos = tabelas.first();
  await expect(corpos.getByRole('row')).toHaveCount(10); // cabecalho + 9 corpos
  await expect(corpos.getByRole('rowheader', { name: 'Terra' })).toBeVisible();

  const luas = tabelas.nth(1);
  await expect(luas.getByRole('row')).toHaveCount(14); // cabecalho + 13 luas
  await expect(luas.getByRole('rowheader', { name: 'Ganimedes' })).toBeVisible();
});

test('role="application" fica SO no canvas', async ({ page }) => {
  const quantos = await page.evaluate(
    () => [...document.querySelectorAll('[role="application"]')].map((e) => e.tagName),
  );
  expect(quantos).toEqual(['CANVAS']);
});

test('funciona a 320 px de largura, sem rolagem horizontal (WCAG 1.4.10)', async ({ page }) => {
  for (const largura of [320, 360]) {
    await page.setViewportSize({ width: largura, height: 700 });
    const transborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(transborda, `rolagem horizontal a ${largura} px`).toBe(false);
    await semViolacoes(page, `${largura} px de largura`);
  }
});

test('nada tira o programa da tela: a página não rola, as regiões internas rolam', async ({ page }) => {
  // Defeito medido: com "Texto maior" ligado e "Mais opções" aberto, focar um
  // alternador pelo teclado rolava a PÁGINA e levava a cena 737 px para fora
  // da janela. A caixa de seleção de verdade é um <input> absoluto e invisível,
  // e sem um ancestral posicionado o bloco que a contém é o documento inteiro:
  // o navegador rolava até a posição dela no documento.
  await page.setViewportSize({ width: 1280, height: 860 });
  // As duas gavetas: "Modo maquete" e desenho da cena, as outras tres sao
  // sobre quem le. Abrir as duas e o que poe os quatro na tela ao mesmo tempo.
  await page.locator('summary', { hasText: 'Mais opções' }).click();
  await page.locator('summary', { hasText: 'Leitura' }).click();

  for (const nome of [/Texto maior/, /Reduzir animação/, /Mostrar dados técnicos/, /Modo maquete/]) {
    const c = page.getByRole('checkbox', { name: nome });
    await c.focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    const rolou = await page.evaluate(() => ({ y: window.scrollY, x: window.scrollX }));
    expect(rolou, `${nome} rolou a página`).toEqual({ x: 0, y: 0 });
    const canvas = (await page.locator('canvas').boundingBox())!;
    expect(canvas.y, `${nome} tirou a cena da janela`).toBeGreaterThanOrEqual(0);
    expect(canvas.height).toBeGreaterThan(100);
  }

  // E a lateral continua rolando por dentro: o conteúdo dela é alcançável.
  const rolaPorDentro = await page.evaluate(() => {
    const l = document.querySelector('.lateral') as HTMLElement | null;
    if (!l) return false;
    l.scrollTop = 9999;
    return l.scrollTop > 0;
  });
  expect(rolaPorDentro, 'a lateral não rola: o que está embaixo virou inalcançável').toBe(true);
});
