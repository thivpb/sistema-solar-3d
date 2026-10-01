/**
 * A lista em dois níveis: quem aparece, quando, e em que ordem o teclado anda.
 *
 * `agrupar` e `ordemVisivel` são funções puras e estão exportadas por isso: a
 * regra de quais luas aparecem é a peça que mais pode errar em silêncio, e
 * errá-la não quebra nada visivelmente — só faz uma lua sumir.
 *
 * As três formas de errar que este arquivo fecha:
 *   1. **A ordem do teclado divergir da ordem desenhada.** As setas andariam
 *      para um item que está noutro lugar da tela, ou para um que nem existe.
 *   2. **Escolher uma lua fechar o grupo em que ela está.** O grupo abre por
 *      causa do planeta escolhido; se a conta olhasse só para o planeta, clicar
 *      numa lua arrancaria o chão de baixo dela.
 *   3. **"Sem" esconder as luas da lista e não da cena, ou o contrário.**
 */
import { describe, expect, it } from 'vitest';
import {
  agrupar,
  ordemVisivel,
  type ItemDeCorpo,
} from '../src/interface/componentes/ListaDeCorpos.tsx';

const CORPOS: ItemDeCorpo[] = [
  { chave: 'sol', nome: 'Sol', tipo: 'corpo' },
  { chave: 'terra', nome: 'Terra', tipo: 'corpo' },
  { chave: 'marte', nome: 'Marte', tipo: 'corpo' },
  { chave: 'jupiter', nome: 'Júpiter', tipo: 'corpo' },
  { chave: 'lua', nome: 'Lua', tipo: 'lua', pai: 'terra' },
  { chave: 'fobos', nome: 'Fobos', tipo: 'lua', pai: 'marte' },
  { chave: 'deimos', nome: 'Deimos', tipo: 'lua', pai: 'marte' },
  { chave: 'io', nome: 'Io', tipo: 'lua', pai: 'jupiter' },
  { chave: 'europa', nome: 'Europa', tipo: 'lua', pai: 'jupiter' },
];

const chaves = (itens: readonly ItemDeCorpo[]): string[] => itens.map((i) => i.chave);

describe('agrupar', () => {
  it('nunca põe uma lua no primeiro nível', () => {
    for (const luas of ['com', 'sem', 'so'] as const) {
      const g = agrupar(CORPOS, luas, null);
      expect(chaves(g.map((x) => x.pai))).toEqual(['sol', 'terra', 'marte', 'jupiter']);
    }
  });

  it('com "sem", nenhuma lua existe na lista', () => {
    const g = agrupar(CORPOS, 'sem', 'jupiter');
    expect(g.flatMap((x) => x.luas)).toHaveLength(0);
    expect(g.every((x) => !x.aberto)).toBe(true);
    expect(chaves(ordemVisivel(g))).toEqual(['sol', 'terra', 'marte', 'jupiter']);
  });

  it('com "com", só o grupo do corpo escolhido abre', () => {
    const g = agrupar(CORPOS, 'com', 'marte');
    expect(g.filter((x) => x.aberto).map((x) => x.pai.chave)).toEqual(['marte']);
    expect(chaves(ordemVisivel(g))).toEqual(['sol', 'terra', 'marte', 'fobos', 'deimos', 'jupiter']);
  });

  it('escolher uma LUA mantém aberto o grupo dela', () => {
    // Sem isto, clicar em Europa fecharia o grupo de Júpiter no mesmo quadro —
    // e a linha que se acabou de escolher sairia da tela.
    const g = agrupar(CORPOS, 'com', 'europa');
    expect(g.filter((x) => x.aberto).map((x) => x.pai.chave)).toEqual(['jupiter']);
    expect(chaves(ordemVisivel(g))).toContain('europa');
  });

  it('com "só elas", abrem todos os grupos — inclusive sem nada escolhido', () => {
    const g = agrupar(CORPOS, 'so', null);
    expect(g.filter((x) => x.aberto).map((x) => x.pai.chave)).toEqual(['terra', 'marte', 'jupiter']);
    expect(chaves(ordemVisivel(g))).toEqual([
      'sol',
      'terra',
      'lua',
      'marte',
      'fobos',
      'deimos',
      'jupiter',
      'io',
      'europa',
    ]);
  });

  it('um planeta sem luas nunca fica "aberto", mesmo escolhido', () => {
    const g = agrupar(CORPOS, 'so', 'sol');
    expect(g.find((x) => x.pai.chave === 'sol')!.aberto).toBe(false);
  });

  it('a lua vem depois do pai dela, e nunca depois de outro planeta', () => {
    const ordem = chaves(ordemVisivel(agrupar(CORPOS, 'so', null)));
    for (const [lua, pai] of [
      ['lua', 'terra'],
      ['fobos', 'marte'],
      ['io', 'jupiter'],
    ] as const) {
      expect(ordem.indexOf(lua)).toBeGreaterThan(ordem.indexOf(pai));
    }
    // E entre o pai e a ultima filha nao entra planeta nenhum.
    expect(ordem.slice(ordem.indexOf('marte') + 1, ordem.indexOf('deimos') + 1)).toEqual([
      'fobos',
      'deimos',
    ]);
  });

  it('um corpo criado entra no primeiro nível, sem luas', () => {
    const comCriado = [...CORPOS, { chave: 'novo1', nome: 'Asteroide 1', tipo: 'corpo' as const, criado: true }];
    const g = agrupar(comCriado, 'com', 'novo1');
    const criado = g.find((x) => x.pai.chave === 'novo1')!;
    expect(criado.luas).toHaveLength(0);
    expect(criado.aberto).toBe(false);
  });

  it('a ordem visível é exatamente o que o teclado percorre — nenhum item fantasma', () => {
    // A guarda contra o defeito 1: tudo que `ordemVisivel` devolve tem de estar
    // entre os corpos de entrada, e nada pode aparecer duas vezes.
    for (const luas of ['com', 'sem', 'so'] as const) {
      for (const escolhido of [null, 'sol', 'marte', 'europa']) {
        const ordem = chaves(ordemVisivel(agrupar(CORPOS, luas, escolhido)));
        expect(new Set(ordem).size).toBe(ordem.length);
        for (const c of ordem) expect(chaves(CORPOS)).toContain(c);
      }
    }
  });
});
