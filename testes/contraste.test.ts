/**
 * Porte de `tests/test_tema.py`. Falha o build em qualquer par abaixo do limite.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANCO, PRETO, compor, contraste, luminancia } from '@interface/contraste.ts';
import {
  ALFA_DA_PLACA,
  COR_DOS_CORPOS,
  PARES_PARA_CONFERIR,
  NUNCA_COMO_TEXTO,
  TEMA,
  corDaOrbita,
  corDaTrilha,
} from '@interface/tema.ts';

describe('a formula da WCAG 2.2', () => {
  it('da os extremos conhecidos', () => {
    expect(contraste(BRANCO, PRETO)).toBeCloseTo(21, 6);
    expect(contraste(TEMA.texto, TEMA.texto)).toBeCloseTo(1, 12);
    expect(luminancia(BRANCO)).toBeCloseTo(1, 12);
    expect(luminancia(PRETO)).toBe(0);
  });

  it('e simetrica', () => {
    expect(contraste(TEMA.texto, TEMA.fundo)).toBe(contraste(TEMA.fundo, TEMA.texto));
  });
});

describe('todos os pares que a interface usa de verdade', () => {
  for (const par of PARES_PARA_CONFERIR) {
    it(`${par.nome}: >= ${par.minimo}:1`, () => {
      const r = contraste(par.frente, par.atras);
      expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(par.minimo);
    });
  }
});

describe('COR DE PLANETA NAO E COR DE TEXTO', () => {
  it('Netuno reprova como texto — e por isso a regra nao e preferencia', () => {
    // Medido nesta paleta: Netuno 4,4997:1, por pouco abaixo dos 4,5 exigidos.
    // Se um dia ele passar, a regra vira gosto em vez de necessidade, e alguem
    // vai afrouxa-la. Que este teste avise antes.
    expect(contraste(COR_DOS_CORPOS['netuno']!, TEMA.fundo)).toBeLessThan(4.5);
  });

  it('Marte PASSARIA como texto, e ainda assim a regra vale para ele', () => {
    // O comentario herdado do projeto em Python dizia que Marte reprovava.
    // Nao reprova: da 4,74:1. A regra continua uniforme de proposito — uma
    // excecao por corpo seria uma armadilha na proxima cor que entrasse.
    expect(contraste(COR_DOS_CORPOS['marte']!, TEMA.fundo)).toBeGreaterThan(4.5);
    expect(NUNCA_COMO_TEXTO).toContain('marte');
    expect(NUNCA_COMO_TEXTO).toEqual(Object.keys(COR_DOS_CORPOS));
  });

  it('mas todas passam como disco e como linha, que e o uso permitido', () => {
    for (const [chave, cor] of Object.entries(COR_DOS_CORPOS)) {
      expect(contraste(cor, TEMA.fundo), chave).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('a placa atras dos rotulos', () => {
  it('0,80 passa com folga nos dois extremos de cena', () => {
    expect(contraste(TEMA.texto, compor(TEMA.fundo, ALFA_DA_PLACA, BRANCO))).toBeGreaterThan(8);
    expect(contraste(TEMA.texto, compor(TEMA.fundo, ALFA_DA_PLACA, PRETO))).toBeGreaterThan(8);
  });

  it('o minimo real e 0,63 — 0,62 fica a um milesimo de passar, e nao passa', () => {
    // O numero esta escrito no tema como justificativa da escolha de 0,80.
    // Se a paleta mudar, este teste diz na hora que a justificativa mudou.
    expect(contraste(TEMA.texto, compor(TEMA.fundo, 0.6, BRANCO))).toBeLessThan(4.5);
    expect(contraste(TEMA.texto, compor(TEMA.fundo, 0.62, BRANCO))).toBeLessThan(4.5);
    expect(contraste(TEMA.texto, compor(TEMA.fundo, 0.63, BRANCO))).toBeGreaterThanOrEqual(4.5);
  });

  it('a composicao e feita sobre sRGB, nao em luz linear', () => {
    // Em luz linear a conta daria ~0,86 como minimo. A diferenca decide se a
    // placa precisa escurecer ou nao, entao vale um teste proprio.
    const meio = compor(BRANCO, 0.5, PRETO);
    expect(meio).toEqual([128, 128, 128]);
  });
});

describe('cores derivadas', () => {
  it('a trilha e mais discreta que o disco, e a orbita mais ainda', () => {
    for (const chave of Object.keys(COR_DOS_CORPOS)) {
      const disco = luminancia(COR_DOS_CORPOS[chave]!);
      expect(luminancia(corDaTrilha(chave))).toBeLessThan(disco);
      expect(luminancia(corDaOrbita(chave))).toBeLessThan(luminancia(corDaTrilha(chave)));
      expect(luminancia(corDaOrbita(chave, true))).toBeGreaterThan(luminancia(corDaOrbita(chave)));
    }
  });

  it('corpo desconhecido nao explode: cai no texto fraco', () => {
    expect(corDaTrilha('plutao')).toBeDefined();
  });
});

/**
 * O `base.css` e o `tema.ts` tem de dizer a MESMA cor.
 *
 * O teste acima confere contraste entre valores de `TEMA`. Quem desenha a tela
 * e o CSS, com `--fundo`, `--acento` e companhia escritos a mao no `:root`. As
 * duas listas sempre foram duas copias, e uma copia que ninguem compara e uma
 * copia que diverge: bastaria clarear `--texto-fraco` no CSS para a conferencia
 * continuar verde medindo uma cor que a tela nao usa mais. Seria o padrao que
 * este projeto ja pagou caro — um teste sobre um objeto que ninguem le.
 */
describe('as cores do CSS', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/interface/base.css'), 'utf8');
  const declaradas = new Map<string, string>();
  for (const m of css.matchAll(/^\s*(--[a-z-]+):\s*(#[0-9a-f]{6});/gim)) {
    declaradas.set(m[1]!, m[2]!.toLowerCase());
  }
  const emKebab = (nome: string): string =>
    '--' + nome.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const emHex = (c: readonly number[]): string =>
    '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

  it('achou as variaveis no arquivo', () => {
    // A guarda: se a expressao regular deixasse de casar, o laco abaixo ficaria
    // vazio e passaria sem comparar nada.
    expect(declaradas.size).toBeGreaterThanOrEqual(14);
  });

  for (const [nome, cor] of Object.entries(TEMA)) {
    it(`--${emKebab(nome).slice(2)} bate com TEMA.${nome}`, () => {
      const noCss = declaradas.get(emKebab(nome));
      expect(noCss, `o CSS nao declara ${emKebab(nome)}`).toBeDefined();
      expect(noCss).toBe(emHex(cor));
    });
  }
});
