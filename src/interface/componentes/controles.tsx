/**
 * Os controles basicos.
 *
 * Uma regra herdada vale para todos, e esta escrita no projeto anterior assim:
 *
 *   "Botoes: texto sempre, icone nunca sozinho. Requisito do projeto e boa
 *    pratica: o controle precisa dizer por escrito o que faz. Um icone de
 *    engrenagem exige que a pessoa ja conheca a convencao. 'Mais opções' nao
 *    exige."
 *
 * `testes/botoes.test.ts` le a arvore que cada componente devolve e confere os
 * atributos de acessibilidade um a um; `e2e/acessibilidade.spec.ts` varre a
 * tela montada e falha se algum `<button>` sair sem texto E sem `aria-label`.
 * Os dois juntos sao a regra: aqui se prova que o componente oferece o caminho,
 * la se prova que ninguem tomou o outro.
 *
 * O primeiro deles ficou CITADO E INEXISTENTE por varias fases — a mesma classe
 * de defeito que a auditoria do CONTRATO.md achou em catorze outros lugares.
 *
 * A segunda regra: **nunca informacao so por cor**. O alternador desenha um
 * "✓"; o botao ativo ganha uma barra sublinhada E `aria-pressed`; o corpo
 * acompanhado ganha anel tracejado. Cor sempre acompanha forma ou palavra.
 */
import type { ComponentChildren, JSX } from 'preact';
import { paraCss, type Cor } from '../contraste.ts';

interface BotaoProps {
  children: ComponentChildren;
  onClick: () => void;
  /** Deixa o botao com peso visual maior. E o unico da barra que tem isso. */
  primario?: boolean;
  /** Marca estado ligado. Desenha a barra E emite aria-pressed. */
  ativo?: boolean;
  desabilitado?: boolean;
  /** Quando o texto visivel nao basta para quem usa leitor de tela. */
  rotulo?: string;
  titulo?: string;
}

export function Botao({ children, onClick, primario, ativo, desabilitado, rotulo, titulo }: BotaoProps): JSX.Element {
  const classes = ['botao'];
  if (primario) classes.push('botao--primario');
  if (ativo) classes.push('botao--ativo');
  return (
    <button
      type="button"
      class={classes.join(' ')}
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={ativo === undefined ? undefined : ativo}
      aria-label={rotulo}
      title={titulo}
    >
      {children}
    </button>
  );
}

interface OpcaoSegmentada<T extends string> {
  valor: T;
  texto: string;
}

interface GrupoProps<T extends string> {
  rotulo: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  valor: T;
  onEscolher: (valor: T) => void;
}

/**
 * Escolha exclusiva. E um `radiogroup` de verdade, e nao uma fila de botoes:
 * assim o leitor de tela anuncia "2 de 3" e as setas navegam entre as opcoes,
 * que e o que a pessoa espera de um grupo exclusivo.
 *
 * ## As setas, que o cabecalho prometia e o codigo nao fazia
 *
 * Esta frase estava escrita aqui desde a primeira versao e era falsa: os tres
 * botoes eram tabulaveis um a um e nenhuma seta fazia nada. Agora ha **roving
 * tabindex**: um Tab entra no grupo pela opcao marcada, as setas escolhem, Home
 * e End vao aos extremos, e um segundo Tab sai do grupo. E o padrao ARIA de
 * radiogroup, e e o que faz "3 opcoes" custar um Tab em vez de tres.
 *
 * **`stopPropagation` nao e zelo.** As quatro setas ja sao atalhos globais que
 * giram e deslocam a camera (`app/atalhos.ts`). Sem parar o evento aqui,
 * escolher "Planetas internos" com a seta giraria a cena ao mesmo tempo — e
 * `escopoDeTeclado.ts` nao resolve isto sozinho, porque ele isenta `role`
 * `button`, `option` e `listbox`, e nao `radio`. Parar aqui e o lugar certo: o
 * componente que da significado novo a tecla e o que a consome.
 */
