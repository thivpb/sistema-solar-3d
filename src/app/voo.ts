/**
 * As teclas do voo, lidas por QUADRO e nao por evento.
 *
 * Todo o resto do programa e dirigido a evento: uma tecla, uma acao, um
 * reducer. Voo nao cabe nesse molde. `keydown` repete a uma taxa que o sistema
 * operacional escolhe — tipicamente uns 30 Hz depois de um atraso de 500 ms —,
 * e uma camera movida por evento de repeticao anda aos trancos, comeca meio
 * segundo depois do dedo e nao combina duas direcoes ao mesmo tempo.
 *
 * Entao aqui o que se guarda e o conjunto de teclas APERTADAS, e o laco pergunta
 * a cada quadro para onde se esta indo. E a mesma razao pela qual o arrasto do
 * ponteiro nao vira uma acao por pixel.
 *
 * **Nao despacha acao nenhuma.** Se despachasse, cada quadro de voo passaria
 * pelo reducer, publicaria estado e redesenharia a interface inteira — sessenta
 * vezes por segundo, para mover tres numeros que a interface nem le.
 */

/** Para onde se esta indo, cada componente em [-1, 1]. */
export interface Rumo {
  /** +1 para frente, na direcao de vista. */
  frente: number;
  /** +1 para a direita da camera. */
  direita: number;
  /** +1 para cima da camera. */
  cima: number;
  turbo: boolean;
}

export const PARADO: Rumo = { frente: 0, direita: 0, cima: 0, turbo: false };

/**
 * As teclas, minusculas. `W` e `w` sao a mesma, e `Shift+W` chega como `W`.
 *
 * Q e E sobem e descem, e nao R e F: `R` volta ao inicio e `F` abre a ficha.
 * Duas letras que fazem coisas diferentes em modos diferentes sao duas letras
 * que ninguem ensina — a regra que tirou o `D` da ficha completa.
 */
export const TECLAS_DE_VOO: Record<string, keyof Omit<Rumo, 'turbo'> | null> = {
  w: 'frente',
  s: 'frente',
  a: 'direita',
  d: 'direita',
  q: 'cima',
  e: 'cima',
};

const SINAIS: Record<string, number> = { w: 1, s: -1, a: -1, d: 1, q: -1, e: 1 };

export interface OpcoesDeVoo {
  /** Verdadeiro so enquanto o modo imersivo estiver valendo. */
  ativo: () => boolean;
}

export interface Voo {
  /** O rumo agora. Chamado uma vez por quadro. */
  rumo: () => Rumo;
  /** Verdadeiro quando esta tecla foi consumida pelo voo e nao deve virar atalho. */
  consome: (tecla: string) => boolean;
  soltar: () => void;
  desligar: () => void;
}

export function ligarVoo(alvo: EventTarget, opcoes: OpcoesDeVoo): Voo {
  const apertadas = new Set<string>();
  let turbo = false;

  const consome = (tecla: string): boolean =>
    opcoes.ativo() && tecla.toLowerCase() in TECLAS_DE_VOO;

  function aoDescer(ev: Event): void {
    const e = ev as KeyboardEvent;
    // Um campo de texto em foco fica com a tecla, sempre. O modo imersivo nao
    // tem campos, mas a caixa de ajuda abre dentro dele e a busca do navegador
    // tambem — e uma pessoa digitando "wasd" nao quer decolar.
    const foco = e.target as HTMLElement | null;
    if (foco && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' || foco.isContentEditable)) {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!consome(k)) return;
    ev.preventDefault();
    apertadas.add(k);
    turbo = e.shiftKey;
  }

  function aoSubir(ev: Event): void {
    const e = ev as KeyboardEvent;
    apertadas.delete(e.key.toLowerCase());
    turbo = e.shiftKey;
  }

  // Perder o foco da janela solta tudo. Sem isto, trocar de aplicativo com o
  // dedo no W deixa a camera voando sozinha para sempre: o `keyup` acontece na
  // outra janela e nunca chega aqui. E o mesmo defeito que `ev.rel` do pygame
  // tinha depois de perder o foco, resolvido do mesmo jeito.
  function soltar(): void {
    apertadas.clear();
    turbo = false;
  }

  alvo.addEventListener('keydown', aoDescer);
  alvo.addEventListener('keyup', aoSubir);
  globalThis.addEventListener?.('blur', soltar);

  return {
    rumo: (): Rumo => {
      if (!opcoes.ativo() || apertadas.size === 0) return PARADO;
      const r = { frente: 0, direita: 0, cima: 0, turbo };
      for (const k of apertadas) {
        const eixo = TECLAS_DE_VOO[k];
        if (eixo) r[eixo] += SINAIS[k] ?? 0;
      }
      // Apertar W e S junto da zero, e nao um empate que anda: os sinais se
      // cancelam na soma.
      //
      // Depois vem a NORMALIZACAO, e ela nao e enfeite. Sem ela, W+A anda
      // `raiz de 2` vezes mais rapido que W sozinho, e W+A+E anda `raiz de 3` —
      // e o jeito mais rapido de atravessar a cena passa a ser apertar tres
      // teclas na diagonal. E o velho defeito de deslocamento diagonal dos
      // jogos, e a correcao e a mesma: o rumo e uma DIRECAO, de modulo um, e
      // quem carrega a velocidade e o passo.
      const m = Math.hypot(r.frente, r.direita, r.cima);
      if (m > 1) {
        r.frente /= m;
        r.direita /= m;
        r.cima /= m;
      }
      return r;
    },
    consome,
    soltar,
    desligar: () => {
      alvo.removeEventListener('keydown', aoDescer);
      alvo.removeEventListener('keyup', aoSubir);
      globalThis.removeEventListener?.('blur', soltar);
    },
  };
}
