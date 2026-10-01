/**
 * A colocacao dos nomes na tela.
 *
 * Duas propriedades deste modulo nao se enxergam num quadro parado e sao
 * exatamente as que se perdem sem teste:
 *
 *   - **Histerese.** Sem ela os nomes piscam de lado quando dois planetas se
 *     cruzam — o colocador acha uma solucao melhor a cada quadro e troca, e a
 *     tela fica nervosa. A lição vem da versao em pygame.
 *   - **Banda morta de movimento.** Enquanto a camera gira, a escolha de
 *     direcao fica congelada: quem gira a camera esta olhando o movimento, nao
 *     lendo nomes.
 *
 * O contraste e a legibilidade dos rotulos ficam com `e2e/rotulos`, que mede
 * pixels; aqui e so geometria, e por isso roda em milissegundos.
 */
import { describe, expect, it } from 'vitest';
import { abreviar, colocar, type Candidato, type Opcoes, type Retangulo } from '@rotulos/posicionador.ts';

const medir = (t: string): number => t.length * 7;

function opcoes(extra: Partial<Opcoes> = {}): Opcoes {
  return {
    larguraTela: 1200,
    alturaTela: 800,
    alturaDoTexto: 20,
    obstaculos: [],
    medir,
    memoria: new Map(),
    camaraGirandoRapido: false,
    teto: 30,
    ...extra,
  };
}

function corpo(chave: string, x: number, y: number, extra: Partial<Candidato> = {}): Candidato {
  return {
    chave,
    nome: chave[0]!.toUpperCase() + chave.slice(1),
    abreviacao: abreviar(chave[0]!.toUpperCase() + chave.slice(1)),
    x,
    y,
    raioPx: 8,
    prioridade: 1,
    ocluido: false,
    nuncaAbreviar: false,
    papel: null,
    ...extra,
  };
}

const colidem = (a: Retangulo, b: Retangulo): boolean =>
  a.x < b.x + b.largura && a.x + a.largura > b.x && a.y < b.y + b.altura && a.y + a.altura > b.y;

describe('colocacao', () => {
  it('nenhum rotulo se sobrepoe a outro', () => {
    // Quinze corpos empilhados num quadradinho de 120 px: o caso hostil.
    const cs = Array.from({ length: 15 }, (_, i) =>
      corpo(`corpo${i}`, 600 + (i % 4) * 30, 400 + Math.floor(i / 4) * 30, { prioridade: 15 - i }),
    );
    const postos = colocar(cs, opcoes());
    for (let i = 0; i < postos.length; i++) {
      for (let j = i + 1; j < postos.length; j++) {
        expect(colidem(postos[i]!, postos[j]!), `${postos[i]!.chave} × ${postos[j]!.chave}`).toBe(false);
      }
    }
  });

  it('nenhum rotulo cai sobre a interface', () => {
    const barra: Retangulo = { x: 0, y: 0, largura: 1200, altura: 60 };
    const lateral: Retangulo = { x: 900, y: 0, largura: 300, altura: 800 };
    const cs = Array.from({ length: 12 }, (_, i) => corpo(`c${i}`, 850 + i * 12, 30 + i * 3));
    for (const r of colocar(cs, opcoes({ obstaculos: [barra, lateral] }))) {
      expect(colidem(r, barra), `${r.chave} sobre a barra`).toBe(false);
      expect(colidem(r, lateral), `${r.chave} sobre a lateral`).toBe(false);
    }
  });

  it('o que esta fora da tela nao disputa espaco', () => {
    const postos = colocar(
      [corpo('dentro', 600, 400), corpo('fora', -500, 400), corpo('longe', 5000, 400)],
      opcoes(),
    );
    expect(postos.map((p) => p.chave)).toEqual(['dentro']);
  });

  it('respeita o teto: mais nomes do que isso ninguem le', () => {
    const cs = Array.from({ length: 50 }, (_, i) => corpo(`c${i}`, 100 + i * 20, 400, { prioridade: i }));
    expect(colocar(cs, opcoes({ teto: 8 })).length).toBeLessThanOrEqual(8);
  });

  it('quem tem prioridade maior e atendido primeiro', () => {
    // Com o teto em 3, sobrevivem os tres de maior prioridade — e nao os tres
    // primeiros da lista.
    const cs = [
      corpo('baixo', 100, 100, { prioridade: 1 }),
      corpo('alto', 200, 100, { prioridade: 99 }),
      corpo('medio', 300, 100, { prioridade: 50 }),
      corpo('chao', 400, 100, { prioridade: 0 }),
    ];
    const chaves = colocar(cs, opcoes({ teto: 3 })).map((p) => p.chave);
    expect(chaves).toContain('alto');
    expect(chaves).toContain('medio');
    expect(chaves).not.toContain('chao');
  });
});

