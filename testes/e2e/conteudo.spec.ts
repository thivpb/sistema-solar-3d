/**
 * O conteudo educativo, conferido na tela.
 *
 * A fase F5 vem ANTES do sandbox de proposito: e a fatia sem gloria, a que
 * seria sacrificada se o prazo apertasse, e a unica cuja perda seria uma
 * regressao em relacao ao programa que ja funcionava. Um teste que so
 * verificasse "o modal abre" nao protegeria nada — o modal abria com o texto
 * "em construcao" tambem.
 *
 * Entao aqui se verifica o CONTEUDO: que os numeros vieram do calculo e nao de
 * um marcador, que a ficha do Sol e de outra natureza, que a tabela de fontes
 * esta escrita, e que a matematica do Sol soma o que diz somar.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';
import { ATIVIDADES, FONTES, HONESTIDADE, TUTORIAL } from '../../src/dados/textos.ts';
import { FICHAS, PLANETAS } from '../../src/dados/fichas.ts';

/** Foca pelo nome acessivel e aperta Enter: o caminho que o teclado percorre. */
/**
 * Abre a gaveta que contem o controle, se houver uma fechada.
 *
 * O painel passou a ter tres gavetas — "Mais opções", "Leitura" e "Explorar" —
 * em vez de uma so, porque as tres respondiam a perguntas diferentes. Um
 * controle dentro de `<details>` fechado esta no DOM e nao esta na tela, e
 * `focus()` nele falha em silencio. Abrir pelo `<summary>` e o gesto de
 * verdade: passa pelo `onToggle` do componente, e nao por cima dele.
 */
async function abrirGavetaDe(pagina: Page, rotulo: string): Promise<void> {
  const titulo = await pagina.evaluate((alvo) => {
    const el = [...document.querySelectorAll('button, summary, [role="option"]')].find(
      (e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim() === alvo,
    );
    // Se o proprio alvo e o titulo de uma gaveta, nao ha nada a abrir: quem
    // abre e o `acionar` logo abaixo. Abrir aqui e acionar depois abriria e
    // fecharia a mesma gaveta, e o controle procurado seguiria escondido.
    if (!el || el.tagName === 'SUMMARY') return null;
    const gaveta = el.closest('details:not([open])');
    return gaveta?.querySelector('summary')?.textContent?.trim() ?? null;
  }, rotulo);
  if (titulo === null) return;
  await pagina.locator('summary', { hasText: titulo }).click();
  await pagina.waitForTimeout(80);
}

async function acionar(pagina: Page, rotulo: string): Promise<void> {
  await abrirGavetaDe(pagina, rotulo);
  const ok = await pagina.evaluate((alvo) => {
    const dialogo = document.querySelector('dialog[open]');
    const raiz: ParentNode = dialogo ?? document.body;
    const el = [
      ...raiz.querySelectorAll('button:not([disabled]), summary, [role="option"]'),
    ].find(
      (e) =>
        (e.getAttribute('aria-label') ?? e.textContent ?? '')
          .trim()
          .replace(/,\s*(lua|\d+ luas?|criado por você|selecionado como A|escolhido como B|acompanhado)/g, '') === alvo,
    );
    if (!(el instanceof HTMLElement)) return false;
    el.focus();
    return document.activeElement === el;
  }, rotulo);
  expect(ok, `nao achei o controle "${rotulo}"`).toBe(true);
  await pagina.keyboard.press('Enter');
  await pagina.waitForTimeout(60);
}

/**
 * Abre a ficha inteira de um corpo e devolve o texto dela.
 *
 * Era `abrirDetalhes`, e lia `dialog[open] .modal__corpo`. A ficha completa
 * deixou de ser uma caixa sobre a cena e virou uma secao da lateral: o que muda
 * para o teste e ONDE o texto esta, e nao o que ele diz. As asseroes de
 * conteudo abaixo continuam palavra por palavra — se elas tivessem de ser
 * afrouxadas, a mudanca teria custado informacao, e nao so lugar.
 */
async function abrirFicha(pagina: Page, corpo: string): Promise<string> {
  await acionar(pagina, corpo);
  const ficha = pagina.locator('.ficha');
  await expect(ficha.getByRole('heading', { level: 2 })).toHaveText(corpo);
  // O botao alterna: so aciona se ela ainda nao estiver aberta.
  if (!(await pagina.locator('.ficha--inteira').count())) {
    await acionar(pagina, 'Ficha inteira');
  }
  await expect(pagina.locator('.ficha--inteira')).toBeVisible();
  // E a cena continua a vista — esse era o ponto de tirar a ficha da caixa.
  await expect(pagina.locator('canvas')).toBeVisible();
  return (await ficha.innerText()).trim();
}

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Netuno' })).toBeVisible();
  // Os numeros da ficha sao publicados a 8 Hz, DEPOIS do primeiro desenho.
  // Sem esperar a primeira publicacao, a lateral ainda mostra "Escolha um corpo"
  // e o teste mediria o instante de partida em vez do conteudo.
  await acionar(page, 'Sol');
  await expect(page.locator('.ficha__dados')).toBeVisible();
});

