/**
 * As seis dicas precisam ser ALCANCAVEIS, e nao apenas existir.
 *
 * No programa anterior elas existiam e ninguem as veria. A acao `MostrarDica`
 * era importada e nunca construida em lugar nenhum, e o unico botao que
 * chamava uma dica vivia DENTRO de uma caixa de dica ja aberta: quem nunca
 * abrisse a primeira nunca abriria nenhuma. Seis respostas escritas com
 * cuidado, inacessiveis por construcao.
 *
 * Um teste que perguntasse "a chave existe em DICAS?" teria passado verde
 * naquele programa. Por isso este aqui NAO olha o dicionario para decidir o
 * que e alcancavel: ele parte da tela principal, aciona o que da para acionar
 * **pelo teclado**, repete ate o conjunto de estados parar de crescer, e so
 * entao pergunta se as seis perguntas apareceram.
 *
 * **Acionar e focar e apertar Enter**, e nao clicar. Clicar passaria por cima
 * de tres coisas que o requisito cobre: um controle fora da area visivel, um
 * controle que so o mouse alcanca, e um controle que o navegador recusa por
 * estar sob um modal inerte. O link de pular para a simulacao e exatamente o
 * primeiro caso — ele fica fora da tela ate receber foco, e a primeira versao
 * deste teste morreu tentando clicar nele.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';
import { DICAS } from '../../src/dados/textos.ts';

/**
 * Quantos passos a busca percorre a partir da tela principal.
 *
 * Tres, e nao quatro. O caminho real e "Ir para" -> "Atividades" -> a
 * dica, e o limite mais apertado e uma afirmacao MAIS FORTE: ele exige que as
 * dicas estejam a tres passos, e nao a quatro. Com quatro, a busca varria
 * 240 estados e levava dois minutos e meio depois que o modo Criar entrou.
 */
const PROFUNDIDADE_MAXIMA = 3;
/**
 * Teto da busca, e nao um limite semantico.
 *
 * Era 60, e o modo Criar acrescentou um ramo inteiro — cinco predefinicoes,
 * um controle de velocidade, a lista do que foi criado — que empurrou a
 * contagem para 240. A lista em dois niveis empurrou de novo: escolher um dos
 * seis planetas com lua REVELA opcoes que nao existiam, entao seis selecoes que
 * antes colapsavam num estado so agora sao seis estados, cada um com os seus
 * ramos. Somam-se os tres estados do controle de luas e o modo imersivo, que
 * recolhe a barra e a lateral inteiras.
 *
 * Levantar o teto continua sendo a resposta certa: o numero mede o tamanho do
 * programa, nao uma regra sobre ele. Podar o ramo do sandbox ou o das luas
 * "porque ali nao ha dica" seria podar por conhecimento, que e exatamente o que
 * uma busca de alcancabilidade nao pode fazer.
 */
const ESTADOS_MAXIMOS = 700;
/** Backstop de escapada: nenhum caminho real precisa de tanta acao. */
const ACOES_MAXIMAS = 4000;

const SELETOR = 'button:not([disabled]), summary, a[href], [role="option"]';

/**
 * O nome acessivel de cada controle acionavel AGORA.
 *
 * Com um `<dialog>` modal aberto, o resto da pagina esta inerte: os controles
 * de tras continuam no DOM e o navegador recusa aciona-los. Olhar o documento
 * inteiro contaria como alcancavel o que nao e.
 *
 * Os distintivos de estado saem do rotulo. "Terra" e "Terra, selecionado como
 * A" sao o mesmo controle; sem normalizar, cada selecao inventaria um estado
 * novo e a busca nunca fecharia.
 *
 * A NATUREZA tambem sai, pelo mesmo motivo: a lista passou a escrever "Júpiter,
 * 4 luas" e "Io, lua" no rotulo acessivel, e sao os mesmos controles de antes
 * com mais informacao para quem usa leitor de tela. O que NAO sai e a abertura
 * do grupo: escolher Júpiter revela quatro opcoes que nao existiam, e isso e um
 * estado novo de verdade — e por isso o teto de estados subiu.
 */
async function controlesVisiveis(pagina: Page): Promise<string[]> {
  return pagina.evaluate((seletor) => {
    const dialogo = document.querySelector('dialog[open]');
    const raiz: ParentNode = dialogo ?? document.body;
    return [...raiz.querySelectorAll(seletor)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) =>
        (el.getAttribute('aria-label') ?? el.textContent ?? '')
          .trim()
          .replace(/,\s*(lua|\d+ luas?|criado por você|selecionado como A|escolhido como B|acompanhado)/g, ''),
      )
      .filter((t) => t !== '');
  }, SELETOR);
}

const assinar = (controles: string[]): string => [...controles].sort().join('|');

