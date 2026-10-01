/**
 * Mouse e trackpad sobre a cena.
 *
 * Tres cuidados herdados da versao em pygame, onde cada um custou um bug:
 *
 * 1. **O arrasto so comeca se o botao desceu sobre o canvas.** Senao, soltar o
 *    botao em cima da cena depois de arrastar um controle da barra viraria um
 *    giro de camera.
 * 2. **Posicao absoluta, nao `movementX`.** O equivalente em pygame era
 *    `ev.rel`, que mente depois de a janela perder o foco.
 * 3. **`deltaY` fracionario.** O trackpad manda passos pequenos; arredondar
 *    para inteiro faz o zoom andar aos saltos.
 *
 * O botao DIREITO desloca, e Shift+esquerdo tambem — paridade com Shift+setas.
 */
import type { Acao } from './acoes.ts';

export interface OpcoesPonteiro {
  despachar: (acao: Acao) => void;
  /**
   * A altura do canvas em pixels CSS.
   *
   * Era `uaPorPixel`, e a conversao acontecia aqui. Ela voltou para
   * `principal.ts`: a acao de deslocar carrega FRACAO da altura visivel, e assim
   * o teclado e o ponteiro mandam a mesma grandeza. Enquanto cada um convertia
   * por conta propria, um dos dois estava errado por tres ordens de grandeza e
   * nada apontava para isso.
   */
  alturaPx: () => number;
  /**
   * Um clique SEM arrastar sobre a cena, em pixels CSS dentro do canvas.
   *
   * Existe para o modo Criar. E um clique, nao um arrasto: o criterio 2.5.7 da
   * WCAG 2.2 pede que toda funcionalidade que use arrasto tenha um caminho por
   * ponteiro unico. Aqui o caminho por ponteiro unico E o principal, e nao uma
   * alternativa escondida — colocar o corpo e apontar e clicar.
   */
  aoClicar?: (xCss: number, yCss: number, duplo: boolean) => void;
}

const RADIANOS_POR_PIXEL = 0.005;
/** Acima disto o gesto foi arrasto, e nao clique. Em pixels. */
const FOLGA_DO_CLIQUE = 4;
/** O padrao dos sistemas. Mais que isso vira dois cliques separados. */
const MS_DO_DUPLO_CLIQUE = 400;

