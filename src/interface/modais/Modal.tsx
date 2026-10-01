/**
 * O modal e um `<dialog>`, e isso substitui um modulo inteiro.
 *
 * A versao em pygame tinha um `GerenteFoco` com pilha, para prender o foco
 * dentro do modal, tornar o resto inerte, fechar no Esc e devolver o foco a
 * quem abriu. `dialog.showModal()` faz as quatro coisas, do jeito que o
 * sistema operacional e o leitor de tela esperam — e nao do jeito que um clone
 * escrito a mao consegue imitar.
 *
 * **`onClose` sozinho, e nunca `onClose` junto com `onCancel`.** O `<dialog>`
 * dispara os DOIS no Esc: `cancel` primeiro, `close` logo depois. Com os dois
 * ligados na mesma funcao, um toque no Esc despachava a acao `fechar` duas
 * vezes. Por muito tempo isso foi inofensivo — fechar uma caixa ja fechada nao
 * faz nada —, ate o Esc ganhar um segundo significado: sair do modo imersivo
 * quando nao ha caixa aberta. Ai o primeiro despacho fechava a ajuda e o
 * segundo, vendo que ja nao havia caixa, jogava a pessoa para fora do modo. Um
 * toque, duas coisas. `close` sozinho cobre todos os caminhos: ele dispara no
 * Esc, no botao de fechar e no clique fora.
 *
 * O que ainda precisa de codigo: fechar clicando fora. O `<dialog>` entrega o
 * clique no backdrop como um clique no proprio dialog, entao a comparacao e
 * pela geometria.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { BOTOES } from '../../dados/textos.ts';

interface ModalProps {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ComponentChildren;
  /** Botoes do rodape. O de fechar entra sempre, por ultimo. */
  acoes?: ComponentChildren;
}

export function Modal({ titulo, aberto, onFechar, children, acoes }: ModalProps): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      class="modal"
      aria-labelledby="modal-titulo"
      onClose={onFechar}
      onClick={(ev: MouseEvent) => {
        // Clique no backdrop chega como clique no proprio <dialog>; so a
        // geometria distingue um do outro.
        const d = ref.current;
        if (!d || ev.target !== d) return;
        const r = d.getBoundingClientRect();
        const fora =
          ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
        if (fora) onFechar();
      }}
    >
      <div class="modal__cartao">
        <h2 id="modal-titulo" class="modal__titulo">
          {titulo}
        </h2>
        {/* `tabindex=0` porque este bloco ROLA. Sem ele, quem usa so teclado
            nao consegue ler um modal mais alto que a tela: o Tab pula direto
            para o botao de fechar. O axe classifica isso como "serious", e com
            razao. */}
        <div class="modal__corpo" tabIndex={0}>
          {children}
        </div>
        <div class="modal__acoes">
          {acoes}
          <button type="button" class="botao" onClick={onFechar}>
            {BOTOES.fechar}
          </button>
        </div>
      </div>
    </dialog>
  );
}
