/**
 * A lista de corpos, em dois niveis: cada planeta e, sob ele, as luas dele.
 *
 * **Nao e decoracao: e a interface de teclado para escolher um corpo.** Clicar
 * num planeta desenhado e um gesto de mouse sobre um canvas, e um canvas e um
 * retangulo opaco para quem usa leitor de tela. Se esta lista sumisse em janela
 * estreita, escolher um corpo passaria a exigir mouse.
 *
 * E um `listbox` de verdade, com tabindex movel: um unico Tab entra na lista, e
 * as setas percorrem as opcoes. Uma fila de trinta botoes gastaria trinta Tabs.
 *
 * **Por que `group` e nao `tree`.** Um `tree` exige que cada no abra e feche por
 * conta propria, com `aria-expanded`, seta para a direita abrindo e para a
 * esquerda fechando — e ai a seta direita deixa de andar na lista, que e o que
 * ela faz hoje. ARIA 1.2 permite `listbox > group > option`, o leitor de tela
 * anuncia o nome do grupo ao entrar nele, e a navegacao continua sendo uma fila
 * so. Menos poder, e o poder que sobra e o que serve aqui.
 *
 * **Quais luas aparecem** e uma regra, e nao um estado por planeta: as luas de
 * um planeta aparecem quando ele e o corpo escolhido, e em "só as luas"
 * aparecem todas. Sem isso a lista nasce com trinta linhas e a escolha de um
 * planeta some no meio delas; com um botao de abrir por planeta, seriam nove
 * controles novos para um problema que uma regra resolve.
 *
 * Shift+Enter escolhe o corpo como **B**, o lado de comparacao. E o unico gesto
 * de teclado com Shift aqui, e ele tem equivalente escrito no modal de
 * comparacao — nenhum atalho e a unica forma de fazer alguma coisa.
 */
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { Ponto } from './controles.tsx';
import { corDoCorpo } from '../../dados/cores.ts';
import { despachar, ui } from '../estado.ts';
import type { IdCorpo, VisibilidadeDasLuas } from '../../contratos/ids.ts';

export interface ItemDeCorpo {
  chave: IdCorpo;
  nome: string;
  /** `lua` muda a linha: ela indenta, encolhe e ganha o nome do pai no rótulo. */
  tipo: 'corpo' | 'lua';
  /** Só em luas: a chave do planeta que ela orbita. */
  pai?: IdCorpo;
  /** Só em corpos criados. A linha ganha o aviso de que ele não é do JPL. */
  criado?: boolean;
}

interface Props {
  corpos: readonly ItemDeCorpo[];
  luas: VisibilidadeDasLuas;
}

/** Um planeta e as luas dele, na ordem em que a lista desenha. */
interface Grupo {
  pai: ItemDeCorpo;
  luas: readonly ItemDeCorpo[];
  /** As luas deste grupo estão desdobradas nesta renderização. */
  aberto: boolean;
}

export function agrupar(
  corpos: readonly ItemDeCorpo[],
  luas: VisibilidadeDasLuas,
  escolhido: IdCorpo | null,
): readonly Grupo[] {
  const paiDoEscolhido = corpos.find((c) => c.chave === escolhido)?.pai ?? escolhido;
  return corpos
    .filter((c) => c.tipo !== 'lua')
    .map((pai): Grupo => {
      const filhas = luas === 'sem' ? [] : corpos.filter((c) => c.pai === pai.chave);
      return {
        pai,
        luas: filhas,
        // Em "só as luas" abrem todas; em "com" abre o grupo do corpo escolhido
        // — e tambem quando o escolhido E uma lua, senao escolher uma lua
        // fecharia a linha em que ela esta.
        aberto: filhas.length > 0 && (luas === 'so' || paiDoEscolhido === pai.chave),
      };
    });
}

/** A ordem em que o teclado anda: exatamente a ordem desenhada. */
export function ordemVisivel(grupos: readonly Grupo[]): readonly ItemDeCorpo[] {
  const fila: ItemDeCorpo[] = [];
  for (const g of grupos) {
    fila.push(g.pai);
    if (g.aberto) fila.push(...g.luas);
  }
  return fila;
}

const plural = (n: number): string => (n === 1 ? '1 lua' : `${n} luas`);

