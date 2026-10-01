/**
 * Inserir um corpo de massa zero nao muda NADA para os outros.
 *
 * Este teste prova tres coisas de uma vez, e por isso vale o que custa:
 *
 *   - o crescimento dos buffers (Float64Array maior) nao corrompeu dado;
 *   - o remapeamento de indices esta certo;
 *   - o laco simetrico de forcas nao mudou a ordem em que os pares antigos sao
 *     somados.
 *
 * A exigencia e BIT A BIT, e ela e legitima: somar `0.0` e exato em IEEE-754, e
 * inserir no fim preserva a ordem de somatorio dos pares que ja existiam. Se
 * alguem trocar a insercao por um "swap-remove" ou reordenar os corpos por
 * qualquer criterio, este teste quebra — que e o ponto.
 */
import { describe, expect, it } from 'vitest';
import { avancar, yoshida4 } from '@nucleo/integrador.ts';
import { inserirCorpo, removerCorpo } from '@nucleo/estado.ts';
import { ajustarRascunho } from '@nucleo/tipos.ts';
import { novo } from './ajuda.ts';

const PASSOS = 2000;

describe('insercao de um corpo de prova', () => {
  it('nao altera um unico bit da trajetoria dos outros nove', () => {
    const referencia = novo();
    avancar(referencia.estado, yoshida4, 0.5, PASSOS, referencia.rascunho);

    const comIntruso = novo();
    inserirCorpo(comIntruso.estado, [2.7, 0.3, 0.05], [-0.002, 0.011, 0.0004], 0);
    comIntruso.rascunho = ajustarRascunho(comIntruso.rascunho, comIntruso.estado.capacidade);
    avancar(comIntruso.estado, yoshida4, 0.5, PASSOS, comIntruso.rascunho);

    expect(comIntruso.estado.n).toBe(10);
    for (let k = 0; k < 27; k++) {
      expect(comIntruso.estado.pos[k], `pos[${k}]`).toBe(referencia.estado.pos[k]);
      expect(comIntruso.estado.vel[k], `vel[${k}]`).toBe(referencia.estado.vel[k]);
    }
  });

  it('o corpo de prova SENTE os outros — e nao apenas continua em linha reta', () => {
    // A primeira versao deste teste soltava o corpo com velocidade e exigia
    // que ele se movesse. Isso passa com a gravidade DESLIGADA: ele se move
    // por inercia. Para provar que a forca chega nele, ha dois jeitos, e os
    // dois estao aqui.
    const { estado, rascunho: r0 } = novo();
    // 1) Parado. Sem gravidade ele fica exatamente onde foi largado.
    const i = inserirCorpo(estado, [2.7, 0.3, 0.05], [0, 0, 0], 0);
    const rascunho = ajustarRascunho(r0, estado.capacidade);
    const p0: [number, number, number] = [estado.pos[3 * i]!, estado.pos[3 * i + 1]!, estado.pos[3 * i + 2]!];
    const sol0: [number, number, number] = [estado.pos[0]!, estado.pos[1]!, estado.pos[2]!];

    // POUCOS passos, de proposito. A primeira versao usava os mesmos 2.000
    // passos do teste de bit-a-bit — mil dias — e um corpo largado parado a
    // 2,7 UA cai no Sol em 143 dias. Depois disso ele ja atravessou e esta
    // saindo do outro lado, e a projecao dava -0,99999: alinhamento perfeito,
    // sentido oposto. A queda tem de ser medida enquanto ainda e queda.
    const PASSOS_DE_QUEDA = 20; // 10 dias
    avancar(estado, yoshida4, 0.5, PASSOS_DE_QUEDA, rascunho);
    const p1: [number, number, number] = [estado.pos[3 * i]!, estado.pos[3 * i + 1]!, estado.pos[3 * i + 2]!];
    const andou = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    expect(andou, 'parado e sem forca, deveria ficar onde estava').toBeGreaterThan(1e-6);

    // 2) E caiu NA DIRECAO do Sol, que e onde a gravidade aponta. A direcao
    // se mede a partir de onde o Sol ESTAVA quando o corpo foi largado.
    const paraOSol: [number, number, number] = [sol0[0] - p0[0], sol0[1] - p0[1], sol0[2] - p0[2]];
    const n = Math.hypot(...paraOSol);
    const projecao =
      ((p1[0] - p0[0]) * paraOSol[0] + (p1[1] - p0[1]) * paraOSol[1] + (p1[2] - p0[2]) * paraOSol[2]) / n;
    expect(projecao / andou, 'o deslocamento nao aponta para o Sol').toBeGreaterThan(0.9);
  });

  it('remover devolve o estado ao que era, sem embaralhar a ordem', () => {
    const { estado } = novo();
    const antes = estado.pos.slice(0, 27);
    const i = inserirCorpo(estado, [1, 2, 3], [4, 5, 6], 1e-12);
    removerCorpo(estado, i);
    expect(estado.n).toBe(9);
    expect(Array.from(estado.pos.slice(0, 27))).toEqual(Array.from(antes));
  });

  it('remover do meio desloca os seguintes, em vez de trocar pelo ultimo', () => {
    const { estado } = novo();
    const netuno = estado.pos.slice(24, 27);
    removerCorpo(estado, 1); // tira Mercurio
    expect(estado.n).toBe(8);
    // Netuno era o indice 8; agora e o 7, e continua sendo o ultimo.
    expect(Array.from(estado.pos.slice(21, 24))).toEqual(Array.from(netuno));
  });
});
