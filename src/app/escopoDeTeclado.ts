/**
 * Quem tem direito a uma tecla.
 *
 * Esta questao nao existia na versao em pygame: la havia uma janela so, e o
 * roteador de eventos decidia tudo. No DOM ha foco, e um atalho global que
 * dispara enquanto alguem digita num campo e um bug classico.
 *
 * Tres regras, e as tres valem por um motivo concreto:
 *
 * 1. **Campo editavel consome tudo.** Digitar "s" num campo nao pode tirar uma
 *    captura de tela.
 * 2. **Espaco e Enter nunca sao globais sobre um `<button>`.** O navegador ja
 *    aciona o botao com essas teclas; se o atalho global tambem disparasse, um
 *    Espaco no botao "Pausar" pausaria DUAS vezes — ou seja, nao pausaria.
 * 3. **PageUp/PageDown e Home/End ficam com o componente em foco.** A lista de
 *    corpos e um `listbox`, e o padrao ARIA usa essas teclas para saltar
 *    dentro dela. O zoom usa `+` e `-`, que nao tem esse conflito.
 */
const EDITAVEIS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const TECLAS_DO_BOTAO = new Set([' ', 'Spacebar', 'Enter']);
const TECLAS_DO_COMPONENTE = new Set(['PageUp', 'PageDown', 'Home', 'End']);

export interface AlvoDaTecla {
  tagName: string;
  isContentEditable?: boolean;
  role?: string | null;
}

export function alvoEhEditavel(alvo: AlvoDaTecla | null): boolean {
  if (!alvo) return false;
  return EDITAVEIS.has(alvo.tagName) || alvo.isContentEditable === true;
}

/** Diz se o atalho global pode agir, dado onde o foco esta. */
export function atalhoGlobalPodeAgir(tecla: string, alvo: AlvoDaTecla | null): boolean {
  if (alvoEhEditavel(alvo)) return false;
  if (TECLAS_DO_COMPONENTE.has(tecla)) return false;
  if (alvo && TECLAS_DO_BOTAO.has(tecla)) {
    const ehBotao = alvo.tagName === 'BUTTON' || alvo.role === 'button';
    const ehOpcao = alvo.role === 'option' || alvo.role === 'listbox';
    if (ehBotao || ehOpcao) return false;
  }
  return true;
}
