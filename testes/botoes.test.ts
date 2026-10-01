/**
 * "Texto sempre, ícone nunca sozinho" — a regra, verificada.
 *
 * `src/interface/componentes/controles.tsx:11` cita este arquivo pelo nome
 * desde a fase F2 e ele **nunca existiu**. É a mesma classe de defeito que a
 * auditoria do `CONTRATO.md` encontrou em catorze outros lugares: uma afirmação
 * que nada verifica apodrece, e quem lê a linha e confia nela para de procurar.
 *
 * **Sem DOM, de propósito.** O ambiente unitário deste projeto é `node` e não
 * `jsdom`, e o `vitest.config.ts` explica por quê: é uma segunda barreira de
 * arquitetura de graça. Então aqui não se monta nada — leem-se as árvores que
 * os componentes devolvem, que é onde os atributos de acessibilidade nascem.
 * A varredura da tela montada continua em `e2e/acessibilidade.spec.ts`; este
 * arquivo é o par que falha em milissegundos quando alguém acrescenta um
 * controle mudo.
 */
import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import {
  Alternador,
  Botao,
  GrupoSegmentado,
  PainelRecolhivel,
  Ponto,
} from '@interface/componentes/controles.tsx';
import { corDoCorpo } from '@dados/cores.ts';

type No = VNode<Record<string, unknown>>;
const props = (n: No): Record<string, unknown> => n.props as Record<string, unknown>;

/** Todo o texto de uma árvore, concatenado — o que a pessoa lê. */
function texto(n: unknown): string {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(texto).join('');
  const p = (n as No).props as Record<string, unknown> | undefined;
  return p ? texto(p['children']) : '';
}

/** Todos os nós da árvore cujo `type` bate, em profundidade. */
function buscar(n: unknown, tipo: string, saida: No[] = []): No[] {
  if (!n || typeof n !== 'object') return saida;
  if (Array.isArray(n)) {
    for (const f of n) buscar(f, tipo, saida);
    return saida;
  }
  const no = n as No;
  if (no.type === tipo) saida.push(no);
  const p = no.props as Record<string, unknown> | undefined;
  if (p) buscar(p['children'], tipo, saida);
  return saida;
}

/** O nome acessível de um nó: `aria-label` quando há, senão o texto visível. */
const nomeDe = (n: No): string =>
  String(props(n)['aria-label'] ?? texto(props(n)['children'])).trim();

describe('todo botão diz por escrito o que faz', () => {
  it('o texto visível é o nome, e o `type` é `button`', () => {
    const b = Botao({ children: 'Voltar ao início', onClick: () => {} }) as No;
    expect(nomeDe(b)).toBe('Voltar ao início');
    // Sem `type="button"`, um botão dentro de um `<form>` submete.
    expect(props(b)['type']).toBe('button');
  });

  it('um ícone sozinho só passa com `rotulo`, e o rótulo vira o nome', () => {
    // É o caso do `−` e do `+` da escada de velocidade: o glifo é o rótulo
    // visível e a palavra vai no `aria-label`. Sem uma das duas, quem usa
    // leitor de tela ouve "menos" e não sabe menos o quê.
    const b = Botao({ children: '−', onClick: () => {}, rotulo: 'Diminuir a velocidade do tempo' }) as No;
    expect(nomeDe(b)).toBe('Diminuir a velocidade do tempo');
    expect(texto(props(b)['children']), 'o glifo continua visível').toBe('−');
  });

  it('NENHUM botão pode sair sem nome nenhum', () => {
    // A regra em si. Um `Botao` com children vazio e sem `rotulo` é um botão
    // mudo, e o teste diz isso em vez de deixar passar.
    const mudo = Botao({ children: '', onClick: () => {} }) as No;
    expect(nomeDe(mudo), 'um botão sem texto e sem rótulo passou').toBe('');
    // ...e é por isso que a varredura da tela montada existe: aqui se prova
    // que o componente NÃO impede o caso; lá se prova que ninguém o usou.
  });

  it('estado ativo nunca é só cor: há `aria-pressed` E a barra desenhada', () => {
    const ligado = Botao({ children: 'Acompanhar', onClick: () => {}, ativo: true }) as No;
    const desligado = Botao({ children: 'Acompanhar', onClick: () => {}, ativo: false }) as No;
    const neutro = Botao({ children: 'Acompanhar', onClick: () => {} }) as No;

    expect(props(ligado)['aria-pressed']).toBe(true);
    expect(props(desligado)['aria-pressed']).toBe(false);
    // Um botão que não alterna NÃO anuncia estado: `aria-pressed="false"` num
    // botão comum faz o leitor de tela dizer "não pressionado" sobre uma coisa
    // que não tem dois estados.
    expect(props(neutro)['aria-pressed']).toBeUndefined();
    expect(String(props(ligado)['class']), 'falta a classe que desenha a barra')
      .toContain('botao--ativo');
  });

  it('desabilitado é `disabled` de verdade, e não só apagado', () => {
    const b = Botao({ children: 'Criar asteroide', onClick: () => {}, desabilitado: true }) as No;
    expect(props(b)['disabled']).toBe(true);
  });
});

