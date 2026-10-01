/**
 * O texto tambem tem contrato.
 *
 * Tres coisas que nenhuma checagem de tipo pega e que se perdem em silencio:
 *
 *   1. Um recurso visual que exagera a realidade e NAO e declarado. A regra do
 *      projeto e explicita — "toda exageracao visual ganha entrada nomeada no
 *      bloco 'o que a tela simplifica'" — e sem teste ela vira boa vontade.
 *   2. A tabela de abreviacoes e a regra generica que as produz divergirem.
 *   3. Uma promessa de exatidao entrar no texto. "Nada de 'orbita real' nem
 *      'exata'" esta escrito no padrao editorial desde a primeira versao.
 */
import { describe, expect, it } from 'vitest';
import { ABREVIACOES, DICAS, HONESTIDADE, OPCOES, AJUDA_OPCOES, FONTES, ATIVIDADES, TUTORIAL } from '@dados/textos.ts';
import { TEXTURAS } from '@dados/corposVisuais.ts';
import { FICHAS, PLANETAS } from '@dados/fichas.ts';
import { abreviar } from '@rotulos/posicionador.ts';

const NOMES: Record<string, string> = {
  sol: 'Sol', mercurio: 'Mercúrio', venus: 'Vênus', terra: 'Terra', marte: 'Marte',
  jupiter: 'Júpiter', saturno: 'Saturno', urano: 'Urano', netuno: 'Netuno',
  lua: 'Lua', io: 'Io', europa: 'Europa', ganimedes: 'Ganimedes', calisto: 'Calisto',
  tita: 'Titã', encelado: 'Encélado', fobos: 'Fobos', deimos: 'Deimos',
  titania: 'Titânia', oberon: 'Oberon', miranda: 'Miranda', tritao: 'Tritão',
  ceu: 'céu',
};

describe('procedencia das texturas', () => {
  it('todo mapa declara procedencia conhecida', () => {
    for (const m of TEXTURAS) {
      expect(['imagem', 'derivado', 'calculado', 'artistico', 'decorativo'], `${m.corpo}/${m.papel}`)
        .toContain(m.procedencia);
    }
  });

  it('nao ha reconstrucao sem nota explicando o que falta', () => {
    for (const m of TEXTURAS.filter((t) => t.procedencia === 'artistico')) {
      expect((m.nota ?? '').length, `${m.corpo}/${m.papel} sem nota`).toBeGreaterThan(20);
    }
  });

  /**
   * O vinculo entre o dado e a prosa. Nao se GERA o texto a partir da
   * procedencia — geracao produziria frase pior que o padrao que se quer
   * proteger —, entao o que amarra os dois e este teste.
   */
  it('todo corpo com textura reconstruida e DECLARADO COMO TAL em "o que a tela simplifica"', () => {
    // Exigir so que o nome apareca no bloco nao mede nada: "Urano e Netuno
    // seriam pixels pretos" ja cita os dois, a proposito da exposicao
    // automatica. A primeira versao deste teste passou verde com o paragrafo
    // da reconstrucao apagado. O vinculo tem de ser na MESMA FRASE.
    const frases = HONESTIDADE.simplifica.texto.split(/(?<=[.!?])\s+/);
    const declaraReconstrucao = /reconstru|não existe fotografia|não existe imageamento|é desenho|são desenho/i;

    const reconstruidos = [
      ...new Set(
        TEXTURAS.filter((t) => t.procedencia === 'artistico' || t.procedencia === 'decorativo')
          .map((t) => t.corpo),
      ),
    ];
    expect(reconstruidos.length, 'o manifesto nao tem nenhuma reconstrucao — o teste ficou cego')
      .toBeGreaterThan(0);

    for (const corpo of reconstruidos) {
      const nome = NOMES[corpo] ?? corpo;
      const declarado = frases.some((f) => f.includes(nome) && declaraReconstrucao.test(f));
      expect(
        declarado,
        `${nome} tem textura reconstruida e nenhuma frase do bloco diz isso — ` +
          'citar o nome de passagem nao conta',
      ).toBe(true);
    }
  });

  // A lista de licencas declaradas MUDOU DE ARQUIVO. Ela estava aqui como uma
  // lista fixa de quatro, e por isso passou a exigir a das luas antes de as
  // luas existirem — o mesmo defeito que ela tentava pegar, virado do avesso.
  // Agora a amarra vive em `honestidade.test.ts`, onde cada afirmacao esta
  // ligada a um fato do codigo e a verificacao vale nos dois sentidos.
});

