/**
 * Toda acao declarada tem quem a construa.
 *
 * O `const _: never = acao` no reducer cobre um lado: um membro NOVO da uniao
 * que ninguem trata nao compila. Ele nao cobre o outro — um membro que ninguem
 * CONSTROI nao e erro de compilacao em TypeScript, e fica ali como codigo
 * morto no reducer, parecendo funcionalidade.
 *
 * Este teste le o codigo-fonte e procura o produtor. E o mesmo espirito do
 * `test_arquitetura.py` do projeto anterior: "uma afirmacao que nada verifica
 * apodrece".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS_DE_ACAO } from '@app/acoes.ts';
import { aplicar } from '@app/aplicar.ts';
import { ESTADO_INICIAL } from '@app/estadoUi.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { recursive: true, encoding: 'utf8' })
    .filter((n) => n.endsWith('.ts') || n.endsWith('.tsx'))
    .map((n) => join(pasta, n));
}

// Onde a acao e DECLARADA ou CONSUMIDA. Achar o tipo aqui nao conta como produtor.
const NAO_CONTA = ['acoes.ts', 'aplicar.ts'];

const fontes = arquivos(RAIZ)
  .filter((f) => !NAO_CONTA.some((n) => f.endsWith(n)))
  .map((f) => ({ arquivo: f, texto: readFileSync(f, 'utf8') }));

describe('cada tipo de acao tem produtor', () => {
  for (const tipo of TIPOS_DE_ACAO) {
    it(`'${tipo}' e construida por alguem`, () => {
      const onde = fontes.filter((f) => f.texto.includes(`tipo: '${tipo}'`));
      expect(
        onde.length,
        `nenhum componente ou atalho constroi { tipo: '${tipo}' } — ou e codigo morto no reducer, ou falta o controle`,
      ).toBeGreaterThan(0);
    });
  }
});

describe('a lista de tipos nao diverge da uniao', () => {
  it('TIPOS_DE_ACAO cobre tudo que o reducer trata', () => {
    const reducer = readFileSync(join(RAIZ, 'app', 'aplicar.ts'), 'utf8');
    for (const tipo of TIPOS_DE_ACAO) {
      expect(reducer.includes(`case '${tipo}'`), `o reducer nao trata '${tipo}'`).toBe(true);
    }
  });

  it('o reducer nao trata nada fora da lista', () => {
    const reducer = readFileSync(join(RAIZ, 'app', 'aplicar.ts'), 'utf8');
    const tratados = [...reducer.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]!);
    for (const tipo of tratados) {
      expect(TIPOS_DE_ACAO as readonly string[], `'${tipo}' esta no reducer e nao na lista`).toContain(tipo);
    }
  });
});

describe('o alvo do enquadramento e a escolha mais recente', () => {
  it('escolher outro corpo e pedir "chegar perto" vai para o corpo novo', () => {
    // Os dois campos guardam intencao da pessoa. O `selecionado` e a mais
    // recente: com a prioridade invertida, quem acompanhava Júpiter, clicava
    // na Terra e apertava 4 continuava em Júpiter, com a lista mostrando a
    // Terra e a exposição medindo 5,2 UA. Nada na tela explicava.
    const ctx = { chaves: ['sol', 'terra', 'jupiter'], tetoDiasPorSegundo: 7300, nomeDe: (c: string) => c };
    let e = ESTADO_INICIAL;
    e = aplicar(e, { tipo: 'selecionar', chave: 'jupiter' }, ctx).ui;
    e = aplicar(e, { tipo: 'trocar-modo', modo: 'perto' }, ctx).ui;
    expect(e.acompanhado).toBe('jupiter');

    e = aplicar(e, { tipo: 'selecionar', chave: 'terra' }, ctx).ui;
    const r = aplicar(e, { tipo: 'trocar-modo', modo: 'perto' }, ctx);
    expect(r.ui.acompanhado).toBe('terra');
    expect(r.efeitos.find((f) => f.tipo === 'enquadrar')).toMatchObject({ alvo: 'terra' });
  });

  it('sem nenhum corpo escolhido, o pedido vira aviso em vez de modo quebrado', () => {
    const ctx = { chaves: ['sol', 'terra'], tetoDiasPorSegundo: 7300, nomeDe: (c: string) => c };
    const r = aplicar(ESTADO_INICIAL, { tipo: 'trocar-modo', modo: 'acompanhar' }, ctx);
    expect(r.ui.modo).toBe(ESTADO_INICIAL.modo);
    expect(r.efeitos.some((f) => f.tipo === 'avisar')).toBe(true);
  });
});