describe('a histerese', () => {
  it('sem mudanca na cena, a direcao escolhida nao muda', () => {
    // Se o colocador trocasse de lado a cada quadro, os nomes piscariam.
    const memoria = new Map<string, number>();
    const cs = [corpo('terra', 600, 400), corpo('marte', 640, 405), corpo('venus', 620, 430)];
    const o = opcoes({ memoria });
    const a = colocar(cs, o);
    const b = colocar(cs, o);
    const c = colocar(cs, o);
    expect(b.map((r) => [r.x, r.y])).toEqual(a.map((r) => [r.x, r.y]));
    expect(c.map((r) => [r.x, r.y])).toEqual(a.map((r) => [r.x, r.y]));
    expect(memoria.size, 'a memoria de direcao ficou vazia').toBeGreaterThan(0);
  });

  it('um deslocamento pequeno do corpo nao faz o nome pular de lado', () => {
    const memoria = new Map<string, number>();
    const o = opcoes({ memoria });
    const antes = colocar([corpo('terra', 600, 400), corpo('marte', 660, 402)], o);
    const depois = colocar([corpo('terra', 603, 401), corpo('marte', 663, 403)], o);
    for (let i = 0; i < antes.length; i++) {
      // O rotulo acompanha o corpo, entao a POSICAO muda; o que nao pode mudar
      // e o LADO em que ele ficou.
      const ladoAntes = Math.sign(antes[i]!.x - [600, 660][i]!);
      const ladoDepois = Math.sign(depois[i]!.x - [603, 663][i]!);
      expect(ladoDepois, antes[i]!.chave).toBe(ladoAntes);
    }
  });

  it('com a camera girando depressa, a direcao fica congelada', () => {
    // A banda morta de movimento: quem gira a camera esta olhando o
    // movimento, nao lendo nomes.
    const memoria = new Map<string, number>();
    const parada = colocar([corpo('terra', 600, 400)], opcoes({ memoria }));
    const ladoParado = Math.sign(parada[0]!.x - 600);

    // Uma configuracao em que a direcao preferida mudaria, com a camera
    // girando: a escolha anterior tem de sobreviver.
    const girando = colocar(
      [corpo('terra', 600, 400), corpo('intruso', 640, 400, { prioridade: 99 })],
      opcoes({ memoria, camaraGirandoRapido: true }),
    );
    const terra = girando.find((r) => r.chave === 'terra')!;
    expect(Math.sign(terra.x - 600)).toBe(ladoParado);
  });
});

describe('a escada de abreviacao', () => {
  it('aperta o nome so quando o inteiro nao cabe', () => {
    const solto = colocar([corpo('mercurio', 600, 400)], opcoes());
    expect(solto[0]!.forma).toBe('inteiro');
    expect(solto[0]!.texto).toBe('Mercurio');
  });

  it('o corpo selecionado nunca e abreviado', () => {
    // Se o que a pessoa acabou de escolher virasse "Mer.", a confirmacao
    // visual da escolha seria justamente a que se perde.
    const apertado = Array.from({ length: 12 }, (_, i) =>
      corpo(`corpo${i}`, 600 + (i % 3) * 8, 400 + Math.floor(i / 3) * 8, { prioridade: 1 }),
    );
    apertado.push(corpo('mercurio', 604, 404, { prioridade: 99, nuncaAbreviar: true }));
    const posto = colocar(apertado, opcoes()).find((r) => r.chave === 'mercurio')!;
    expect(posto.forma).toBe('inteiro');
  });

  it('a abreviacao cabe em quatro caracteres', () => {
    for (const nome of ['Mercúrio', 'Júpiter', 'Ganimedes', 'Encélado', 'Io', 'Lua']) {
      expect(abreviar(nome).length, nome).toBeLessThanOrEqual(4);
    }
  });
});

describe('oclusao', () => {
  it('o corpo escondido atras de outro leva a marca, e continua na lista', () => {
    // Apagar o nome seria pior: o corpo continua existindo e a pessoa
    // continua precisando saber qual e. A cena escurece a placa.
    const postos = colocar([corpo('lua', 600, 400, { ocluido: true })], opcoes());
    expect(postos.length).toBe(1);
    expect(postos[0]!.ocluido).toBe(true);
  });
});

describe('os distintivos na cena', () => {
  it('o papel atravessa a colocacao e chega na placa', () => {
    const postos = colocar(
      [
        corpo('terra', 300, 300, { papel: 'a', prioridade: 500 }),
        corpo('marte', 500, 300, { papel: 'b', prioridade: 250 }),
        corpo('jupiter', 700, 300, { papel: 'acompanhado', prioridade: 1000 }),
        corpo('venus', 900, 300),
      ],
      opcoes(),
    );
    const por = Object.fromEntries(postos.map((r) => [r.chave, r]));
    expect(por['terra']!.papel).toBe('a');
    expect(por['marte']!.papel).toBe('b');
    expect(por['jupiter']!.papel).toBe('acompanhado');
    expect(por['venus']!.papel).toBeNull();
  });

  it('o centro e o raio do corpo vao junto: o anel e desenhado por eles', () => {
    // A placa fica AO LADO do corpo; o anel tem de ficar EM VOLTA dele. Sem o
    // centro, o anel sairia no canto da placa — visivelmente errado, e so em
    // certas direcoes de colocacao.
    const [r] = colocar([corpo('jupiter', 640, 360, { raioPx: 22, papel: 'acompanhado' })], opcoes());
    expect(r!.centroX).toBe(640);
    expect(r!.centroY).toBe(360);
    expect(r!.raioPx).toBe(22);
    expect(r!.x, 'a placa deveria ficar fora do disco').toBeGreaterThan(640 + 22);
  });

  it('um corpo com papel NUNCA vira ponto: a palavra nao cabe num ponto', () => {
    // Num aperto, o colocador degrada inteiro -> abreviado -> ponto. Um ponto
    // de seis pixels nao carrega o "A" escrito, e a regra do projeto e que a
    // informacao nunca seja so a posicao ou so a cor.
    const apertado = Array.from({ length: 14 }, (_, i) =>
      corpo(`c${i}`, 400 + (i % 4) * 6, 300 + Math.floor(i / 4) * 6, { prioridade: 20 - i }),
    );
    apertado.push(corpo('terra', 404, 304, { papel: 'a', prioridade: 500 }));
    const posto = colocar(apertado, opcoes()).find((r) => r.chave === 'terra')!;
    expect(posto.forma).not.toBe('ponto');
  });
});