export function ListaDeCorpos({ corpos, luas }: Props): JSX.Element {
  const e = ui.value;
  const ref = useRef<HTMLDivElement>(null);
  const grupos = agrupar(corpos, luas, e.selecionado);
  const fila = ordemVisivel(grupos);
  const ativo = e.selecionado ?? fila[0]?.chave ?? null;

  function irPara(chave: IdCorpo): void {
    despachar({ tipo: 'selecionar', chave });
    // O foco vai no quadro seguinte: mover a selecao pode ABRIR um grupo, e a
    // linha de destino talvez ainda nao exista no DOM neste instante. Sem o
    // adiamento, escolher a ultima lua de um grupo que acabou de abrir deixava o
    // foco no `<body>` e a seta seguinte nao fazia nada.
    requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>(`[data-chave="${chave}"]`)?.focus();
    });
  }

  function mover(passo: -1 | 1): void {
    const i = fila.findIndex((c) => c.chave === ativo);
    const j = Math.min(fila.length - 1, Math.max(0, (i < 0 ? 0 : i) + passo));
    const alvo = fila[j];
    if (alvo) irPara(alvo.chave);
  }

  function aoTeclar(ev: KeyboardEvent): void {
    const acoes: Record<string, () => void> = {
      ArrowDown: () => mover(1),
      ArrowUp: () => mover(-1),
      ArrowRight: () => mover(1),
      ArrowLeft: () => mover(-1),
      Home: () => {
        const p = fila[0];
        if (p) irPara(p.chave);
      },
      End: () => {
        const p = fila[fila.length - 1];
        if (p) irPara(p.chave);
      },
    };
    const acao = acoes[ev.key];
    if (acao) {
      ev.preventDefault();
      ev.stopPropagation();
      acao();
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      // O alvo e o item EM FOCO, lido do evento — e nao `ativo`, que vem do
      // estado. Os dois andam juntos quando as setas movem, porque `mover` muda
      // os dois; mas qualquer outro caminho ate o foco (o Tab de volta para a
      // lista, um focus() programatico, um leitor de tela navegando) deixa o
      // foco num item e o estado em outro, e ai a tecla escolheria o corpo
      // errado — em silencio, que e o pior jeito.
      const alvo = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-chave]');
      const chave = (alvo?.dataset['chave'] as IdCorpo | undefined) ?? ativo;
      if (!chave) return;
      ev.preventDefault();
      // Enter escolhe como A; Shift+Enter escolhe como B.
      //
      // Sem o ramo sem Shift, o corpo em foco era o unico que NAO dava para
      // escolher: as setas escolhem ao mover, mas quem chega na lista pelo Tab
      // cai sobre um item ja em foco e nao tem como confirma-lo. Era preciso
      // sair dele e voltar. O teclado precisa poder acionar o que esta em foco.
      despachar(ev.shiftKey ? { tipo: 'comparar-com', chave } : { tipo: 'selecionar', chave });
    }
  }

  function Linha({
    c,
    dentro,
    quantasLuas,
  }: {
    c: ItemDeCorpo;
    dentro: boolean;
    /** Só na linha de um planeta que tem luas: quantas, escrito ao lado do nome. */
    quantasLuas?: number;
  }): JSX.Element {
    const ehA = e.selecionado === c.chave;
    const ehB = e.comparando === c.chave;
    const acompanhado = e.acompanhado === c.chave;
    // Os distintivos vao ESCRITOS no rotulo acessivel, e nao so desenhados:
    // "Terra, selecionado como A" e o que o leitor de tela anuncia. A natureza
    // tambem entra, porque "Io" sozinho nao diz que e uma lua de Júpiter.
    const papeis = [
      c.tipo === 'lua' ? 'lua' : null,
      quantasLuas ? plural(quantasLuas) : null,
      c.criado ? 'criado por você' : null,
      ehA ? 'selecionado como A' : null,
      ehB ? 'escolhido como B' : null,
      acompanhado ? 'acompanhado' : null,
    ]
      .filter(Boolean)
      .join(', ');
    const classes = ['lista__item'];
    if (dentro) classes.push('lista__item--lua');
    if (ehA) classes.push('lista__item--a');
    if (ehB) classes.push('lista__item--b');
    if (acompanhado) classes.push('lista__item--acompanhado');
    return (
      <div
        role="option"
        data-chave={c.chave}
        aria-selected={ehA}
        aria-label={papeis ? `${c.nome}, ${papeis}` : c.nome}
        tabIndex={c.chave === ativo ? 0 : -1}
        class={classes.join(' ')}
        onClick={() => despachar({ tipo: 'selecionar', chave: c.chave })}
        // O duplo clique aqui significa o MESMO que o duplo clique na cena:
        // leve-me ate ali. Antes um acompanhava a orbita e o outro enquadrava o
        // corpo, e o mesmo gesto fazia duas coisas conforme onde caisse.
        onDblClick={() => despachar({ tipo: 'trocar-modo', modo: 'perto' })}
      >
        <Ponto cor={corDoCorpo(c.chave)} />
        <span class="lista__nome">{c.nome}</span>
        {/* A contagem vai NA linha do planeta, e não numa linha própria abaixo.
            Cinco parágrafos dizendo "escolha Júpiter para ver" ocupavam um terço
            da lista para repetir uma instrução que a própria lista ensina na
            primeira vez que alguém escolhe um planeta. Aqui ela cabe onde já se
            está olhando, e o rótulo acessível a repete por extenso. */}
        {quantasLuas ? (
          <span class="lista__contagem" aria-hidden="true">
            {quantasLuas} {quantasLuas === 1 ? 'lua' : 'luas'}
          </span>
        ) : null}
        {/* Marcas desenhadas, nunca só cor: "A", "B" e o anel do acompanhado
            são glifos, e o rótulo acima repete os três por escrito. */}
        {acompanhado ? (
          <span class="lista__marca lista__marca--anel" aria-hidden="true">
            ◎
          </span>
        ) : null}
        {ehA ? (
          <span class="lista__marca" aria-hidden="true">
            A
          </span>
        ) : null}
        {ehB ? (
          <span class="lista__marca" aria-hidden="true">
            B
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={ref} class="lista" role="listbox" aria-label="Corpos do Sistema Solar" onKeyDown={aoTeclar}>
      {grupos.map((g) => (
        <div key={g.pai.chave} class="lista__ramo">
          <Linha c={g.pai} dentro={false} quantasLuas={g.luas.length} />
          {g.aberto ? (
            <div class="lista__grupo" role="group" aria-label={`${plural(g.luas.length)} de ${g.pai.nome}`}>
              {g.luas.map((l) => (
                <Linha key={l.chave} c={l} dentro />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
