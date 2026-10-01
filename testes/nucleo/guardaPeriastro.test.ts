/**
 * A guarda que impede o sandbox de produzir orbita-lixo.
 *
 * **A versao anterior deste arquivo era cega.** O ajudante que montava os
 * elementos fixava `excentricidade: 0, perielio: 1` e so variava o periodo —
 * numa orbita circular, periodo e periastro carregam a MESMA informacao, entao
 * nenhum dos sete casos conseguia distinguir um do outro. E a guarda estava
 * medindo o errado: o periodo depende so do semieixo maior, e numa orbita
 * alongada ele fica longo enquanto a passagem pelo periastro dura horas.
 *
 * Agora o ajudante recebe `a` e `e` e DERIVA periodo e periastro, que e o que
 * torna os dois numeros independentes e o teste capaz de ver a diferenca.
 */
import { describe, expect, it } from 'vitest';
import { avaliarCriacao, passosNoPeriastro, passosPorOrbita } from '@nucleo/guardas.ts';
import { PASSO_CURTO_DIAS, PASSO_PADRAO_DIAS, avancar, yoshida4 } from '@nucleo/integrador.ts';
import { elementosOsculadores } from '@nucleo/efemerides.ts';
import { inserirCorpo } from '@nucleo/estado.ts';
import { ajustarRascunho } from '@nucleo/tipos.ts';
import type { ElementosOsculadores } from '@nucleo/efemerides.ts';
import { novo } from './ajuda.ts';

/** GM do Sol, do cabecalho do DE440. */
const MU = 2.9591220828559115e-4;

/** Deriva periodo e periastro de (a, e) — assim os dois deixam de ser o mesmo numero. */
function orbita(aUa: number, exc: number): ElementosOsculadores {
  return {
    ligada: true,
    a: aUa,
    excentricidade: exc,
    perielio: aUa * (1 - exc),
    afelio: aUa * (1 + exc),
    periodoDias: 2 * Math.PI * Math.sqrt(aUa ** 3 / MU),
    inclinacaoGraus: 0,
  };
}

describe('orbitas normais passam', () => {
  it('a Terra', () => {
    expect(avaliarCriacao(orbita(1, 0.0167), MU).aceito).toBe(true);
  });

  it('Mercurio, que e o mais rapido e o mais excentrico dos oito', () => {
    expect(avaliarCriacao(orbita(0.3871, 0.2056), MU).aceito).toBe(true);
  });
});

describe('o caso que a versao cega deste teste deixava passar', () => {
  // a = 2,51 UA, e = 0,990. Periodo de 1.455 dias = 2.909 passos por volta,
  // numero enorme e tranquilizador. Periastro a 0,025 UA: a passagem dura
  // 1,46 dia, ou 2,9 passos.
  const alongada = orbita(2.5126, 0.99);

  it('tem periodo LONGO e periastro CURTO — as duas contas discordam', () => {
    expect(passosPorOrbita(alongada.periodoDias, PASSO_PADRAO_DIAS)).toBeGreaterThan(2000);
    expect(passosNoPeriastro(alongada.perielio, MU, PASSO_PADRAO_DIAS)).toBeLessThan(5);
  });

  it('e recusado, pela conta do periastro', () => {
    const v = avaliarCriacao(alongada, MU);
    expect(v.aceito).toBe(false);
    if (v.aceito) return;
    expect(v.razao).toBe('periastro-rapido-demais');
    expect(v.passosPorVolta).toBeGreaterThan(2000);
    expect(v.passosNoPeriastro).toBeLessThan(5);
  });

  it('e a fisica confirma: aceitar isso expulsaria o corpo do sistema', () => {
    // Este e o teste que prova que a guarda nao e paranoia. Um corpo de prova
    // (gm = 0, nao perturba ninguem) com esses elementos, integrado por uma
    // volta nominal, deixa de estar em orbita ligada.
    const { estado, rascunho: r0 } = novo();
    // 5 UA, velocidade transversal = 10% da circular. Da a = 2,51 e e = 0,990.
    const r = 5;
    const vCirc = Math.sqrt(MU / r);
    const i = inserirCorpo(estado, [r, 0, 0], [0, 0.1 * vCirc, 0], 0);
    const rascunho = ajustarRascunho(r0, estado.capacidade);

    const antes = elementosOsculadores(estado, i);
    expect(antes.excentricidade).toBeCloseTo(0.99, 2);
    expect(avaliarCriacao(antes, MU).aceito).toBe(false);

    avancar(estado, yoshida4, PASSO_PADRAO_DIAS, Math.round(antes.periodoDias / PASSO_PADRAO_DIAS), rascunho);
    const depois = elementosOsculadores(estado, i);
    expect(depois.ligada, 'o corpo continuou preso ao Sol — a guarda seria desnecessaria').toBe(false);
  });
});