/** Foca o controle de nome `rotulo` e aperta Enter. Falso se ele nao pegou foco. */
async function acionar(pagina: Page, rotulo: string): Promise<boolean> {
  const focou = await pagina.evaluate(
    ({ seletor, alvo }) => {
      const dialogo = document.querySelector('dialog[open]');
      const raiz: ParentNode = dialogo ?? document.body;
      const el = [...raiz.querySelectorAll(seletor)].find(
        (e) =>
          (e.getAttribute('aria-label') ?? e.textContent ?? '')
            .trim()
            .replace(/,\s*(lua|\d+ luas?|criado por você|selecionado como A|escolhido como B|acompanhado)/g, '') === alvo,
      );
      if (!(el instanceof HTMLElement)) return false;
      el.focus();
      return document.activeElement === el;
    },
    { seletor: SELETOR, alvo: rotulo },
  );
  if (!focou) return false;
  await pagina.keyboard.press('Enter');
  await pagina.waitForTimeout(50);
  return true;
}

test('toda dica e alcancavel a partir da tela principal, so com o teclado', async ({ page }) => {
  test.setTimeout(300_000);

  const perguntas = Object.values(DICAS).map((d) => d.pergunta);
  const assinaturasVistas = new Set<string>();
  const rotulosVistos = new Set<string>();
  let acoes = 0;

  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();

  /** Refaz o caminho do zero. Caro, mas nao presume que todo controle tem inverso. */
  async function refazer(caminho: string[]): Promise<void> {
    await abrir(page);
    await expect(page.getByRole('banner')).toBeVisible();
    for (const passo of caminho) await acionar(page, passo);
  }

  /**
   * Volta ao estado de onde se saiu. Tenta o barato primeiro — Esc fecha
   * modal, e reacionar um `<summary>` o fecha de novo — e confere pela
   * assinatura. So recarrega quando o barato nao devolveu o mesmo estado.
   */
  async function voltar(caminho: string[], esperada: string, rotulo: string): Promise<void> {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
    if (assinar(await controlesVisiveis(page)) === esperada) return;
    await acionar(page, rotulo);
    if (assinar(await controlesVisiveis(page)) === esperada) return;
    await refazer(caminho);
  }

  async function explorar(caminho: string[]): Promise<void> {
    const controles = await controlesVisiveis(page);
    for (const c of controles) rotulosVistos.add(c);

    const assinatura = assinar(controles);
    if (assinaturasVistas.has(assinatura)) return;
    assinaturasVistas.add(assinatura);
    if (caminho.length >= PROFUNDIDADE_MAXIMA) return;

    for (const c of controles) {
      if (assinaturasVistas.size >= ESTADOS_MAXIMOS || acoes >= ACOES_MAXIMAS) return;
      // "Fechar" so desfaz, e "Pausar"/"Continuar" trocam o rotulo um do outro:
      // segui-los multiplicaria caminhos sem alcancar estado novo.
      if (/^(Fechar|Pausar|Continuar)$/.test(c)) continue;
      acoes++;
      if (!(await acionar(page, c))) continue;
      await explorar([...caminho, c]);
      await voltar(caminho, assinatura, c);
    }
  }

  await explorar([]);

  expect(
    assinaturasVistas.size,
    `a busca bateu no teto de estados (${assinaturasVistas.size}) antes de fechar`,
  ).toBeLessThan(ESTADOS_MAXIMOS);
  expect(acoes, `a busca bateu no teto de acoes (${acoes}) antes de fechar`)
    .toBeLessThan(ACOES_MAXIMAS);
  // Se a busca nao andou, o resto do teste nao mede nada.
  expect(assinaturasVistas.size, 'a busca nao saiu do lugar').toBeGreaterThan(3);

  const faltando = perguntas.filter((p) => !rotulosVistos.has(p));
  expect(
    faltando,
    `dicas que ninguem alcancaria a partir da tela principal, em ${PROFUNDIDADE_MAXIMA} passos:\n  ` +
      faltando.join('\n  '),
  ).toEqual([]);
});

test('cada dica mostra a resposta dela, e nao a de outra', async ({ page }) => {
  await abrir(page);
  // "Atividades" mudou de gaveta: "Mais opções" e sobre como a cena e
  // desenhada, e ir a uma atividade e ir a outro lugar.
  await acionar(page, 'Ir para');
  await acionar(page, 'Atividades');
  await expect(page.getByRole('dialog')).toBeVisible();

  for (const [chave, dica] of Object.entries(DICAS)) {
    expect(await acionar(page, dica.pergunta), `${chave} nao pegou foco`).toBe(true);
    const dialogo = page.getByRole('dialog');
    await expect(dialogo, chave).toContainText(dica.pergunta);
    // O primeiro paragrafo, e nao a resposta inteira: o texto quebra em varios
    // <p> e a comparacao precisa sobreviver a isso.
    await expect(dialogo, chave).toContainText(dica.resposta.split('\n\n')[0]!);
    await acionar(page, 'Ver as outras');
  }
});