export function ligarPonteiro(canvas: HTMLCanvasElement, opcoes: OpcoesPonteiro): () => void {
  let arrastando: 'orbitar' | 'deslocar' | null = null;
  let ultimoX = 0;
  let ultimoY = 0;
  let desceuEm: { x: number; y: number } | null = null;
  // Um duplo clique e dois cliques perto no tempo E no espaco. O navegador tem
  // um evento proprio, mas ele chega DEPOIS do segundo `pointerup`, e ai a
  // primeira escolha ja aconteceu — o corpo piscaria de selecionado para
  // acompanhado. Contar aqui deixa os dois no mesmo gesto.
  //
  // **A comparacao e em coordenadas de TELA, e nao do canvas.** O primeiro
  // clique escolhe um corpo, e escolher um corpo muda a barra de cima — o
  // botao passa a dizer "Focar Jupiter" em vez de "Focar". Quando a barra
  // ganha uma linha, o canvas desce com ela, e o segundo clique do mesmo
  // gesto chegava com `y` quinze pixels maior sem que o mouse tivesse saido
  // do lugar: 15,5 contra os 4 de folga, e nenhum duplo clique era detectado.
  // O mouse nao se moveu, e e isso que a comparacao precisa perguntar.
  let ultimoClique = { x: 0, y: 0, quando: -Infinity };

  function aoDescer(ev: PointerEvent): void {
    if (ev.button !== 0 && ev.button !== 2) return;
    arrastando = ev.button === 2 || ev.shiftKey ? 'deslocar' : 'orbitar';
    ultimoX = ev.clientX;
    ultimoY = ev.clientY;
    desceuEm = ev.button === 0 && !ev.shiftKey ? { x: ev.clientX, y: ev.clientY } : null;
    canvas.setPointerCapture(ev.pointerId);
  }

  function aoMover(ev: PointerEvent): void {
    if (!arrastando) return;
    const dx = ev.clientX - ultimoX;
    const dy = ev.clientY - ultimoY;
    ultimoX = ev.clientX;
    ultimoY = ev.clientY;
    if (arrastando === 'orbitar') {
      opcoes.despachar({
        tipo: 'orbitar-camera',
        azimute: -dx * RADIANOS_POR_PIXEL,
        elevacao: dy * RADIANOS_POR_PIXEL,
      });
    } else {
      // Os dois eixos dividem pela ALTURA, e nao cada um pela sua dimensao:
      // dividir dx pela largura faria o mesmo gesto diagonal virar uma diagonal
      // torta em janela que nao fosse quadrada.
      const h = Math.max(1, opcoes.alturaPx());
      opcoes.despachar({ tipo: 'deslocar-camera', fracaoX: -dx / h, fracaoY: dy / h });
    }
  }

  function aoSubir(ev: PointerEvent): void {
    arrastando = null;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    // Um clique e um `pointerdown` seguido de `pointerup` quase no mesmo
    // lugar. Sem a folga, tremer quatro pixels enquanto se clica viraria um
    // giro de camera de dois graus e nenhum clique.
    if (desceuEm && opcoes.aoClicar) {
      const andou = Math.hypot(ev.clientX - desceuEm.x, ev.clientY - desceuEm.y);
      if (andou <= FOLGA_DO_CLIQUE) {
        const r = canvas.getBoundingClientRect();
        const x = ev.clientX - r.left;
        const y = ev.clientY - r.top;
        const agora = ev.timeStamp;
        const duplo =
          agora - ultimoClique.quando < MS_DO_DUPLO_CLIQUE &&
          Math.hypot(ev.clientX - ultimoClique.x, ev.clientY - ultimoClique.y) <=
            FOLGA_DO_CLIQUE;
        ultimoClique = {
          x: ev.clientX,
          y: ev.clientY,
          quando: duplo ? -Infinity : agora,
        };
        opcoes.aoClicar(x, y, duplo);
      }
    }
    desceuEm = null;
  }

  function aoRolar(ev: WheelEvent): void {
    ev.preventDefault();
    // A ancora vai junto, em pixels CSS dentro do canvas. Quem sabe converter
    // pixel em ponto do mundo e a cena, e este modulo nao pode ve-la: `app/`
    // nao importa `cena/`. Entao ele manda o pixel, e quem tem a matriz
    // resolve — o mesmo caminho que o clique de escolha percorre.
    const r = canvas.getBoundingClientRect();
    opcoes.despachar({
      tipo: 'ajustar-zoom',
      fator: Math.pow(1.0015, -ev.deltaY),
      ancora: [ev.clientX - r.left, ev.clientY - r.top],
    });
  }

  function aoMenu(ev: Event): void {
    // O botao direito desloca a camera; o menu do navegador atrapalharia.
    ev.preventDefault();
  }

  canvas.addEventListener('pointerdown', aoDescer);
  canvas.addEventListener('pointermove', aoMover);
  canvas.addEventListener('pointerup', aoSubir);
  canvas.addEventListener('pointercancel', aoSubir);
  canvas.addEventListener('wheel', aoRolar, { passive: false });
  canvas.addEventListener('contextmenu', aoMenu);

  return () => {
    canvas.removeEventListener('pointerdown', aoDescer);
    canvas.removeEventListener('pointermove', aoMover);
    canvas.removeEventListener('pointerup', aoSubir);
    canvas.removeEventListener('pointercancel', aoSubir);
    canvas.removeEventListener('wheel', aoRolar);
    canvas.removeEventListener('contextmenu', aoMenu);
  };
}
