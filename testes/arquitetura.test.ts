/**
 * Sucessor de tests/test_arquitetura.py.
 *
 * O teste antigo dizia, no proprio docstring, por que existia: "Uma afirmacao que nada verifica
 * apodrece." A documentacao anterior do projeto garantia que fisica e interface eram separadas
 * enquanto um arquivo da interface importava um atalho da raiz, e ninguem percebeu.
 *
 * Aqui sao tres garantias, e nao uma:
 *
 *   1. As sete regras existem. Apagar uma regra do .dependency-cruiser.cjs quebra este teste,
 *      o que impede o caminho mais facil de "passar" num lint de arquitetura.
 *   2. Nenhuma regra e violada hoje.
 *   3. Todo modulo de src/nucleo/ carrega num ambiente sem navegador. E a segunda barreira,
 *      independente do dependency-cruiser: se alguem tocar `document` dentro da fisica, o
 *      import explode aqui mesmo.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const exigir = createRequire(import.meta.url);

const REGRAS_ESPERADAS = [
  'nucleo-isolado',
  'nucleo-sem-navegador',
  'dados-nao-ve-a-tela',
  'cena-nao-ve-app',
  'rotulos-puros-sao-puros',
  'interface-nao-ve-three',
  'sem-ciclos',
] as const;

describe('as regras de camada', () => {
  it('estao todas declaradas', () => {
    const config = exigir(join(RAIZ, '.dependency-cruiser.cjs')) as {
      forbidden: { name: string; severity: string }[];
    };
    const nomes = config.forbidden.map((regra) => regra.name);
    for (const esperada of REGRAS_ESPERADAS) expect(nomes).toContain(esperada);
    // Uma regra rebaixada para "warn" continua na lista e para de travar o build.
    for (const regra of config.forbidden) expect(regra.severity).toBe('error');
  });

  it('nao sao violadas', () => {
    expect(() =>
      execFileSync(
        'npx',
        ['depcruise', '--config', '.dependency-cruiser.cjs', '--output-type', 'err', 'src', 'testes'],
        { cwd: RAIZ, stdio: 'pipe', encoding: 'utf8' },
      ),
    ).not.toThrow();
  });
});

describe('o nucleo roda sem navegador', () => {
  const pasta = join(RAIZ, 'src', 'nucleo');
  const modulos = existsSync(pasta)
    ? readdirSync(pasta, { recursive: true, encoding: 'utf8' }).filter((nome) =>
        nome.endsWith('.ts'),
      )
    : [];

  it.each(modulos.length > 0 ? modulos : ['(nenhum modulo ainda — fase F1)'])(
    'carrega %s',
    async (nome) => {
      if (modulos.length === 0) return;
      await expect(import(join(pasta, nome))).resolves.toBeDefined();
    },
  );
});