test('a ficha de um gigante gasoso traz os sete blocos, com numeros do calculo', async ({ page }) => {
  const texto = await abrirFicha(page, 'Saturno');

  expect(texto).toContain(FICHAS['saturno']!.frase);
  expect(texto).toContain(FICHAS['saturno']!.curiosidade);

  // Sem caixa: os titulos das secoes da lateral sao desenhados em versalete por
  // CSS, e `innerText` devolve o que se VE — "MEDIDAS AGORA". Comparar com a
  // caixa exata mediria a folha de estilo, e nao a existencia do bloco.
  for (const bloco of [
    'Medidas agora',
    'Como ele gira',
    'Características físicas',
    'Curiosidade',
    'De onde vem a imagem',
    FONTES.titulo,
  ]) {
    expect(texto.toLowerCase(), `falta o bloco ${bloco}`).toContain(bloco.toLowerCase());
  }

  // A massa vem da tabela com os algarismos que a tabela tem. "568,000" seria
  // quinhentos e sessenta e oito MIL — tres ordens de grandeza de erro por
  // causa de casa decimal fixa, num numero que ninguem conferiria.
  expect(texto).toContain('568 × 10²⁴ kg');
  expect(texto, 'massa com casas decimais falsas').not.toContain('568,000');

  // Saturno gira em 10,66 h. "0,444 dias" e verdade e nao diz nada.
  expect(texto).toMatch(/uma rotação leva\s*\n?\s*10,7 horas/);

  // Periodo e distancia sao CALCULADOS: tem de ser o valor de agora, nao um
  // numero redondo de tabela.
  // Faixa, e nao valor: o periodo e OSCULADOR e balanca alguns dias com as
  // perturbacoes. Fixar o valor exato daria um teste que quebra sozinho.
  expect(texto, 'periodo de Saturno fora da faixa').toMatch(/10\.[5-9]\d\d dias \(29,\d+ anos\)/);
  expect(texto, 'distancia de Saturno fora da faixa').toMatch(/9,[0-6]\d\d\d UA/);

  // Nao ha superficie num gigante gasoso, e a ficha diz isso.
  expect(texto).toContain(PLANETAS['saturno']!.temperaturaReferencia);
  expect(texto).toContain('não há superfície sólida');

  // A procedencia do anel declara a conversao alfa -> profundidade optica.
  expect(texto).toContain('tau = −ln(1 − alfa)');
});