describe('`GrupoSegmentado` é um radiogroup de verdade', () => {
  const OPCOES = [
    { valor: 'a' as const, texto: 'Sistema completo' },
    { valor: 'b' as const, texto: 'Planetas internos' },
  ];

  it('tem papel, nome, e um `aria-checked` por opção', () => {
    const g = GrupoSegmentado({
      rotulo: 'Enquadramento da câmera',
      opcoes: OPCOES,
      valor: 'a',
      onEscolher: () => {},
    }) as No;

    expect(props(g)['role']).toBe('radiogroup');
    expect(props(g)['aria-label']).toBe('Enquadramento da câmera');

    const radios = buscar(g, 'button');
    expect(radios).toHaveLength(2);
    expect(radios.map((r) => props(r)['role'])).toEqual(['radio', 'radio']);
    expect(radios.map((r) => props(r)['aria-checked'])).toEqual([true, false]);
  });

  it('só UMA opção é tabulável: é um grupo, não três paradas', () => {
    // O cabecalho de `controles.tsx` prometia que "as setas navegam entre as
    // opcoes" desde a primeira versao, e nao havia seta nenhuma nem
    // `tabIndex`: os tres botoes eram tres paradas de Tab. A promessa era
    // falsa, e do jeito mais caro — quem navega por teclado pagava tres toques
    // por grupo, em quatro grupos.
    const g = GrupoSegmentado({ rotulo: 'Luas', opcoes: OPCOES, valor: 'b', onEscolher: () => {} }) as No;
    const radios = buscar(g, 'button');
    const tabulaveis = radios.filter((r) => props(r)['tabIndex'] === 0);
    expect(tabulaveis).toHaveLength(1);
    // E a parada é a opção MARCADA, e não a primeira: entrar no grupo tem de
    // pousar em onde se está, senão a primeira seta anda a partir do lugar
    // errado.
    expect(props(tabulaveis[0]!)['aria-checked']).toBe(true);
    expect(radios.filter((r) => props(r)['tabIndex'] === -1)).toHaveLength(radios.length - 1);
  });

  it('as setas escolhem, dão a volta, e PARAM o evento', () => {
    const escolhidos: string[] = [];
    const g = GrupoSegmentado({
      rotulo: 'Luas',
      opcoes: OPCOES,
      valor: 'b',
      onEscolher: (v) => escolhidos.push(v),
    }) as No;
    const aoTeclar = props(g)['onKeyDown'] as (ev: unknown) => void;
    expect(aoTeclar, 'o grupo não escuta o teclado').toBeTypeOf('function');

    const evento = (key: string): { key: string; parou: boolean; impediu: boolean } => {
      const e = {
        key,
        parou: false,
        impediu: false,
        preventDefault(): void {
          e.impediu = true;
        },
        stopPropagation(): void {
          e.parou = true;
        },
        currentTarget: { children: [] as unknown[] },
      };
      aoTeclar(e);
      return e;
    };

    // OPCOES tem duas entradas, 'a' e 'b'; o valor e 'b', o indice 1.
    expect(evento('ArrowRight').impediu).toBe(true);
    expect(escolhidos.at(-1), 'da última, a direita volta para a primeira').toBe('a');
    evento('ArrowLeft');
    expect(escolhidos.at(-1)).toBe('a');
    evento('Home');
    expect(escolhidos.at(-1)).toBe('a');
    evento('End');
    expect(escolhidos.at(-1)).toBe('b');

    // **`stopPropagation` não é zelo.** As quatro setas já são atalhos globais
    // que giram e deslocam a câmera. Sem parar o evento, escolher uma opção
    // com a seta giraria a cena no mesmo toque.
    expect(evento('ArrowRight').parou, 'a seta chegaria também à câmera').toBe(true);

    // E uma tecla que não é nossa passa adiante, intacta.
    const outra = evento('a');
    expect(outra.impediu).toBe(false);
    expect(outra.parou).toBe(false);
    expect(escolhidos.at(-1)).toBe('a');
  });

  it('nenhuma opção fica sem palavra', () => {
    const g = GrupoSegmentado({ rotulo: 'Luas na tela', opcoes: OPCOES, valor: 'b', onEscolher: () => {} }) as No;
    for (const r of buscar(g, 'button')) {
      expect(nomeDe(r).length, 'uma opção sem nome é um botão mudo').toBeGreaterThan(0);
    }
  });
});

