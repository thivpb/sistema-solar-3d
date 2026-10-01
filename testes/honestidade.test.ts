/**
 * O texto de honestidade nao pode ficar a frente do codigo.
 *
 * Uma auditoria do CONTRATO.md encontrou o defeito em duas direcoes ao mesmo
 * tempo, e as duas sao igualmente graves:
 *
 *   - **Licenca declarada e nao tomada.** O bloco "o que a tela simplifica"
 *     declarava a compressao de distancias do modo maquete, e um
 *     `grep escalaVisual src/cena` nao devolvia uma linha. O programa afirmava
 *     ao usuario uma liberdade que nao tinha tomado.
 *   - **Licenca tomada e nao declarada.** E o defeito simetrico, e o unico que
 *     o projeto ja vigiava.
 *
 * `textos.test.ts` prova que os blocos EXISTEM e sao substanciais;
 * `conteudo.spec.ts` prova que eles CHEGAM a tela. Nenhum dos dois pergunta se
 * o que esta escrito e VERDADE. Este arquivo pergunta.
 *
 * O metodo e grosseiro de proposito: cada afirmacao do texto e amarrada a um
 * fato verificavel no codigo-fonte. Nao prova que a implementacao esta certa —
 * para isso ha os outros testes —, mas prova que ela EXISTE e esta ligada. Era
 * exatamente isso que faltava.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HONESTIDADE } from '@dados/textos.ts';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const ler = (caminho: string): string =>
  existsSync(raiz + caminho) ? readFileSync(raiz + caminho, 'utf8') : '';

interface Amarra {
  /** O que o texto afirma. */
  afirma: RegExp;
  /** Onde esta o bloco. */
  bloco: keyof typeof HONESTIDADE;
  /** Cada par: um arquivo que tem de existir e um trecho que tem de estar nele. */
  exige: { arquivo: string; contem: RegExp; porque: string }[];
}

/**
 * Se a afirmacao estiver no texto, as exigencias tem de valer. Se a afirmacao
 * NAO estiver, o caso e pulado — assim retirar uma licenca do texto porque ela
 * saiu do codigo e uma operacao simetrica, e nao uma briga com o teste.
 */