test('a ficha do Sol nao finge ser a de um planeta', async ({ page }) => {
  const texto = await abrirFicha(page, 'Sol');

  // O defeito que esta ficha existe para nao ter: na primeira versao o Sol
  // aparecia com "uma volta leva cerca de 0 dias", porque a leitura tratava a
  // ausencia de orbita como campo faltando em vez de grandeza de outra
  // natureza.
  expect(texto).not.toMatch(/0 dias/);
  expect(texto).toContain('não há período único');
  expect(texto).toContain('distância ao centro de massa');
  expect(texto).not.toContain('distância ao Sol');

  // O deslocamento em relacao ao centro de massa fica entre uns centenas de
  // milhares e uns dois raios solares — a faixa que Jupiter impoe.
  const km = Number(/([\d.]+) km/.exec(texto)?.[1]?.replace(/\./g, '') ?? '0');
  expect(km, 'deslocamento do Sol fora de qualquer faixa plausivel').toBeGreaterThan(100_000);
  expect(km).toBeLessThan(2_000_000);

  // O Sol nao esta na tabela de planetas: nao inventa massa nem gravidade.
  expect(texto).not.toContain('gravidade no equador');
});

test('a ficha de Vênus diz que ele gira ao contrário', async ({ page }) => {
  const texto = await abrirFicha(page, 'Vênus');
  expect(texto).toContain('ao contrário dos outros');
  expect(texto, 'a massa de Vênus e 4,87').toContain('4,87 × 10²⁴ kg');
  expect(texto, 'a massa da Terra vazou para a ficha de Vênus').not.toContain('5,97');
});

test('a matemática do Sol soma o que diz somar, e Júpiter lidera', async ({ page }) => {
  await acionar(page, 'Mais opções');
  await acionar(page, 'A matemática do Sol');
  await expect(page.getByRole('dialog')).toBeVisible();

  const linhas = await page.locator('dialog[open] .tabela tbody tr').evaluateAll((trs) =>
    trs.map((tr) => {
      const c = [...tr.children].map((x) => (x.textContent ?? '').trim());
      return { nome: c[0]!, aceleracao: c[1]!, comparada: c[2]! };
    }),
  );

  expect(linhas.length, 'faltam sistemas planetarios na tabela').toBe(8);
  expect(linhas[0]!.nome, 'quem puxa mais o Sol e Júpiter').toBe('Júpiter');
  expect(linhas[0]!.comparada, 'a maior puxada nao se compara consigo mesma').toBe('—');

  // A tabela e ordenada: cada linha puxa menos que a anterior.
  const forcas = linhas.map((l) => Number(l.aceleracao.replace(',', '.')));
  for (let i = 1; i < forcas.length; i++) {
    expect(forcas[i]!, `${linhas[i]!.nome} fora de ordem`).toBeLessThanOrEqual(forcas[i - 1]!);
  }

  // A aceleracao de Jupiter sobre o Sol e da ordem de 2e-7 m/s^2.
  expect(forcas[0]!).toBeGreaterThan(1e-8);
  expect(forcas[0]!).toBeLessThan(1e-6);

  // A coluna compara com a maior, e por isso fica sempre abaixo de 100%.
  for (const l of linhas.slice(1)) {
    const pct = Number(l.comparada.replace('%', '').replace(',', '.'));
    expect(pct, `${l.nome}: ${l.comparada}`).toBeGreaterThan(0);
    expect(pct, `${l.nome} puxa mais que Júpiter?`).toBeLessThan(100);
  }

  const texto = await page.locator('dialog[open] .modal__corpo').innerText();
  expect(texto).toContain('a = GM / d²');
  // A resultante e MENOR que a soma dos modulos porque as parcelas se
  // cancelam em parte. Uma coluna de "fracao do total" somaria 147% e o leitor
  // culparia o programa — com razao. O texto tem de dizer por que.
  expect(texto).toContain('menor que a soma das puxadas');
  const resultante = Number(/aceleração resultante\s*\n?\s*([\d,]+e[-+]\d+)/.exec(texto)?.[1]?.replace(',', '.') ?? '0');
  expect(resultante, 'a resultante nao foi lida').toBeGreaterThan(0);
  expect(
    resultante,
    'a resultante ficou maior que a soma dos modulos — a soma virou aritmetica',
  ).toBeLessThan(forcas.reduce((t, f) => t + f, 0));
});