describe('o limite e sobre tempo, nao sobre distancia', () => {
  it('40 passos na conta que reprovar primeiro', () => {
    // Numa orbita circular periastro e semieixo sao o mesmo numero, entao as
    // duas contas coincidem e o limite aparece limpo.
    // T no limite = 40 passos x 0,5 dia = 20 dias; a = cbrt(mu * (T/2pi)^2).
    const tLimite = 40 * PASSO_PADRAO_DIAS;
    const aLimite = Math.cbrt(MU * (tLimite / (2 * Math.PI)) ** 2);

    // Confere a propria conta antes de usar como regua: a primeira versao
    // deste teste errou o fator e mirou em 80 passos achando que eram 40.
    expect(passosPorOrbita(orbita(aLimite, 0).periodoDias, PASSO_PADRAO_DIAS)).toBeCloseTo(40, 6);

    expect(avaliarCriacao(orbita(aLimite * 1.05, 0), MU).aceito).toBe(true);
    expect(avaliarCriacao(orbita(aLimite * 0.9, 0), MU).aceito).toBe(false);
  });

  it('o passo curto e oferecido quando resolve, e so quando resolve', () => {
    const comSaida = avaliarCriacao(orbita(0.06, 0), MU);
    expect(comSaida.aceito).toBe(false);
    if (!comSaida.aceito) expect(comSaida.passoSugeridoDias).toBe(PASSO_CURTO_DIAS);

    const semSaida = avaliarCriacao(orbita(0.01, 0), MU);
    expect(semSaida.aceito).toBe(false);
    if (!semSaida.aceito) expect(semSaida.passoSugeridoDias).toBeNull();
  });
});

describe('orbitas abertas', () => {
  const hiperbole = (perielio: number): ElementosOsculadores => ({
    ligada: false, a: Infinity, excentricidade: 1.5, perielio,
    afelio: Infinity, periodoDias: NaN, inclinacaoGraus: 0,
  });

  it('com periastro largo sao permitidas: o corpo so vai embora', () => {
    expect(avaliarCriacao(hiperbole(3), MU).aceito).toBe(true);
  });

  it('com periastro minusculo NAO sao: ele vai embora por um caminho inventado', () => {
    // Medido no caso quase radial: dE/E = 1,5e3 em 2.000 dias. Sem periodo
    // para medir, so o periastro pega isso — e a versao anterior da guarda
    // liberava toda hiperbole sem olhar.
    const v = avaliarCriacao(hiperbole(0.02), MU);
    expect(v.aceito).toBe(false);
    if (!v.aceito) expect(v.razao).toBe('periastro-rapido-demais');
  });
});

describe('forma do veredito', () => {
  it('nao traz frase nenhuma: a prosa e da interface, nao da fisica', () => {
    const v = avaliarCriacao(orbita(0.05, 0), MU);
    expect(Object.values(v).some((x) => typeof x === 'string' && x.includes(' '))).toBe(false);
  });

  it('as contas ignoram o sinal do passo', () => {
    expect(passosPorOrbita(365.25, -0.5)).toBe(passosPorOrbita(365.25, 0.5));
    expect(passosNoPeriastro(1, MU, -0.5)).toBe(passosNoPeriastro(1, MU, 0.5));
  });
});
