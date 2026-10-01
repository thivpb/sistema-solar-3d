/**
 * O laco do quadro. A ordem importa, e e a mesma da versao em pygame:
 *
 *   1. ler o tempo real decorrido
 *   2. avancar a fisica por esse tempo
 *   3. publicar o Instantaneo
 *   4. desenhar
 *
 * As acoes ja foram aplicadas quando aconteceram — no DOM os eventos chegam
 * fora do laco, e o reducer e sincrono, entao nao ha etapa "processar
 * eventos": quando o quadro comeca, o estado ja esta atualizado.
 *
 * **REGRA DURA: nada no caminho por quadro le layout.** Nem
 * `getBoundingClientRect`, nem `offsetWidth`, nem `getComputedStyle`. Uma
 * leitura dessas dentro do rAF forca layout sincrono, e e o equivalente exato,
 * no DOM, do `font.render()` por quadro que o projeto anterior ja mediu
 * (4,4 us -> 0,17 us com cache) e resolveu. O tamanho do canvas chega por
 * `ResizeObserver`. Ha uma regra de lint que proibe os quatro nomes aqui.
 */
import { Simulador } from '../nucleo/simulador.ts';
import { copiarEstado, restaurarEstado } from '../nucleo/estado.ts';
import { medirPassosPorSegundo, passosMaxPorQuadro, tetoDiasPorSegundo } from '../nucleo/calibragem.ts';
import { PADRAO } from '../nucleo/integrador.ts';
import type { Catalogo } from '../dados/carregar.ts';
import type { Instantaneo } from '../contratos/instantaneo.ts';
import type { EstadoUi } from './estadoUi.ts';
import type { Efeito } from './aplicar.ts';

export interface Laco {
  iniciar(): void;
  parar(): void;
  aplicarEfeito(efeito: Efeito): void;
  readonly simulador: Simulador;
  readonly tetoDiasPorSegundo: number;
  /** Taxa de atualizacao MEDIDA, nao presumida. */
  readonly quadrosPorSegundo: number;
}

export interface OpcoesLaco {
  catalogo: Catalogo;
  lerUi: () => EstadoUi;
  aoQuadro: (instantaneo: Instantaneo, dtRealS: number) => void;
}

const MAX_DT_REAL_S = 0.1;

export function criarLaco({ catalogo, lerUi, aoQuadro }: OpcoesLaco): Laco {
  const inicial = copiarEstado(catalogo.estado);
  const simulador = new Simulador(catalogo.estado, {
    integrador: PADRAO,
    cronometro: () => performance.now(),
  });

  // Calibragem: mede a maquina em vez de chutar um numero. O aquecimento fica
  // dentro de `medirPassosPorSegundo`; sem ele, um computador rapido se
  // declara lento e corta a escada de velocidade em silencio.
  const medicao = medirPassosPorSegundo(catalogo.estado, PADRAO, () => performance.now());
  let quadrosPorSegundo = 60;
  simulador.passosMaxPorQuadro = passosMaxPorQuadro(medicao.passosPorSegundo, quadrosPorSegundo);
  simulador.quadrosPorSegundo = quadrosPorSegundo;
  /**
   * O teto e recalculado, e nao congelado na abertura.
   *
   * Ele era `const teto = ...` medido uma vez. Ligar o passo curto divide o
   * passo por quatro, e com o mesmo teto a escada continuaria oferecendo uma
   * velocidade que exige quatro vezes mais passos por segundo do que a maquina
   * entrega — a simulacao ficaria permanentemente atrasada, e o unico sinal
   * seria o aviso de atraso, que parece defeito da maquina e nao consequencia
   * de uma escolha. Como getter, ele acompanha `dtDias`.
   */
  const teto = (): number =>
    tetoDiasPorSegundo(medicao.passosPorSegundo, simulador.dtDias, quadrosPorSegundo);

  const instantaneo: Instantaneo = {
    tDias: 0,
    jd: catalogo.jdEpoca,
    pos: new Float64Array(3 * catalogo.estado.capacidade),
    vel: new Float64Array(3 * catalogo.estado.capacidade),
    n: catalogo.estado.n,
    atrasado: false,
    pausado: false,
  };

  let rodando = false;
  let pedido = 0;
  let ultimo = 0;
  let quadrosMedidos = 0;
  let inicioDaMedicao = 0;

  function quadro(agora: number): void {
    if (!rodando) return;
    pedido = requestAnimationFrame(quadro);

    // dt real limitado: voltar de uma aba escondida nao pode pedir milhoes de
    // dias de uma vez.
    const dtRealS = ultimo === 0 ? 0 : Math.min(MAX_DT_REAL_S, (agora - ultimo) / 1000);
    ultimo = agora;

    // Taxa de atualizacao MEDIDA. Uma tela de 120 Hz tem metade do tempo por
    // quadro, e presumir 60 faria a fisica estourar o orcamento sem avisar.
    if (inicioDaMedicao === 0) inicioDaMedicao = agora;
    quadrosMedidos++;
    if (agora - inicioDaMedicao > 1000 && quadrosMedidos > 30) {
      const medido = (quadrosMedidos * 1000) / (agora - inicioDaMedicao);
      quadrosPorSegundo = medido > 90 ? 120 : 60;
      simulador.quadrosPorSegundo = quadrosPorSegundo;
      simulador.passosMaxPorQuadro = passosMaxPorQuadro(medicao.passosPorSegundo, quadrosPorSegundo);
      inicioDaMedicao = agora;
      quadrosMedidos = 0;
    }

    const ui = lerUi();
    const relatorio = ui.pausado
      ? { passos: 0, atrasado: false }
      : simulador.avancar(dtRealS, ui.diasPorSegundo);

    const e = simulador.estado;
    instantaneo.pos.set(e.pos.subarray(0, 3 * e.n));
    instantaneo.vel.set(e.vel.subarray(0, 3 * e.n));
    instantaneo.n = e.n;
    instantaneo.tDias = e.tDias;
    instantaneo.jd = catalogo.jdEpoca + e.tDias;
    instantaneo.atrasado = relatorio.atrasado;
    instantaneo.pausado = ui.pausado;

    aoQuadro(instantaneo, dtRealS);
  }

  function aoMudarVisibilidade(): void {
    // Sem isto, o primeiro quadro depois de voltar pediria todo o tempo em que
    // a aba ficou escondida.
    if (!document.hidden) ultimo = 0;
  }

  return {
    simulador,
    get tetoDiasPorSegundo() {
      return teto();
    },
    get quadrosPorSegundo() {
      return quadrosPorSegundo;
    },
    iniciar() {
      if (rodando) return;
      rodando = true;
      ultimo = 0;
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
      pedido = requestAnimationFrame(quadro);
    },
    parar() {
      rodando = false;
      cancelAnimationFrame(pedido);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    },
    aplicarEfeito(efeito) {
      switch (efeito.tipo) {
        case 'reiniciar-fisica':
          restaurarEstado(simulador.estado, inicial);
          simulador.reiniciar(simulador.estado);
          break;
        case 'passo-unico':
          simulador.passoUnico(efeito.sentido);
          break;
        default:
          break;
      }
    },
  };
}
