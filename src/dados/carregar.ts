/**
 * Carrega a efemeride congelada e monta o estado inicial.
 *
 * **Convencao de centros**, que precisa ficar clara antes de qualquer conta:
 *
 *   - O Sol e o corpo 10 do Horizons, com GMS do cabecalho do DE440.
 *   - Os oito planetas sao os BARICENTROS dos sistemas planetarios (ids 1 a 8),
 *     com as GM de sistema (GM1, GM2, GMB, GM4..GM8). Um sistema planetario com
 *     luas se desloca, como um todo, praticamente como um ponto de massa igual
 *     a soma das massas — e e assim que o proprio JPL integra.
 *   - Para a Terra isso significa que o ponto simulado e o baricentro
 *     Terra-Lua. O centro da Terra gira em torno dele a cerca de 4.671 km.
 *
 * Origem: baricentro do Sistema Solar. Plano e equinocio da ecliptica de
 * J2000, sistema ICRF. Escala de tempo TDB.
 *
 * **Por que validar em vez de confiar.** Um arquivo truncado ou editado a mao
 * tem de falhar aqui, com mensagem clara, e nao virar uma simulacao
 * silenciosamente errada. O tipo do TypeScript nao ajuda nisso: ele descreve o
 * que o arquivo deveria ser, nao o que ele e.
 */
import { criarEstado } from '../nucleo/estado.ts';
import type { EstadoSistema } from '../nucleo/tipos.ts';
import { MAXIMO_DE_CORPOS_CRIADOS } from '../nucleo/guardas.ts';
import type { Corpo } from '../contratos/ids.ts';
import bruto from './efemeride_2026-01-01.json';
import type { ArquivoEfemeride, PontoDeValidacao, Procedencia } from './esquema.ts';

export class EfemerideInvalida extends Error {
  override name = 'EfemerideInvalida';
}

function exigir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new EfemerideInvalida(mensagem);
}

function eVetor3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}

export interface Catalogo {
  corpos: Corpo[];
  estado: EstadoSistema;
  procedencia: Procedencia;
  validacao: Record<string, PontoDeValidacao>;
  /** Dia juliano TDB da epoca. Tudo que vira data na tela passa por aqui. */
  jdEpoca: number;
  emrat: number;
}

/**
 * Valida e monta. `folga` reserva espaco para corpos do sandbox.
 *
 * O padrao e o TETO de corpos criados, e nao um numero redondo qualquer. Com
 * folga menor, `crescer` realocaria os buffers da fisica durante o uso — e os
 * buffers do INSTANTANEO, que `laco.ts` aloca uma vez pelo mesmo tamanho, NAO
 * cresceriam junto. O resultado seria um `RangeError` no corpo que passasse do
 * limite, no meio de um quadro. Dimensionar tudo pelo teto custa 40 × 8 bytes
 * por array e faz o problema deixar de existir.
 */
export function carregarDe(dados: unknown, folga = MAXIMO_DE_CORPOS_CRIADOS): Catalogo {
  exigir(typeof dados === 'object' && dados !== null, 'efemeride nao e um objeto');
  const arq = dados as Partial<ArquivoEfemeride>;

  for (const campo of ['ordem', 'corpos', 'procedencia', 'constantes_de440'] as const) {
    exigir(campo in arq, `efemeride sem o campo '${campo}'`);
  }
  const esquema = arq.esquema ?? 1;
  exigir(esquema === 1 || esquema === 2, `esquema de efemeride desconhecido: ${esquema}`);

  const ordem = arq.ordem!;
  exigir(Array.isArray(ordem), 'campo ordem nao e uma lista');
  exigir(ordem.length >= 2, `esperados ao menos 2 corpos, encontrados ${ordem.length}`);
  exigir(ordem[0] === 'sol', 'o primeiro corpo precisa ser o Sol');

  const corpos: Corpo[] = [];
  const pos: number[] = [];
  const vel: number[] = [];
  const gm: number[] = [];

  for (const chave of ordem) {
    const c = arq.corpos![chave];
    exigir(c, `corpo '${chave}' ausente`);
    for (const campo of ['nome', 'gm_au3_dia2', 'raio_km', 'posicao_ua', 'velocidade_ua_dia', 'id_horizons'] as const) {
      exigir(campo in c, `corpo '${chave}' sem o campo '${campo}'`);
    }
    exigir(eVetor3(c.posicao_ua), `corpo '${chave}': posicao precisa ser 3 numeros finitos`);
    exigir(eVetor3(c.velocidade_ua_dia), `corpo '${chave}': velocidade precisa ser 3 numeros finitos`);
    exigir(c.gm_au3_dia2 > 0, `corpo '${chave}': GM precisa ser positivo`);
    exigir(c.raio_km > 0, `corpo '${chave}': raio precisa ser positivo`);

    corpos.push({
      chave,
      nome: c.nome,
      papel: 'dinamico',
      gm: c.gm_au3_dia2,
      raioKm: c.raio_km,
      idHorizons: c.id_horizons,
      eBaricentro: chave !== 'sol',
    });
    pos.push(...c.posicao_ua);
    vel.push(...c.velocidade_ua_dia);
    gm.push(c.gm_au3_dia2);
  }

  const procedencia = arq.procedencia!;
  exigir(
    typeof procedencia.epoca?.jd_tdb === 'number',
    'efemeride sem o dia juliano da epoca: a data na tela nao teria de onde sair',
  );

  return {
    corpos,
    estado: criarEstado({ pos, vel, gm, tDias: 0, folga }),
    procedencia,
    validacao: arq.validacao ?? {},
    jdEpoca: procedencia.epoca.jd_tdb,
    emrat: arq.constantes_de440!.EMRAT,
  };
}

/** O preset canonico: Sol mais os oito baricentros, como o JPL os integra. */
export function carregar(folga = MAXIMO_DE_CORPOS_CRIADOS): Catalogo {
  return carregarDe(bruto, folga);
}

export function indiceDe(corpos: readonly Corpo[], chave: string): number {
  const i = corpos.findIndex((c) => c.chave === chave);
  if (i < 0) throw new Error(`corpo desconhecido: ${chave}`);
  return i;
}
