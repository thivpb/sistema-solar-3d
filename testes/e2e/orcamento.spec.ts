/**
 * "Cinco controles visíveis, não vinte."
 *
 * Este arquivo era citado pelo código e não existia. `BarraSuperior.tsx` abria
 * com «`orcamento.spec.ts` conta os grupos nomeados e falha se a barra
 * crescer», e um `ls testes/e2e` não o devolvia — a mesma classe de defeito que
 * `contrato.test.ts` nasceu para pegar noutro arquivo: uma prova afirmada e não
 * escrita. A afirmação ficava, o fiscal não.
 *
 * O número é **medido primeiro e fixado depois**, e não escolhido. Um orçamento
 * que reprova o desenho de hoje é o primeiro a ser afrouxado na primeira
 * pressa, e a partir daí não fiscaliza mais nada.
 *
 * O que se conta são GRUPOS NOMEADOS, e não botões: a escada de velocidade tem
 * três peças e é uma ideia só. Contar botões puniria dividir um controle em
 * partes claras, que é o contrário do que a regra quer.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

/** Um grupo da barra, ou um segmentado, que é um grupo por si. */
const SELETOR = 'header .barra__grupo, header .segmentado';

/**
 * Os tetos, medidos no desenho de hoje e postos UM acima do observado.
 *
 * Um acima, e não dez: a folga existe para que acrescentar um controle seja uma
 * decisão consciente, e não para que caiba um cockpit. Quem precisar do segundo
 * tem de tirar outro — que é exatamente o que a regra diz.
 */
const TETO = {
  /**
   * Medido: **3**. Tempo (pausa · − velocidade + · data) · modo (Explorar ·
   * Criar · Voar) · direita (painel · Ajuda).
   *
   * Eram 6, e a barra respondia a três perguntas misturadas. O enquadramento
   * desceu para o painel, junto das outras perguntas de câmera, e "Focar X"
   * saiu — ele fazia o mesmo que "Acompanhar" na ficha do corpo.
   */
  barra: 4,
  /**
   * **Zero, e não "poucos".**
   *
   * Havia três botões flutuando sobre o canvas — vista, alinhar, tabela —, sem
   * grupo e sem título. Era a queixa em uma frase: o que se marca disputando
   * atenção com o que se olha. Que eles nunca tenham pertencido ali já estava
   * escrito no CSS, numa regra que os escondia no modo imersivo.
   *
   * Um teto de zero é afirmação MAIS forte que um teto de três, e é a que
   * impede o canto da tela de voltar a ser uma gaveta.
   */
  visor: 0,
  /** Medido: 4 em repouso, 5 em Criar — câmera · corpos · ficha · gavetas. */
  lateral: 6,
} as const;

const contar = (p: Page, seletor: string): Promise<number> => p.locator(seletor).count();

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
});

test('a barra de cima cabe no orçamento, em cada modo', async ({ page }) => {
  const naBarra = await contar(page, SELETOR);
  expect(naBarra, `a barra tem ${naBarra} grupos`).toBeLessThanOrEqual(TETO.barra);

  // E o teto mede alguma coisa: se a barra estivesse vazia, ele passaria sem
  // olhar para nada. Este é o par que impede um orçamento vacuamente verde.
  expect(naBarra).toBeGreaterThanOrEqual(3);

  await page.getByRole('radio', { name: 'Criar', exact: true }).click();
  const emCriar = await contar(page, SELETOR);
  expect(emCriar, 'Criar não pode crescer a barra').toBeLessThanOrEqual(naBarra);
});

