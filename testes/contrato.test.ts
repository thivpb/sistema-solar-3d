/**
 * O CONTRATO.md nao pode citar prova que nao existe.
 *
 * As 43 funcionalidades vem com uma coluna `Prova`: o teste automatizado que
 * verifica cada uma, ou um roteiro manual de uma frase. O arquivo existe desde
 * o primeiro dia para que o risco numero um do projeto — terminar com fisica
 * certa, 3D bonito e metade do conteudo educativo faltando — tenha um lugar
 * onde ser conferido.
 *
 * Uma auditoria encontrou o contrato citando **catorze arquivos de teste que
 * nunca existiram**, em dezessete dos quarenta e tres itens. Esse e o pior
 * defeito possivel num contrato: ele afirma prova, e a prova nao esta la.
 * Quem lesse a linha e confiasse nela pararia de procurar.
 *
 * Este arquivo transforma a coluna `Prova` em algo verificavel. Ele nao julga
 * se o teste citado prova o que diz provar — isso nenhuma maquina faz —, mas
 * garante que ele EXISTE, que o nome esta certo, e que a contagem de itens e a
 * que o titulo promete.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const contrato = readFileSync(join(RAIZ, 'CONTRATO.md'), 'utf8');

/** Todo arquivo de teste que existe de fato, pelo nome com extensao. */
function testesNoDisco(pasta: string, achados = new Set<string>()): Set<string> {
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    if (e.isDirectory()) testesNoDisco(join(pasta, e.name), achados);
    else if (/\.(test|spec)\.tsx?$/.test(e.name)) achados.add(e.name);
  }
  return achados;
}
const existentes = testesNoDisco(join(RAIZ, 'testes'));

interface Linha {
  numero: number;
  titulo: string;
  fase: string;
  prova: string;
  estado: string;
}

const linhas: Linha[] = [];
for (const l of contrato.split('\n')) {
  if (!/^\|\s*\d+\s*\|/.test(l)) continue;
  // Corta nos pipes que NAO estao escapados: o titulo do item 24 contem
  // `\|L\|`, o modulo do momento angular, e um split ingenuo o parte em tres.
  const celulas = l
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
  if (celulas.length !== 5) continue;
  linhas.push({
    numero: Number(celulas[0]),
    titulo: celulas[1]!,
    fase: celulas[2]!,
    prova: celulas[3]!,
    estado: celulas[4]!,
  });
}

/** Os nomes de arquivo citados numa celula de prova. */
const citados = (prova: string): string[] =>
  [...prova.matchAll(/`([^`]*\.(?:test|spec)\.tsx?)`/g)].map((m) => {
    const caminho = m[1]!;
    return caminho.slice(caminho.lastIndexOf('/') + 1);
  });

describe('o contrato', () => {
  it('tem as 43 funcionalidades, numeradas de 1 a 43 sem buraco', () => {
    expect(linhas.length).toBe(43);
    expect(linhas.map((l) => l.numero)).toEqual(Array.from({ length: 43 }, (_, i) => i + 1));
  });

  it('toda prova citada existe no disco', () => {
    const faltando: string[] = [];
    for (const l of linhas) {
      for (const arquivo of citados(l.prova)) {
        if (!existentes.has(arquivo)) faltando.push(`#${l.numero} ${l.titulo.slice(0, 44)} → ${arquivo}`);
      }
    }
    expect(
      faltando,
      'o contrato afirma prova que não existe — é o pior defeito possível nele:\n  ' +
        faltando.join('\n  '),
    ).toEqual([]);
  });

  it('todo item tem prova: um arquivo de teste ou um roteiro manual', () => {
    const sem = linhas
      .filter((l) => citados(l.prova).length === 0 && !l.prova.includes('manual:'))
      .map((l) => `#${l.numero} ${l.titulo.slice(0, 44)} → "${l.prova}"`);
    expect(sem, 'itens sem prova nenhuma:\n  ' + sem.join('\n  ')).toEqual([]);
  });

  it('todo estado e um dos cinco declarados', () => {
    const validos = ['pendente', 'feito', 'mudado', 'defeito', 'parcial'];
    for (const l of linhas) {
      const limpo = l.estado.replace(/\*\*/g, '').split('—')[0]!.trim();
      const partes = limpo.split('·').map((x) => x.trim());
      for (const p of partes) {
        expect(validos, `#${l.numero}: estado "${p}"`).toContain(p);
      }
    }
  });

  it('toda fase citada existe no plano', () => {
    for (const l of linhas) {
      expect(['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'], `#${l.numero}`).toContain(l.fase);
    }
  });

  it('o resumo no fim bate com a contagem das linhas', () => {
    // Um resumo escrito a mao diverge da tabela no primeiro item que muda de
    // estado, e ninguem recontaria 43 linhas para conferir.
    const m = /<!-- contagem: (.+?) -->/.exec(contrato);
    expect(m, 'falta o comentário de contagem no fim do CONTRATO.md').not.toBeNull();
    const declarado = Object.fromEntries(
      m![1]!.split(',').map((p) => {
        const [k, v] = p.trim().split('=');
        return [k!.trim(), Number(v)];
      }),
    );
    const real: Record<string, number> = {};
    for (const l of linhas) {
      const chave = l.estado.replace(/\*\*/g, '').split('—')[0]!.trim().split('·')[0]!.trim();
      real[chave] = (real[chave] ?? 0) + 1;
    }
    expect(real).toEqual(declarado);
  });
});