test('comparar dois corpos mostra as voltas no mesmo intervalo', async ({ page }) => {
  await acionar(page, 'Mercúrio');
  await acionar(page, 'Comparar corpos');
  await expect(page.getByRole('dialog')).toBeVisible();
  // O lado B comeca vazio. O primeiro "Próximo" pousa no Sol, que nunca entra
  // na comparacao — a tela explica por que —, e o segundo chega em Mercúrio.
  await acionar(page, 'Próximo corpo no lado B');
  await expect(page.getByRole('dialog')).toContainText('O Sol não entra na comparação');
  await acionar(page, 'Próximo corpo no lado B');

  const texto = await page.locator('dialog[open] .modal__corpo').innerText();
  expect(texto).toContain('voltas nesse tempo');
  // O mais lento dos dois da exatamente uma volta, por construcao do intervalo.
  expect(texto).toMatch(/1,00/);
  expect(texto).toContain('Velocidade × tempo não dá a distância percorrida');
});

test('as atividades trazem tarefa e resposta, as seis dicas e nada em construção', async ({ page }) => {
  await acionar(page, 'Mais opções');
  await acionar(page, 'Atividades');
  const texto = await page.locator('dialog[open] .modal__corpo').innerText();

  for (const a of ATIVIDADES) {
    expect(texto, `falta a atividade ${a.titulo}`).toContain(a.titulo);
    expect(texto).toContain(a.tarefa);
    expect(texto).toContain(a.resposta);
  }
  expect(texto.toLowerCase()).not.toContain('em construção');
});

test('a ajuda traz os três blocos de honestidade e a tabela de fontes', async ({ page }) => {
  await acionar(page, 'Ajuda');
  const texto = await page.locator('dialog[open] .modal__corpo').innerText();

  for (const bloco of [HONESTIDADE.calcula, HONESTIDADE.simplifica, HONESTIDADE.naoInclui]) {
    expect(texto, `falta "${bloco.titulo}"`).toContain(bloco.titulo);
    for (const paragrafo of bloco.texto.split('\n\n')) {
      expect(texto, `paragrafo perdido em "${bloco.titulo}"`).toContain(paragrafo);
    }
  }

  expect(texto).toContain(FONTES.titulo);
  for (const b of FONTES.blocos) {
    expect(texto, `falta a fonte "${b.nome}"`).toContain(b.nome);
  }
  expect(texto).toContain('Solar System Scope');

  // A tabela de atalhos e a de verdade, e nao uma copia escrita a mao que
  // pode divergir do mapa de teclas.
  const linhas = await page.locator('dialog[open] .tabela tbody tr').count();
  expect(linhas).toBeGreaterThan(10);
});