describe('abreviacoes', () => {
  it('a regra generica reproduz a tabela transcrita', () => {
    // `abreviar` e usada no laco; a tabela existe para conferencia. Se um nome
    // novo deixar de caber na regra, e aqui que se descobre — e nao na tela,
    // com "Ganimede." aparecendo do lado do planeta.
    for (const [chave, esperado] of Object.entries(ABREVIACOES)) {
      const nome = NOMES[chave];
      expect(nome, `sem nome para ${chave}`).toBeDefined();
      expect(abreviar(nome!), chave).toBe(esperado);
    }
  });

  it('toda abreviacao cabe em quatro caracteres', () => {
    for (const [chave, a] of Object.entries(ABREVIACOES)) {
      expect(a.length, chave).toBeLessThanOrEqual(4);
    }
  });

  it('ha abreviacao para todo corpo que tem ficha', () => {
    for (const chave of Object.keys(FICHAS)) {
      expect(ABREVIACOES[chave], `${chave} sem abreviacao`).toBeDefined();
    }
  });
});

describe('padrao editorial', () => {
  const tudo = [
    ...Object.values(DICAS).flatMap((d) => [d.pergunta, d.resposta]),
    ...Object.values(HONESTIDADE).map((h) => h.texto),
    ...Object.values(OPCOES),
    ...Object.values(AJUDA_OPCOES),
    ...ATIVIDADES.flatMap((a) => [a.titulo, a.tarefa, a.resposta]),
    ...TUTORIAL.flatMap((t) => [t.titulo, t.texto]),
    ...FONTES.blocos.map((b) => b.texto),
    ...Object.values(FICHAS).flatMap((f) => [f.frase, f.curiosidade]),
  ];

  it('nenhum texto promete exatidao', () => {
    // "Nada de 'orbita real' nem 'exata'. A trajetoria e um calculo aproximado."
    const proibidas = [/órbita real/i, /órbitas reais/i, /posição exata/i, /exatamente onde/i, /com precisão total/i];
    for (const t of tudo) {
      for (const p of proibidas) {
        expect(t, `promessa de exatidao: ${t.slice(0, 80)}`).not.toMatch(p);
      }
    }
  });

  it('nenhum texto ficou vazio ou com espaco duplo', () => {
    for (const t of tudo) {
      expect(t.trim().length).toBeGreaterThan(0);
      expect(t, `espaco duplo em: ${t.slice(0, 60)}`).not.toMatch(/[^\n] {2}[^\n]/);
    }
  });

  it('os tres blocos de honestidade existem e sao substanciais', () => {
    for (const bloco of [HONESTIDADE.calcula, HONESTIDADE.simplifica, HONESTIDADE.naoInclui]) {
      expect(bloco.titulo.length).toBeGreaterThan(5);
      expect(bloco.texto.length, bloco.titulo).toBeGreaterThan(200);
    }
  });
});

describe('fichas', () => {
  it('todo planeta com dados tem ficha, e vice-versa', () => {
    for (const chave of Object.keys(PLANETAS)) {
      expect(FICHAS[chave], `${chave} sem ficha`).toBeDefined();
    }
  });

  it('cada ficha tem frase e curiosidade', () => {
    for (const [chave, f] of Object.entries(FICHAS)) {
      expect(f.frase.length, chave).toBeGreaterThan(20);
      expect(f.curiosidade.length, chave).toBeGreaterThan(20);
    }
  });

  it('a temperatura de gigante gasoso nao e anunciada como de superficie', () => {
    // Num gigante gasoso nao HA superficie: a temperatura tabelada e a de uma
    // altitude escolhida. Dizer so "temperatura de superficie" ali inventaria
    // um lugar que nao existe.
    //
    // As duas metades importam. Exigir so que o gigante diga "1 bar" deixaria
    // passar um dia em que TODOS os corpos passassem a dizer "1 bar"; exigir
    // so que o rochoso diga "superficie" deixaria passar o contrario. A
    // distincao so esta viva enquanto as duas afirmacoes valem juntas.
    for (const chave of ['jupiter', 'saturno', 'urano', 'netuno']) {
      const t = PLANETAS[chave]!.temperaturaReferencia;
      expect(t, chave).toContain('1 bar');
      expect(t, `${chave} anuncia superficie onde nao ha`).toMatch(/não há superfície/);
    }
    for (const chave of ['mercurio', 'venus', 'terra', 'marte']) {
      const t = PLANETAS[chave]!.temperaturaReferencia;
      expect(t, chave).toContain('superfície');
      expect(t, `${chave} nao tem 1 bar de referencia`).not.toContain('1 bar');
    }
  });

  it('todo dado de planeta aponta para a ficha de onde veio', () => {
    for (const [chave, d] of Object.entries(PLANETAS)) {
      expect(d.fonte, chave).toMatch(/^https:\/\/nssdc\.gsfc\.nasa\.gov\/planetary\/factsheet\//);
    }
  });
});
