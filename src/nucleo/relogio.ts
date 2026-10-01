/**
 * O relogio da simulacao: de `tDias` para uma data que alguem le.
 *
 * A conversao de dia juliano para data civil e feita por aritmetica inteira
 * (algoritmo de Fliegel e Van Flandern), e nao pelo `Date` do JavaScript. Tres
 * motivos, nesta ordem: `Date` carrega fuso horario, que aqui nao existe —
 * a escala e TDB; `Date` so vai ate +-273.790 anos, e o programa permite
 * andar bem alem disso; e o nucleo tem de ser deterministico e sem plataforma,
 * o que o lint ja cobra proibindo `Date.now` aqui dentro.
 */
import { ANO_DIAS } from './unidades.ts';

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

/**
 * A escada de velocidade. Cada degrau e uma escolha de leitura, nao uma
 * progressao geometrica: 1 dia/s para ver a Lua, 30 para ver os internos, 365
 * para ver a Terra fechar uma volta por segundo, 7300 para ver Netuno andar.
 */
export const ESCADA_DIAS_POR_SEGUNDO = [1, 5, 30, 100, 365, 1825, 3650, 7300] as const;

export interface DataCivil {
  ano: number;
  mes: number; // 1 a 12
  dia: number;
}

/** Dia juliano -> data civil, por aritmetica inteira. Vale para qualquer ano. */
export function dataDeJulianoTdb(jd: number): DataCivil {
  // +0,5 porque o dia juliano vira a meia-noite e comeca ao meio-dia.
  const z = Math.floor(jd + 0.5);
  let a = z;
  if (z >= 2299161) {
    const alfa = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alfa - Math.floor(alfa / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const dia = b - d - Math.floor(30.6001 * e);
  const mes = e < 14 ? e - 1 : e - 13;
  const ano = mes > 2 ? c - 4716 : c - 4715;
  return { ano, mes, dia };
}

export function dataDaSimulacao(jdEpoca: number, tDias: number): DataCivil {
  return dataDeJulianoTdb(jdEpoca + tDias);
}

/** "21 de setembro de 2026". A forma longa, para a barra lateral. */
export function dataPorExtenso(data: DataCivil): string {
  const mes = MESES[data.mes - 1] ?? '?';
  if (data.ano <= 0) {
    // Ano juliano 0 e 1 a.C., -1 e 2 a.C., e assim por diante.
    return `${data.dia} de ${mes} de ${1 - data.ano} a.C.`;
  }
  return `${data.dia} de ${mes} de ${data.ano}`;
}

/** "21/09/2026". A forma curta, para dentro de caixas estreitas. */
export function dataCurta(data: DataCivil): string {
  const dd = String(data.dia).padStart(2, '0');
  const mm = String(data.mes).padStart(2, '0');
  return `${dd}/${mm}/${data.ano}`;
}

/**
 * "30 dias por segundo", "3 meses por segundo", "10 anos por segundo".
 *
 * Porte literal de `rotulo_velocidade` do original, inclusive o degrau de
 * MESES entre 45 e 300 dias — sem ele, 100 dias/s viraria "0,3 ano por
 * segundo", que nao diz nada a ninguem. Arredonda para numero inteiro de
 * proposito: "9,9 anos por segundo" tem uma precisao que a leitura nao usa.
 */
export function velocidadePorExtenso(diasPorSegundo: number): string {
  const d = diasPorSegundo;
  if (d <= 0) return 'pausado';
  if (d < 2) return '1 dia por segundo';
  if (d < 45) return `${d.toFixed(0)} dias por segundo`;
  if (d < 300) {
    const meses = d / 30.44;
    return `${meses.toFixed(0)} ${meses < 1.5 ? 'mês' : 'meses'} por segundo`;
  }
  const anos = d / ANO_DIAS;
  return `${anos.toFixed(0)} ${anos < 1.5 ? 'ano' : 'anos'} por segundo`;
}

/**
 * O degrau seguinte ou anterior da escada, limitado pelo teto da maquina.
 *
 * Quando a velocidade atual NAO esta na escada, parte-se do degrau mais
 * PROXIMO, e nao do primeiro. A diferenca aparece quando a calibragem corta a
 * escada entre duas aberturas, ou quando um arquivo de preferencias guarda um
 * valor que deixou de existir: partir do primeiro jogaria alguem de 3650
 * dias/s para 5 num toque, o que parece defeito.
 */
export function mudarVelocidade(atual: number, passo: -1 | 1, tetoDiasPorSegundo: number): number {
  const possiveis = ESCADA_DIAS_POR_SEGUNDO.filter((v) => v <= tetoDiasPorSegundo);
  const degraus: readonly number[] = possiveis.length > 0 ? possiveis : [ESCADA_DIAS_POR_SEGUNDO[0]];

  let i = degraus.indexOf(atual);
  if (i < 0) {
    i = degraus.reduce(
      (melhor, v, k) => (Math.abs(v - atual) < Math.abs(degraus[melhor]! - atual) ? k : melhor),
      0,
    );
  }
  const j = Math.min(degraus.length - 1, Math.max(0, i + passo));
  return degraus[j]!;
}