test('a orientação de primeira abertura aparece uma vez, e não volta', async ({ page }) => {
  await abrir(page, { tutorialVisto: false });
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('heading', { level: 2 })).toHaveText('Bem-vindo');

  const texto = await page.locator('dialog[open] .modal__corpo').innerText();
  for (const t of TUTORIAL) {
    expect(texto, `falta a etapa ${t.titulo}`).toContain(t.titulo);
    expect(texto).toContain(t.texto);
  }

  await page.keyboard.press('Escape');
  await expect(dialogo).not.toBeVisible();

  // Fechar no Esc TAMBEM marca como visto. Reabrir a mesma caixa para quem ja
  // disse que nao quer e a forma mais rapida de ensinar a fechar sem ler.
  await page.waitForTimeout(600); // a gravacao das preferencias e atrasada
  await page.reload();
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('as luas aparecem na lista lateral, agrupadas sob o planeta delas', async ({ page }) => {
  // O outro caminho, que não existia: por teclado, dentro da própria lista.
  // Um `listbox > group > option` — e não um `tree`, que tomaria a seta direita
  // para abrir nós em vez de andar na lista.
  await expect(page.getByRole('option')).toHaveCount(9);
  await acionar(page, 'Júpiter');

  // Dentro do listbox: `<details>` também é `role=group`, e "Mais opções" é um.
  const lista = page.getByRole('listbox', { name: /corpos/i });
  const grupo = lista.getByRole('group', { name: '4 luas de Júpiter' });
  await expect(grupo).toBeVisible();
  for (const lua of ['Io', 'Europa', 'Ganimedes', 'Calisto']) {
    await expect(grupo.getByRole('option', { name: new RegExp(`^${lua}`) })).toBeVisible();
  }
  // E a natureza vai ESCRITA no rótulo, porque "Io" sozinho não diz que é lua.
  await expect(grupo.getByRole('option', { name: 'Io, lua' })).toBeVisible();

  // "Sem" tira todas, e o grupo some junto.
  await page.getByRole('radio', { name: 'Sem' }).click();
  await expect(page.getByRole('option')).toHaveCount(9);
  await expect(lista.getByRole('group')).toHaveCount(0);

  // "Só elas" abre todos os grupos de uma vez — as 13 luas mais os 9 corpos.
  await page.getByRole('radio', { name: 'Só elas' }).click();
  await expect(page.getByRole('option')).toHaveCount(22);
  // Os planetas CONTINUAM na lista: uma lua sem o planeta dela não diz em
  // torno de quê gira, e o texto do controle promete exatamente isso.
  await expect(page.getByRole('option', { name: /^Saturno/ })).toBeVisible();
});

test('escolher uma lua mostra a ficha dela, com o desvio do modelo escrito', async ({ page }) => {
  await acionar(page, 'Júpiter');
  await acionar(page, 'Europa');
  const ficha = page.locator('.ficha');
  await expect(ficha.getByRole('heading', { level: 2 })).toHaveText('Europa');
  // A ficha de uma lua é de outra natureza: ela não orbita o Sol.
  await expect(ficha).toContainText('orbita');
  await expect(ficha).toContainText('Júpiter');
  await expect(ficha).not.toContainText('distância ao Sol');

  await acionar(page, 'Ficha inteira');
  const texto = await ficha.innerText();
  // O desvio publicado é o número que separa esta lua de uma efeméride, e a
  // ficha dela é onde ele tem de estar escrito.
  expect(texto.toLowerCase()).toContain('o quanto isto erra');
  expect(texto).toMatch(/\d[\d.]* km/);
  expect(texto).toContain('vinte anos');
});

test('a tabela de dados lista os nove corpos com o que a cena mostra', async ({ page }) => {
  await acionar(page, 'Ver como tabela');
  // A PRIMEIRA tabela: a segunda é a das luas, e contá-las juntas mediria a
  // soma das duas em vez da lista de corpos.
  const linhas = await page.locator('dialog[open] .tabela').first().locator('tbody tr')
    .evaluateAll((trs) => trs.map((tr) => [...tr.children].map((x) => (x.textContent ?? '').trim())));
  expect(linhas.length).toBe(9);
  expect(linhas[0]![0]).toBe('Sol');
  expect(linhas[0]![3]).toBe('não há período único');
  expect(linhas[8]![0]).toBe('Netuno');
  expect(linhas[8]![3], 'o periodo de Netuno saiu da faixa').toMatch(/6\d\.\d\d\d dias/);
});

test('as luas também estão na tabela — elas não podem existir só no canvas', async ({ page }) => {
  // "Nada existe só no canvas" é regra do projeto desde a primeira versão.
  //
  // As luas ENTRARAM na lista lateral depois que esta tabela foi escrita — elas
  // são agrupadas sob o planeta, e a lista é navegável por teclado. A tabela
  // continua, e não por inércia: ela tem as duas colunas que a lista não tem e
  // que são as mais importantes sobre uma lua neste programa — a distância ao
  // planeta e o DESVIO MEDIDO do modelo de órbita contra a efeméride. Uma lista
  // diz quais luas existem; esta tabela diz o quanto a posição delas erra.
  await acionar(page, 'Ver como tabela');
  const tabelas = page.locator('dialog[open] .tabela');
  await expect(tabelas).toHaveCount(2);

  const luas = await tabelas.nth(1).locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.children].map((x) => (x.textContent ?? '').trim())),
  );
  expect(luas.length, 'as treze luas').toBe(13);

  const porNome = Object.fromEntries(luas.map((l) => [l[0]!, l]));
  expect(porNome['Lua']![1], 'a Lua orbita a Terra').toBe('Terra');
  expect(porNome['Io']![1]).toBe('Júpiter');
  expect(porNome['Tritão']![1]).toBe('Netuno');
  // A distância e o período de Io, arredondados: 421.800 km e 1,78 dia.
  expect(porNome['Io']![2]).toBe('421.800 km');
  expect(porNome['Io']![3]).toMatch(/1,7[0-9] dias/);
  // E o desvio publicado, que é o que torna a linha honesta.
  for (const l of luas) {
    expect(l[4], `${l[0]} sem desvio`).toMatch(/^\d[\d.]* km$/);
  }
  await expect(page.getByRole('dialog')).toContainText('não entram no cálculo da gravidade');
});

