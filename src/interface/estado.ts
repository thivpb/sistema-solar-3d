/**
 * A ponte entre o reducer e a tela.
 *
 * Signals, e nao um framework de estado: `aplicar.ts` ja e o reducer, e tudo
 * que falta e um lugar para guardar o resultado e avisar quem desenha. Redux
 * ou Zustand acrescentariam vocabulario sem acrescentar garantia.
 *
 * **Tres frequencias**, e a separacao importa para o quadro nao engasgar:
 *
 *   60 Hz    a cena; no DOM, o `style.transform` das placas de rotulo
 *            (`rotulos/ancoragem.ts`) e o `textContent` das duas reguas
 *            embaixo dela (`escreverAsLeituras`, em `principal.ts`). As duas
 *            escritas sao diretas, por fora do Preact, e comparam com o valor
 *            anterior antes de tocar o DOM.
 *   ~8 Hz    tudo que passa por este arquivo: a arvore inteira, republicada.
 *   evento   o que a pessoa acabou de acionar, na hora.
 *
 * **Este bloco ja descreveu um programa que nao existia.** Ele dizia que os
 * numeros do HUD iam por `textContent` a 8 Hz, e nao havia NENHUM
 * `textContent` em `src/`: eles iam na arvore Preact como todo o resto. A
 * frase era antiga e a implementacao nunca chegou. O caminho existe agora, e
 * esta nomeado acima para que a proxima leitura possa conferi-lo.
 *
 * A excecao da regra dos 8 Hz: o que a pessoa acabou de acionar atualiza na
 * hora. Esperar 125 ms depois de clicar parece travamento.
 */
import { signal, type Signal } from '@preact/signals';
import type { Acao } from '../app/acoes.ts';
import { aplicar, type Contexto, type Efeito } from '../app/aplicar.ts';
import { ESTADO_INICIAL, paraPreferencias, type EstadoUi } from '../app/estadoUi.ts';
import { gravarPreferencias } from '../app/preferencias.ts';

export const ui: Signal<EstadoUi> = signal(ESTADO_INICIAL);

/** Uma frase confirmando o que acabou de acontecer. Vai para a regiao `status`. */
export const confirmacao = signal('');

export interface Aviso {
  id: number;
  texto: string;
}
export const avisos: Signal<Aviso[]> = signal([]);

const DURACAO_DO_AVISO_MS = 2600;
let proximoId = 1;

export type Ouvinte = (efeito: Efeito) => void;
const ouvintes: Ouvinte[] = [];

/** A cena e o laco se inscrevem aqui para receber os efeitos que lhes cabem. */
export function aoEfeito(ouvinte: Ouvinte): () => void {
  ouvintes.push(ouvinte);
  return () => {
    const i = ouvintes.indexOf(ouvinte);
    if (i >= 0) ouvintes.splice(i, 1);
  };
}

let contexto: Contexto = {
  chaves: [],
  tetoDiasPorSegundo: 7300,
  nomeDe: (c) => c,
};

export function definirContexto(c: Contexto): void {
  contexto = c;
}

export function despachar(acao: Acao): void {
  const { ui: novo, efeitos } = aplicar(ui.value, acao, contexto);
  ui.value = novo;

  for (const efeito of efeitos) {
    switch (efeito.tipo) {
      case 'confirmar':
        confirmacao.value = efeito.texto;
        break;
      case 'avisar':
        mostrarAviso(efeito.texto);
        break;
      case 'salvar-preferencias':
        gravarPreferencias(paraPreferencias(novo));
        break;
      default:
        break;
    }
    for (const ouvinte of ouvintes) ouvinte(efeito);
  }
}

function mostrarAviso(texto: string): void {
  const id = proximoId++;
  avisos.value = [...avisos.value, { id, texto }];
  setTimeout(() => {
    avisos.value = avisos.value.filter((a) => a.id !== id);
  }, DURACAO_DO_AVISO_MS);
}

export function definirUi(novo: EstadoUi): void {
  ui.value = novo;
}
