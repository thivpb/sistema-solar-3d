/**
 * Os rotulos acompanham a camera POR QUADRO, e o desvio deles e suavizado.
 *
 * **O defeito que isto corrige.** `camada.tsx` abria dizendo que "so
 * `transform` muda por quadro", e `principal.ts` dizia que "a ancoragem
 * acompanha o quadro". Nenhum dos dois era verdade: o unico caminho dos rotulos
 * ate o DOM era a publicacao do estado, que acontece a 8 Hz. Os nomes andavam
 * aos saltos de 125 ms enquanto a cena corria a 60, e era isso que se via ao
 * girar a camera — um tremor que parecia do posicionador e era do relogio.
 *
 * **O que se suaviza e o DESVIO, nunca a posicao.** A placa fica a um
 * deslocamento do corpo — "a direita e um pouco acima", por exemplo —, e o
 * corpo se move a cada quadro. Suavizar a posicao absoluta faria a placa
 * perseguir o corpo com atraso, que e exatamente a licao mais cara deste
 * projeto, em escala menor: amortecimento exponencial nunca alcanca um alvo em
 * movimento. Suavizando so o desvio, a placa e rigida em relacao ao corpo — o
 * erro de acompanhamento e ZERO — e o que desliza e apenas a escolha de lado,
 * que e a unica coisa que salta.
 *
 * **E ha prazo fixo.** Depois de `PRAZO_S` a placa e posta no lugar de uma vez.
 * Sem ele, uma transicao lenta o bastante nunca chega, e o nome fica para
 * sempre entre dois lugares — o mesmo remendo que a camera usa nas transicoes,
 * pelo mesmo motivo.
 */
import type { RotuloColocado } from './posicionador.ts';

/** Constante de tempo. Em 0,08 s a placa cobre 63% do caminho. */
export const TAU_S = 0.08;
/** Depois disto, vai de uma vez. */
export const PRAZO_S = 0.2;
/** Abaixo de meio pixel, considera-se que o alvo nao mudou. */
const FOLGA_PX = 0.5;

export interface Ancora {
  x: number;
  y: number;
}

interface Desvio {
  dx: number;
  dy: number;
  alvoX: number;
  alvoY: number;
  /** Quando este alvo passou a valer, em segundos. */
  desde: number;
}

export type MemoriaDoDesvio = Map<string, Desvio>;

export const criarMemoriaDoDesvio = (): MemoriaDoDesvio => new Map();

/**
 * Onde cada placa deve estar AGORA, em pixels CSS.
 *
 * Pura: recebe a colocacao do ultimo calculo, onde os corpos estao neste
 * quadro, e devolve a posicao suavizada. Quem escreve no DOM e quem chama.
 */
export function posicoesSuavizadas(
  rotulos: readonly RotuloColocado[],
  ancoras: ReadonlyMap<string, Ancora>,
  memoria: MemoriaDoDesvio,
  dtS: number,
  agoraS: number,
): Map<string, { x: number; y: number; centroX: number; centroY: number }> {
  const saida = new Map<string, { x: number; y: number; centroX: number; centroY: number }>();
  const vivos = new Set<string>();

  // `dt` preso a um teto: voltar de uma aba escondida traz um `dt` de minutos,
  // e `1 − exp(−dt/tau)` daria 1 — o que ate acerta, mas por acidente. Com
  // teto, o comportamento e o mesmo em qualquer quadro longo.
  const k = 1 - Math.exp(-Math.min(dtS, 0.25) / TAU_S);

  for (const r of rotulos) {
    vivos.add(r.chave);
    const ancora = ancoras.get(r.chave);
    // Sem ancora neste quadro, a placa fica onde a colocacao a pos. Acontece
    // no quadro em que um corpo sai de vista e a colocacao ainda nao soube.
    const centroX = ancora?.x ?? r.centroX;
    const centroY = ancora?.y ?? r.centroY;
    const alvoX = r.x - r.centroX;
    const alvoY = r.y - r.centroY;

    let d = memoria.get(r.chave);
    if (!d) {
      // Placa nova entra JA no lugar. Deslizar a partir do zero faria todo nome
      // que aparece voar do centro do corpo ate a posicao dele.
      d = { dx: alvoX, dy: alvoY, alvoX, alvoY, desde: agoraS };
      memoria.set(r.chave, d);
    } else {
      if (Math.abs(alvoX - d.alvoX) > FOLGA_PX || Math.abs(alvoY - d.alvoY) > FOLGA_PX) {
        d.alvoX = alvoX;
        d.alvoY = alvoY;
        d.desde = agoraS;
      }
      if (agoraS - d.desde >= PRAZO_S) {
        d.dx = d.alvoX;
        d.dy = d.alvoY;
      } else {
        d.dx += (d.alvoX - d.dx) * k;
        d.dy += (d.alvoY - d.dy) * k;
      }
    }

    saida.set(r.chave, { x: centroX + d.dx, y: centroY + d.dy, centroX, centroY });
  }

  // Esquecer quem saiu. Sem isto o mapa cresce com cada corpo criado e apagado
  // no sandbox, e um corpo que volta com a mesma chave reapareceria com o
  // desvio de quando sumiu.
  for (const chave of memoria.keys()) if (!vivos.has(chave)) memoria.delete(chave);
  return saida;
}

