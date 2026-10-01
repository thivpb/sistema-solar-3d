/**
 * Integradores numericos: como o estado avanca no tempo.
 *
 * Os dois aqui sao *simpleticos*. A propriedade que importa e que o erro de
 * energia oscila em torno de zero em vez de crescer sem parar. Runge-Kutta 4 e
 * mais preciso num passo isolado, mas a orbita encolhe de pouquinho em
 * pouquinho ate virar outra coisa. Para uma simulacao que alguem pode deixar
 * correndo por seculos simulados, isso nao serve.
 *
 * Escolha do projeto: Yoshida de 4a ordem com passo fixo de 0,5 dia. Medido na
 * versao anterior, erro de posicao de Mercurio contra o JPL Horizons em 10 anos:
 *
 *     leapfrog dt=0,25 d      14 610 avaliacoes de forca    erro 1,0e6 km
 *     leapfrog dt=0,021 d    175 320 avaliacoes de forca    erro 5,4e3 km
 *     Yoshida4 dt=0,5 d       21 915 avaliacoes de forca    erro 1,4e4 km
 *
 * Ou seja: precisao equivalente por cerca de 1/8 do custo.
 *
 * Passo FIXO, e nao adaptativo, por duas razoes independentes: passo variavel
 * quebra a propriedade simpletica, e passo fixo faz a data exibida ser sempre
 * exatamente `t0 + n * 0,5 dia` — sem "quase".
 */
import { aceleracao } from './forcas.ts';
import type { EstadoSistema, Rascunho } from './tipos.ts';

export const PASSO_PADRAO_DIAS = 0.5;

/**
 * Passo curto, oferecido quando o sandbox cria um corpo de orbita rapida.
 * 0,125 e divisor binario exato de 0,5, entao `tDias` continua exato.
 */
export const PASSO_CURTO_DIAS = 0.125;

export interface Integrador {
  readonly nome: string;
  readonly avaliacoesPorPasso: number;
  /** Avanca (pos, vel) por um passo dt, no lugar. Nao guarda estado entre chamadas. */
  passo(estado: EstadoSistema, dt: number, rascunho: Rascunho): void;
}

function somarEscalado(alvo: Float64Array, fonte: Float64Array, k: number, ate: number): void {
  for (let i = 0; i < ate; i++) alvo[i]! += k * fonte[i]!;
}

/**
 * Velocity Verlet: 2a ordem, uma avaliacao de forca por passo.
 *
 * Fica como conferencia independente do Yoshida nos testes. E simples o
 * bastante para que um erro nele seja visivel a olho, o que e exatamente o que
 * se quer de uma referencia.
 */
export const leapfrog: Integrador = {
  nome: 'leapfrog',
  avaliacoesPorPasso: 1,
  passo(estado, dt, rascunho) {
    const m = 3 * estado.n;
    aceleracao(estado, rascunho);
    somarEscalado(estado.vel, rascunho.acel, 0.5 * dt, m);
    somarEscalado(estado.pos, estado.vel, dt, m);
    aceleracao(estado, rascunho);
    somarEscalado(estado.vel, rascunho.acel, 0.5 * dt, m);
  },
};

/**
 * Coeficientes de Yoshida (1990): tres passos de leapfrog encadeados, o do
 * meio com sinal negativo. Os termos de erro de 2a ordem se cancelam e sobra
 * erro de 4a ordem.
 *
 * Escritos como literais de 17 digitos, e nao calculados, para que o valor nao
 * dependa de `Math.cbrt` concordar com `2 ** (1/3)` no ultimo bit em todo
 * motor de JavaScript. `pesosYoshida.test.ts` confere os literais contra a
 * formula dentro de 1 ulp.
 */
const W1 = 1.3512071919596578; // 1 / (2 - 2^(1/3))
const W0 = -1.7024143839193155; // 1 - 2*W1
const PESOS = [W1, W0, W1] as const;

export const yoshida4: Integrador = {
  nome: 'yoshida4',
  avaliacoesPorPasso: 3,
  passo(estado, dt, rascunho) {
    const m = 3 * estado.n;
    for (const w of PESOS) {
      somarEscalado(estado.pos, estado.vel, 0.5 * w * dt, m);
      aceleracao(estado, rascunho);
      somarEscalado(estado.vel, rascunho.acel, w * dt, m);
      somarEscalado(estado.pos, estado.vel, 0.5 * w * dt, m);
    }
  },
};

export const INTEGRADORES: Record<string, Integrador> = { yoshida4, leapfrog };
export const PADRAO = yoshida4;

/** Os pesos, expostos so para o teste que os confere contra a formula. */
export const PESOS_YOSHIDA = PESOS;

/**
 * Aplica `passos` passos de tamanho `dtDias` no estado, no lugar.
 *
 * Aceita dt negativo para rodar o tempo para tras. A integracao e reversivel —
 * 20 anos de ida e volta devolvem o estado inicial com erro abaixo de 1 km — e
 * `reversibilidade.test.ts` depende disso.
 */
export function avancar(
  estado: EstadoSistema,
  integrador: Integrador,
  dtDias: number,
  passos: number,
  rascunho: Rascunho,
): EstadoSistema {
  for (let k = 0; k < passos; k++) integrador.passo(estado, dtDias, rascunho);
  estado.tDias += passos * dtDias;
  return estado;
}