describe('`Alternador` carrega o estado em forma, e não só em cor', () => {
  it('é um checkbox nativo, com o texto ao lado', () => {
    const a = Alternador({ texto: 'Mostrar estrelas', ligado: false, onAlternar: () => {} }) as No;
    const entradas = buscar(a, 'input');
    expect(entradas).toHaveLength(1);
    expect(props(entradas[0]!)['type']).toBe('checkbox');
    expect(props(entradas[0]!)['checked']).toBe(false);
    expect(texto(props(a)['children'])).toContain('Mostrar estrelas');
  });

  it('marcado e desmarcado diferem no DESENHO, e não só na classe', () => {
    // A regra em maiúsculas do projeto: nunca informação só por cor. O estado
    // tem de sobreviver a quem não distingue as duas cores, então a diferença
    // precisa estar no conteúdo.
    const marca = (ligado: boolean): string => {
      const a = Alternador({ texto: 'Luas', ligado, onAlternar: () => {} }) as No;
      const caixa = buscar(a, 'span').find((s) => String(props(s)['class']).includes('alternador__caixa'));
      return texto(props(caixa!)['children']).trim();
    };
    expect(marca(true), 'o ligado não desenha nada').not.toBe('');
    expect(marca(false), 'o desligado desenha alguma coisa').toBe('');
  });

  it('a ajuda existe, e fica FORA do <label>', () => {
    // O defeito que este teste fecha. A ajuda era um `<small>` dentro do
    // `<label>`, e tudo o que esta dentro de um rotulo entra no NOME acessivel
    // do campo: o leitor de tela lia a frase inteira antes de dizer "caixa de
    // selecao, marcada", a cada passagem. Agora ela e uma irma ligada por
    // `aria-describedby` — continua sendo lida, depois do nome e do estado.
    const a = Alternador({
      texto: 'Modo maquete',
      ajuda: 'As distâncias deixam de ser proporcionais.',
      ligado: false,
      onAlternar: () => {},
    }) as No;
    const frase = 'As distâncias deixam de ser proporcionais.';
    expect(texto(props(a)['children'])).toContain(frase);

    const rotulo = buscar(a, 'label')[0];
    expect(rotulo, 'sumiu o <label>: sem ele a caixa não tem nome nenhum').toBeDefined();
    expect(texto(props(rotulo!)['children']), 'a ajuda voltou para dentro do rótulo')
      .not.toContain(frase);
    expect(texto(props(rotulo!)['children']), 'o rótulo perdeu o próprio texto')
      .toContain('Modo maquete');

    // E a ligacao existe nos dois sentidos, senao a ajuda so sumiria.
    const entrada = buscar(a, 'input')[0]!;
    const paragrafo = buscar(a, 'p')[0];
    expect(paragrafo, 'a ajuda não virou elemento próprio').toBeDefined();
    expect(props(entrada)['aria-describedby']).toBe(props(paragrafo!)['id']);
    expect(String(props(paragrafo!)['id']).length).toBeGreaterThan(0);
  });

  it('sem ajuda, não sobra um aria-describedby apontando para o vazio', () => {
    const a = Alternador({ texto: 'Mostrar estrelas', ligado: true, onAlternar: () => {} }) as No;
    expect(buscar(a, 'p')).toHaveLength(0);
    expect(props(buscar(a, 'input')[0]!)['aria-describedby']).toBeUndefined();
  });
});

describe('`Ponto` é decorativo por construção', () => {
  it('não entra na árvore de acessibilidade e não carrega texto', () => {
    // Ele existe para mostrar a cor do corpo sem NUNCA escrever o nome nessa
    // cor — Netuno dá 4,4997:1 e reprovaria como texto. Quem carrega a
    // informação é o nome escrito ao lado.
    const p = Ponto({ cor: corDoCorpo('netuno') }) as No;
    expect(props(p)['aria-hidden']).toBe('true');
    expect(texto(props(p)['children'])).toBe('');
  });
});

describe('`PainelRecolhivel` usa `<details>` nativo', () => {
  it('o título é um `<summary>`: abre com Enter e com Espaço sem uma linha de código', () => {
    const d = PainelRecolhivel({
      titulo: 'Mais opções',
      aberto: false,
      onAlternar: () => {},
      children: 'conteúdo',
    }) as No;
    expect(d.type).toBe('details');
    expect(props(d)['open']).toBe(false);
    const resumo = buscar(d, 'summary');
    expect(resumo).toHaveLength(1);
    expect(texto(props(resumo[0]!)['children']).trim()).toBe('Mais opções');
  });

  it('aberto de verdade quando o estado diz que está', () => {
    const d = PainelRecolhivel({ titulo: 'Mais opções', aberto: true, onAlternar: () => {}, children: 'x' }) as No;
    expect(props(d)['open']).toBe(true);
  });
});