/**
 * Escreve as posicoes nos nos da camada. So `transform`, e nada mais.
 *
 * Uma escrita de `transform` toca so a camada de composicao do navegador.
 * Mexer em `left`/`top` forcaria layout — e ler qualquer coisa aqui (um
 * `getBoundingClientRect`, um `offsetWidth`) forcaria layout SINCRONO dentro do
 * laco de quadro, que e a regra que o lint do nucleo existe para impedir.
 */
/**
 * Os nos de uma camada, relidos SO quando a camada muda.
 *
 * `escrever` roda a cada quadro, e as duas consultas custavam duas varreduras
 * do DOM a 60 Hz para um conjunto que muda a 8 Hz — a taxa em que a arvore
 * Preact e republicada.
 *
 * **A invalidacao e um `MutationObserver`, e nao a contagem de filhos.** A
 * contagem parece bastar, porque as placas sao filhas diretas da camada, e ela
 * teria um buraco silencioso: um corpo que troca de `forma` — de placa para
 * ponto — faz o Preact substituir o elemento sem mudar o numero deles. O cache
 * ficaria com um no ja fora do documento, e a placa nova pararia de acompanhar
 * o quadro, voltando a saltar a 8 Hz. Seria exatamente o defeito que a
 * ancoragem por quadro existe para consertar, de volta em um corpo so e sem
 * nada acusando.
 *
 * O observador custa zero enquanto nada muda: ele so e chamado quando a
 * camada e reescrita, que e a hora certa de reler.
 */
interface NosDaCamada {
  sujo: boolean;
  rotulo: HTMLElement[];
  anel: HTMLElement[];
}

const CACHE = new WeakMap<HTMLElement, NosDaCamada>();

function nosDe(raiz: HTMLElement, qual: 'rotulo' | 'anel'): HTMLElement[] {
  let c = CACHE.get(raiz);
  if (!c) {
    c = { sujo: true, rotulo: [], anel: [] };
    const registro = c;
    new MutationObserver(() => {
      registro.sujo = true;
    }).observe(raiz, { childList: true });
    CACHE.set(raiz, c);
  }
  if (c.sujo) {
    c.sujo = false;
    c.rotulo = [...raiz.querySelectorAll<HTMLElement>('[data-rotulo]')];
    c.anel = [...raiz.querySelectorAll<HTMLElement>('[data-anel]')];
  }
  return c[qual];
}

export function escrever(
  raiz: HTMLElement,
  posicoes: ReadonlyMap<string, { x: number; y: number; centroX: number; centroY: number }>,
): void {
  for (const no of nosDe(raiz, 'rotulo')) {
    const p = posicoes.get(no.dataset['rotulo'] ?? '');
    if (p) no.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }
  for (const no of nosDe(raiz, 'anel')) {
    const p = posicoes.get(no.dataset['anel'] ?? '');
    if (!p) continue;
    // O anel e centrado no CORPO, e nao na placa: ele marca o corpo. E por isso
    // ele nao e suavizado — o corpo nao salta, e um anel que deslizasse
    // ficaria atras do proprio corpo enquanto a camera gira.
    const raio = Number(no.dataset['raio'] ?? '16');
    no.style.transform = `translate(${p.centroX - raio}px, ${p.centroY - raio}px)`;
  }
}
