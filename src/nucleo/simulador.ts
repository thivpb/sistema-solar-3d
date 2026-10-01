/**
 * Liga o relogio de parede ao relogio da simulacao, com honestidade.
 *
 * O problema: alguem pede "365 dias por segundo". A 60 quadros por segundo sao
 * 6 dias por quadro, ou 12 passos de meio dia. Tudo bem. Mas se pedir 100 mil
 * dias por segundo, nenhuma maquina da conta.
 *
 * Ha tres jeitos errados de lidar com isso, e nenhum e usado aqui:
 *
 *   1. Aumentar o passo de integracao para cobrir mais tempo. Degrada a fisica
 *      em silencio — a orbita continua bonita e fica errada.
 *   2. Acumular a divida e pagar depois. A simulacao trava tentando alcancar.
 *   3. Pular passos. A data na tela deixaria de corresponder ao estado fisico.
 *
 * O que este modulo faz: entrega quantos passos couberem no orcamento,
 * **DESCARTA o excedente** e avisa (`atrasado`). A data mostrada e sempre
 * `t0 + n*dt` exatos, e a interface diz que a velocidade real esta abaixo da
 * pedida. Nada de errado acontece calado.
 *
 * **O relogio e injetado.** O simulador nao chama `performance.now()`: ele
 * recebe uma funcao. Sem isso, um teste nao conseguiria simular um quadro
 * lento, e o lint que proibe `performance` dentro do nucleo nao teria como
 * valer.
 */
import { PADRAO, PASSO_PADRAO_DIAS, type Integrador } from './integrador.ts';
import { ajustarRascunho, criarRascunho, type EstadoSistema, type Rascunho } from './tipos.ts';

/** Devolve milissegundos monotonicos. Injetada; nunca lida daqui de dentro. */
export type Cronometro = () => number;

export interface RelatorioPasso {
  passos: number;
  diasPedidos: number;
  diasDados: number;
  /** Verdadeiro quando o orcamento nao coube e o excedente foi descartado. */
  atrasado: boolean;
  msGastos: number;
}

export function fracaoEntregue(r: RelatorioPasso): number {
  return r.diasPedidos <= 0 ? 1 : r.diasDados / r.diasPedidos;
}

const PARADO: RelatorioPasso = {
  passos: 0,
  diasPedidos: 0,
  diasDados: 0,
  atrasado: false,
  msGastos: 0,
};

export interface OpcoesSimulador {
  integrador?: Integrador;
  dtDias?: number;
  passosMaxPorQuadro?: number;
  cronometro?: Cronometro;
  quadrosPorSegundo?: number;
}

export class Simulador {
  estado: EstadoSistema;
  integrador: Integrador;
  dtDias: number;
  passosMaxPorQuadro: number;
  quadrosPorSegundo: number;

  private readonly cronometro: Cronometro;
  private rascunho: Rascunho;
  /** Fracao de passo que sobrou do quadro anterior. */
  private residuo = 0;

  constructor(estado: EstadoSistema, opcoes: OpcoesSimulador = {}) {
    this.estado = estado;
    this.integrador = opcoes.integrador ?? PADRAO;
    this.dtDias = opcoes.dtDias ?? PASSO_PADRAO_DIAS;
    this.passosMaxPorQuadro = opcoes.passosMaxPorQuadro ?? 140;
    this.quadrosPorSegundo = opcoes.quadrosPorSegundo ?? 60;
    this.cronometro = opcoes.cronometro ?? (() => 0);
    this.rascunho = criarRascunho(estado.capacidade);
  }

  /** Teto que este orcamento sustenta na taxa de atualizacao medida. */
  get diasPorSegundoMaximo(): number {
    return this.passosMaxPorQuadro * this.dtDias * this.quadrosPorSegundo;
  }

  reiniciar(estado: EstadoSistema): void {
    this.estado = estado;
    this.rascunho = ajustarRascunho(this.rascunho, estado.capacidade);
    this.residuo = 0;
  }

  /** Chamar apos inserir ou remover corpos, para o rascunho acompanhar. */
  revalidar(): void {
    this.rascunho = ajustarRascunho(this.rascunho, this.estado.capacidade);
  }

  /** Avanca o tempo simulado correspondente a `dtRealS` segundos reais. */
  avancar(dtRealS: number, diasPorSegundo: number): RelatorioPasso {
    const pedidos = Math.max(0, dtRealS) * diasPorSegundo;
    if (pedidos <= 0) return { ...PARADO };

    // O residuo guarda a fracao de passo nao usada, para que velocidades
    // baixas — menos de um passo por quadro — ainda avancem suavemente em vez
    // de ficarem congeladas ate juntar um passo inteiro.
    this.residuo += pedidos;
    const querido = Math.trunc(this.residuo / this.dtDias);
    const passos = Math.min(querido, this.passosMaxPorQuadro);
    const atrasado = passos < querido;

    const t0 = this.cronometro();
    for (let k = 0; k < passos; k++) {
      this.integrador.passo(this.estado, this.dtDias, this.rascunho);
    }
    this.estado.tDias += passos * this.dtDias;
    const msGastos = this.cronometro() - t0;

    if (atrasado) {
      this.residuo = 0; // descarta o excedente; nao acumula divida
    } else {
      this.residuo -= passos * this.dtDias;
    }

    return { passos, diasPedidos: pedidos, diasDados: passos * this.dtDias, atrasado, msGastos };
  }

  /** Pausa e avanca exatamente um passo. Aceita dt negativo. */
  passoUnico(sentido: 1 | -1 = 1): void {
    this.integrador.passo(this.estado, sentido * this.dtDias, this.rascunho);
    this.estado.tDias += sentido * this.dtDias;
    this.residuo = 0;
  }
}