const AMARRAS: Amarra[] = [
  {
    bloco: 'simplifica',
    afirma: /O lado noturno não é preto/,
    exige: [
      {
        arquivo: 'src/cena/iluminacao/modeloDeLuz.ts',
        contem: /export const PISO_DO_LADO_NOTURNO/,
        porque: 'o piso que o texto declara precisa existir como valor nomeado',
      },
      {
        arquivo: 'src/cena/iluminacao/modeloDeLuz.ts',
        contem: /comPisoNoturno\(luz\)/,
        porque: 'e precisa ser aplicado na cor da superficie, e nao so declarado',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /A rotação desenhada tem um teto/,
    exige: [
      {
        arquivo: 'src/cena/corpos/giroVisivel.ts',
        contem: /export function amortecimentoDoGiro/,
        porque: 'o teto que o texto declara precisa existir',
      },
      {
        arquivo: 'src/cena/corpos/fabrica.ts',
        contem: /amortecimentoDoGiro\(deltaW, raioEmPixels\)/,
        porque: 'e precisa ser aplicado ao meridiano desenhado',
      },
      {
        arquivo: 'src/cena/corpos/orientacao.ts',
        contem: /deslocamentoDoMeridiano/,
        porque: 'o atraso entra por um deslocamento de W, que e o que o texto descreve',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /mosaicos de imageamento real/,
    exige: [
      {
        arquivo: 'src/dados/texturas.json',
        contem: /"corpo": "ganimedes"/,
        porque: 'a afirmacao so vale se os mapas das luas estiverem mesmo no manifesto',
      },
      {
        arquivo: 'src/dados/texturas.json',
        contem: /USGS Astrogeology/,
        porque: 'a fonte citada no texto tem de ser a fonte gravada',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /meridiano zero como o que\n.*encara o planeta|meridiano zero como o que encara o planeta/,
    exige: [
      {
        arquivo: 'src/nucleo/planoDeReferencia.ts',
        contem: /export function meridianoQueEncaraOPai/,
        porque: 'a derivacao que o texto descreve precisa existir',
      },
      {
        arquivo: 'src/dados/corposVisuais.ts',
        contem: /meridianoQueEncaraOPai\(/,
        porque: 'e a ficha visual de cada lua que tem de usa-la',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /desenhados maiores que o tamanho real/,
    exige: [
      {
        arquivo: 'src/cena/escala/exageroDeTamanho.ts',
        contem: /export function raioDesenhadoUa/,
        porque: 'o exagero de raio precisa existir para ser declarado',
      },
      {
        arquivo: 'src/cena/cena.ts',
        contem: /raioDesenhadoUa\(/,
        porque: 'e a cena que tem de aplica-lo',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /o desenho interpola a posição/,
    exige: [
      {
        arquivo: 'src/nucleo/amostragem.ts',
        contem: /hermite|Hermite/,
        porque: 'a interpolacao entre passos e o que o texto descreve',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /halo de ar no limbo/,
    exige: [
      {
        arquivo: 'src/cena/corpos/fabrica.ts',
        contem: /function montarAtmosfera/,
        porque: 'a casca de atmosfera precisa existir para ser declarada',
      },
      {
        arquivo: 'src/cena/corpos/fabrica.ts',
        contem: /montarAtmosfera\(visual, uniformes\)/,
        porque: 'e precisa ser pendurada no corpo, e nao so definida',
      },
      {
        arquivo: 'src/dados/corposVisuais.ts',
        contem: /export interface Atmosfera/,
        porque: 'a altura e a cor de cada uma sao dado, com procedencia escrita',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /coroa do Sol é desenho/,
    exige: [
      {
        arquivo: 'src/cena/corpos/fabrica.ts',
        contem: /export function montarCoroa/,
        porque: 'a coroa precisa existir para ser declarada',
      },
      {
        arquivo: 'src/cena/cena.ts',
        contem: /montarCoroa\(\)/,
        porque: 'e precisa entrar na cena',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /exposição automática/,
    exige: [
      {
        arquivo: 'src/cena/cena.ts',
        contem: /exposicaoSuave/,
        porque: 'a exposicao automatica precisa existir na cena',
      },
      {
        arquivo: 'src/interface/componentes/Visor.tsx',
        contem: /exposição ×/,
        porque: 'o texto promete que o fator aparece escrito',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /"Modo maquete" ligado, as distâncias desenhadas deixam de ser proporcionais/,
    exige: [
      {
        arquivo: 'src/cena/escala/escalaVisual.ts',
        contem: /export function comprimirRaio/,
        porque: 'declarar a compressao sem comprimir e afirmar uma licenca nao tomada',
      },
      {
        arquivo: 'src/cena/cena.ts',
        contem: /comprimirBuffer\(/,
        porque: 'a cena tem de aplicar a compressao, e nao so conhece-la',
      },
      {
        arquivo: 'src/cena/linhas/fitas.ts',
        contem: /comprimirRelativos\(/,
        porque: 'orbitas nao comprimidas deixariam os planetas fora delas',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /A iluminação e a geometria continuam usando as distâncias reais/,
    exige: [
      {
        arquivo: 'src/cena/cena.ts',
        contem: /Distancia REAL ao Sol/,
        porque: 'a luz tem de medir a distancia real, e nao a desenhada',
      },
    ],
  },
  {
    bloco: 'simplifica',
    afirma: /As luas não são integradas/,
    exige: [
      {
        arquivo: 'src/dados/luas.ts',
        contem: /export const LUAS/,
        porque: 'o texto so pode falar das luas quando elas existirem',
      },
      {
        arquivo: 'src/nucleo/kepler.ts',
        contem: /export function estadoDeElementos/,
        porque: 'a propagacao cinematica e o que o texto descreve',
      },
    ],
  },
  {
    bloco: 'naoInclui',
    afirma: /As luas aparecem desenhadas/,
    exige: [
      {
        arquivo: 'src/dados/luas.ts',
        contem: /export const LUAS/,
        porque: 'afirmar que as luas aparecem sem elas existirem e o mesmo defeito do modo maquete',
      },
    ],
  },
  {
    bloco: 'naoInclui',
    afirma: /dá para criar um/,
    exige: [
      {
        arquivo: 'src/dados/predefinicoes.ts',
        contem: /export const RECEITAS/,
        porque: 'so vale falar em criar corpos se der para criar corpos',
      },
      {
        arquivo: 'src/app/sistemaVivo.ts',
        contem: /export function criarSistemaVivo/,
        porque: 'e o modulo que de fato muda o sistema',
      },
    ],
  },
  {
    bloco: 'naoInclui',
    afirma: /Colisões não existem/,
    exige: [
      {
        arquivo: 'src/nucleo/guardas.ts',
        contem: /export function separacaoMinima/,
        porque:
          'a distancia minima e a consequencia de nao haver colisao; declarar uma sem a outra ' +
          'deixaria a frase pela metade',
      },
    ],
  },
  {
    bloco: 'naoInclui',
    afirma: /A relatividade geral também não/,
    exige: [
      {
        arquivo: 'src/nucleo/forcas.ts',
        contem: /^(?!.*relativ).*$/s,
        porque: 'so vale dizer que nao inclui enquanto de fato nao incluir',
      },
    ],
  },
];

/**
 * A amarra vale nos DOIS sentidos, e essa e a coisa toda.
 *
 * Verificar so "declarou, entao implementou" deixaria passar o defeito
 * simetrico — tomar a licenca e nao contar —, que e o unico que o projeto ja
 * vigiava por disciplina humana. Verificar so o contrario deixaria passar o
 * defeito que a auditoria encontrou. Aqui as duas direcoes saem da mesma
 * tabela, entao nao ha como consertar uma e esquecer a outra.
 */
describe('texto e codigo dizem a mesma coisa, nos dois sentidos', () => {
  for (const amarra of AMARRAS) {
    const declarada = amarra.afirma.test(HONESTIDADE[amarra.bloco].texto);
    const faltando = amarra.exige.filter((e) => !amarra.afirma.test('') && !ler(e.arquivo).match(e.contem));
    const implementada = faltando.length === 0;
    const nome = amarra.afirma.source.slice(0, 46);

    it(`${nome}`, () => {
      if (declarada && !implementada) {
        expect.fail(
          `O texto declara "${nome}" e o código não faz:\n  ` +
            faltando.map((e) => `${e.arquivo} — ${e.porque}`).join('\n  ') +
            '\nDeclarar uma licença que não se toma é o mesmo defeito que não declarar a que se toma.',
        );
      }
      if (implementada && !declarada) {
        expect.fail(
          `O código faz "${nome}" e o texto não declara.\n` +
            'Toda licença visual ganha entrada nomeada no bloco "o que a tela simplifica".',
        );
      }
      expect(declarada).toBe(implementada);
    });
  }

  it('a lista de amarras nao ficou vazia nem inteira em branco', () => {
    // Uma suite em que nenhuma afirmacao esta declarada passaria verde sem
    // medir nada. Pelo menos a metade das licencas tem de estar no texto.
    const declaradas = AMARRAS.filter((a) => a.afirma.test(HONESTIDADE[a.bloco].texto));
    expect(declaradas.length, 'nenhuma licenca esta declarada no texto').toBeGreaterThan(
      AMARRAS.length / 2,
    );
  });
});