test('sobre a cena não há NADA clicável', async ({ page }) => {
  expect(await page.locator('.visor__botoes .botao').count()).toBe(TETO.visor);
  expect(await page.locator('.visor__botoes').count(), 'a faixa de botões voltou a existir')
    .toBe(0);

  // A guarda: e as leituras continuam lá. Um visor vazio passaria neste teste
  // e teria perdido a régua, a exposição e as etiquetas de licença — que são o
  // que a cena PRECISA dizer por escrito.
  await expect(page.locator('.visor__leitura')).toBeVisible();

  // E o que saiu daqui está alcançável, com o mesmo nome, no painel.
  for (const nome of ['Vista de cima (V)', 'Alinhar ao plano (T)', 'Ver como tabela']) {
    await expect(page.getByRole('button', { name: nome })).toBeVisible();
  }
});

test('a exceção sobre a cena é o distintivo de sistema modificado, e só ele', async ({ page }) => {
  // Ele carrega a saída — "Voltar ao Sistema Solar" — e o contrato pede que
  // fique permanentemente à vista enquanto o sistema estiver modificado. É a
  // única coisa clicável que pode aparecer ali, e só aparece depois de um ato
  // da própria pessoa.
  expect(await page.locator('.visor__modificado').count(), 'ele aparece sem ninguém ter mexido')
    .toBe(0);
});

test('a lateral em repouso não vira um painel de instrumentos', async ({ page }) => {
  // Em repouso: sem corpo escolhido e com "Mais opções" fechado. É o estado em
  // que alguém abre o programa, e o único em que o orçamento é uma promessa
  // sobre a primeira impressão.
  const grupos = await page.evaluate(() => {
    const lateral = document.querySelector('.lateral');
    if (!lateral) return -1;
    // Cada filho direto da lateral é um bloco nomeado.
    return [...lateral.children].filter((c) => (c as HTMLElement).offsetHeight > 0).length;
  });
  expect(grupos).toBeGreaterThanOrEqual(3);
  expect(grupos, `a lateral tem ${grupos} blocos`).toBeLessThanOrEqual(TETO.lateral);

  // As três gavetas contam como UM bloco de propósito: fechadas, elas são uma
  // pilha de três títulos. Contá-las como três diria que o painel cresceu
  // quando o que aconteceu foi o contrário — "Mais opções" deixou de ser a
  // gaveta de sobras e virou três perguntas nomeadas.
  expect(await page.locator('.lateral__gavetas details').count()).toBe(3);
});

test('o modo imersivo é o estado mais enxuto, e não mais um estado cheio', async ({ page }) => {
  await page.getByRole('radio', { name: 'Voar' }).click();
  // A barra e a lateral não existem; sobra a tira, com a saída escrita.
  expect(await contar(page, SELETOR)).toBe(0);
  expect(await contar(page, '.lateral')).toBe(0);

  const botoes = await page.locator('button:visible').count();
  // Um botão — a saída. Se o modo imersivo virar um lugar onde se acrescentam
  // controles "porque há espaço", este número sobe e o teste diz qual é.
  expect(botoes, `o modo imersivo tem ${botoes} botões visíveis`).toBeLessThanOrEqual(2);
  expect(botoes).toBeGreaterThanOrEqual(1);
});

test('abrir "Mais opções" é o que revela o resto — e ele está lá', async ({ page }) => {
  // O outro lado do orçamento: o que sai da barra tem de estar em algum lugar
  // alcançável, senão "enxuto" vira "faltando".
  // `:visible` nos DOIS lados. Sem ele, o de antes contava também as caixas que
  // estão no DOM dentro do `<details>` fechado — os dois números davam dez e a
  // comparação não media abertura nenhuma.
  const visiveis = (): Promise<number> =>
    page.locator('.lateral input[type="checkbox"]:visible').count();
  const antes = await visiveis();
  expect(antes, 'fechadas, as gavetas não podem deixar caixa nenhuma à mostra').toBe(0);
  await page.locator('summary', { hasText: 'Mais opções' }).click();
  await page.locator('summary', { hasText: 'Leitura' }).click();
  const depois = await visiveis();
  expect(depois).toBeGreaterThan(antes);
  expect(depois, 'as opções escondidas continuam existindo').toBeGreaterThanOrEqual(8);
});