test('os dados técnicos entregam as quatro coisas que a opção promete', async ({ page }) => {
  // "Mostra passo de integração, energia, desempenho e qual placa está
  // desenhando." A tela entregava so a ultima. Uma promessa escrita e uma
  // funcionalidade, do ponto de vista de quem le.
  await expect(page.locator('.tecnico')).toHaveCount(0);

  // "Mostrar dados técnicos" mudou de gaveta: ele e sobre QUEM LE, e nao
  // sobre como a cena e desenhada, e agora mora em "Leitura".
  await acionar(page, 'Leitura');
  // O alternador e um <input type="checkbox"> dentro de um <label>: e o
  // Espaco que o aciona, nao o Enter. Ligar a opcao pelo teclado faz parte do
  // que se esta verificando.
  const alternador = page.getByRole('checkbox', { name: /Mostrar dados técnicos/ });
  await alternador.focus();
  await page.keyboard.press(' ');
  await expect(alternador).toBeChecked();

  const painel = page.locator('.tecnico');
  await expect(painel).toBeVisible();

  const linhas = await painel.evaluateAll((ns) =>
    [...ns[0]!.querySelectorAll('div')].map((d) => ({
      termo: d.querySelector('dt')!.textContent!.trim(),
      valor: d.querySelector('dd')!.textContent!.trim(),
    })),
  );
  const valorDe = (t: string): string => linhas.find((l) => l.termo === t)?.valor ?? '';

  expect(valorDe('passo'), 'o passo de integração').toBe('0,5 dia');
  expect(valorDe('corpos')).toBe('9');
  expect(valorDe('desenho'), 'qual placa desenha').toMatch(/webgpu|webgl2/i);
  expect(valorDe('quadro'), 'desempenho').toMatch(/\d+,\d ms de \d+,\d/);

  // O numero que sustenta a escolha do integrador. Num simpletico ele oscila
  // em torno de zero; num Euler cresceria sem voltar. Depois de um tempo
  // correndo depressa, ele continua pequeno — e essa e a afirmacao inteira.
  await page.getByRole('button', { name: 'Aumentar a velocidade do tempo' }).click({ clickCount: 4 });
  await page.waitForTimeout(2500);

  const depois = await painel.evaluate((n) =>
    [...n.querySelectorAll('div')]
      .map((d) => [d.querySelector('dt')!.textContent!.trim(), d.querySelector('dd')!.textContent!.trim()])
      .filter(([t]) => t!.startsWith('desvio')),
  );
  for (const [termo, valor] of depois) {
    const v = Number(valor!.replace(',', '.'));
    expect(v, `${termo} = ${valor} nao e um numero`).not.toBeNaN();
    expect(v, `${termo} cresceu demais: o integrador deixou de ser simplético?`).toBeLessThan(1e-6);
  }
  expect(depois.length, 'nem energia nem momento angular estao no painel').toBe(2);
});