export function GrupoSegmentado<T extends string>({ rotulo, opcoes, valor, onEscolher }: GrupoProps<T>): JSX.Element {
  const atual = Math.max(0, opcoes.findIndex((o) => o.valor === valor));

  function aoTeclar(ev: JSX.TargetedKeyboardEvent<HTMLDivElement>): void {
    const passo =
      ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
        ? 1
        : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
          ? -1
          : 0;
    let destino: number;
    if (passo !== 0) destino = (atual + passo + opcoes.length) % opcoes.length;
    else if (ev.key === 'Home') destino = 0;
    else if (ev.key === 'End') destino = opcoes.length - 1;
    else return;

    ev.preventDefault();
    ev.stopPropagation();
    const escolhida = opcoes[destino];
    if (!escolhida) return;
    onEscolher(escolhida.valor);
    // O foco segue a escolha, senao o proximo toque de seta partiria da opcao
    // velha e a navegacao andaria de um em um para sempre.
    const grupo = ev.currentTarget;
    (grupo.children[destino] as HTMLElement | undefined)?.focus();
  }

  return (
    <div class="segmentado" role="radiogroup" aria-label={rotulo} onKeyDown={aoTeclar}>
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          tabIndex={i === atual ? 0 : -1}
          class={`segmentado__item${o.valor === valor ? ' segmentado__item--ativo' : ''}`}
          onClick={() => onEscolher(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

interface AlternadorProps {
  texto: string;
  ligado: boolean;
  onAlternar: () => void;
  /** Uma linha explicando o que a opcao faz, quando o nome nao basta. */
  ajuda?: string;
}

/**
 * ## A ajuda saiu de DENTRO do `<label>`
 *
 * Ela era um `<small>` dentro do rotulo, e tudo o que esta dentro de um
 * `<label>` entra no nome acessivel do campo. O leitor de tela anunciava
 * "Caminhos previstos. A elipse que cada planeta seguiria se so o Sol
 * existisse. Caixa de selecao, marcada" — a frase inteira, a cada passagem,
 * antes de dizer o estado. Agora ela e um `<p>` irmao, ligado por
 * `aria-describedby`: continua sendo lida, mas DEPOIS do nome e do estado, que
 * e a ordem que a descricao existe para ter.
 */
/**
 * O identificador da ajuda vem do TEXTO, e nao de `useId`.
 *
 * `useId` e um hook, e um hook exige um renderizador montado: `botoes.test.ts`
 * chama estes componentes como funcoes puras, de proposito — o ambiente dos
 * testes unitarios e `node`, sem DOM, e acrescentar `jsdom` so para conferir
 * atributos seria pagar um navegador para ler um objeto. Um identificador
 * derivado do rotulo nao precisa de nada disso, e de quebra sai legivel no
 * DOM. A unicidade e conferida na tela montada: o axe reprova `id` repetido,
 * em `e2e/acessibilidade.spec.ts`.
 */
function idDaAjuda(texto: string): string {
  const limpo = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `ajuda-${limpo}`;
}

export function Alternador({ texto, ligado, onAlternar, ajuda }: AlternadorProps): JSX.Element {
  const id = idDaAjuda(texto);
  return (
    <div class="alternador">
      <label class="alternador__linha">
        <input
          type="checkbox"
          checked={ligado}
          onChange={onAlternar}
          aria-describedby={ajuda ? id : undefined}
        />
        {/* O "✓" e desenhado, e nao so uma mudanca de cor: a informacao precisa
            sobreviver a quem nao distingue as duas cores. */}
        <span class="alternador__caixa" aria-hidden="true">
          {ligado ? '✓' : ''}
        </span>
        <span class="alternador__texto">{texto}</span>
      </label>
      {ajuda ? (
        <p class="alternador__ajuda" id={id}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

interface PontoProps {
  cor: Cor;
}

/**
 * O ponto colorido ao lado de um nome.
 *
 * E o que permite mostrar a cor do corpo sem NUNCA escrever o nome nessa cor —
 * Netuno da 4,4997:1 contra o fundo e reprovaria como texto. Ele e decorativo
 * por construcao: o nome escrito ao lado carrega a informacao inteira.
 */
export function Ponto({ cor }: PontoProps): JSX.Element {
  return <span class="ponto" style={{ background: paraCss(cor) }} aria-hidden="true" />;
}

interface PainelProps {
  titulo: string;
  aberto: boolean;
  onAlternar: () => void;
  children: ComponentChildren;
}

/**
 * "Mais opções". `<details>` nativo: abre com Enter e com Espaco, anuncia o
 * estado, e funciona sem JavaScript — nada disso precisou ser escrito.
 */
export function PainelRecolhivel({ titulo, aberto, onAlternar, children }: PainelProps): JSX.Element {
  return (
    <details
      class="recolhivel"
      open={aberto}
      onToggle={(ev: Event) => {
        const alvo = ev.currentTarget as HTMLDetailsElement;
        if (alvo.open !== aberto) onAlternar();
      }}
    >
      <summary class="recolhivel__titulo">{titulo}</summary>
      <div class="recolhivel__corpo">{children}</div>
    </details>
  );
}
