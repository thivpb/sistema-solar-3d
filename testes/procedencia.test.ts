/**
 * **Sem procedência, não grava.**
 *
 * É a regra que o plano fixou para todo bloco de dados, e a única que até agora
 * dependia de disciplina humana: os cinco arquivos de `src/dados/` foram
 * escritos com procedência porque quem os escreveu lembrou de escrevê-la, e não
 * porque alguma coisa reprovaria um sexto arquivo sem ela.
 *
 * O que se exige de cada arquivo:
 *   · **quem** — uma `fonte` nomeada, e não "a internet";
 *   · **onde** — uma `url`, quando a fonte é consultável (uma tabela impressa
 *     transcrita não tem, e diz por quê);
 *   · **quando** — uma data, porque uma tabela da NASA de 2025 e uma de 2030
 *     são documentos diferentes e nada no número avisa;
 *   · **o quê** — uma nota que diga o que foi feito com o dado, quando ele foi
 *     transformado. Alfa não é profundidade óptica, e a conversão precisa estar
 *     escrita ao lado do número que ela produziu.
 *
 * O teste é deliberadamente ESTRUTURAL: ele não sabe se a URL responde nem se o
 * número está certo — para isso há a validação contra o Horizons. Ele sabe
 * dizer que ninguém gravou um dado órfão, que é o defeito que aparece meses
 * depois, quando já não há como reconstituir de onde o número veio.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pasta = fileURLToPath(new URL('../src/dados/', import.meta.url));
const ler = (nome: string): Record<string, unknown> =>
  JSON.parse(readFileSync(pasta + nome, 'utf8')) as Record<string, unknown>;

const ARQUIVOS = readdirSync(pasta)
  .filter((n) => n.endsWith('.json'))
  .sort();

/** Uma data ISO, ou um dia/mês/ano por extenso. */
const DATA = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/;
const URL_HTTP = /^https?:\/\/\S+$/;

/** Todo texto do objeto, recursivamente. Serve para procurar data e URL. */
function textos(o: unknown, saida: string[] = []): string[] {
  if (typeof o === 'string') saida.push(o);
  else if (Array.isArray(o)) for (const v of o) textos(v, saida);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) textos(v, saida);
  return saida;
}

describe('procedência dos dados', () => {
  it('há arquivos para conferir — senão este teste não mede nada', () => {
    expect(ARQUIVOS.length).toBeGreaterThanOrEqual(5);
  });

  for (const nome of ARQUIVOS) {
    describe(nome, () => {
      const d = ler(nome);
      const todo = textos(d);

      it('diz quem o gerou, e que não se edita à mão', () => {
        // `_leia_isto` é a primeira chave de todos os cinco, e é ela que impede
        // alguém de corrigir um número no arquivo em vez de na ferramenta — o
        // que faria o arquivo e o gerador discordarem sem aviso.
        expect(typeof d['_leia_isto'], 'falta `_leia_isto`').toBe('string');
        expect(String(d['_leia_isto'])).toMatch(/ferramentas\/\S+/);
        expect(String(d['_leia_isto']).toLowerCase()).toContain('nao edite');
      });

      it('diz QUANDO foi consultado ou gerado', () => {
        const quando = d['gerado_em'] ?? d['consultado_em'] ?? null;
        const emAlgumLugar = todo.some((t) => DATA.test(t));
        expect(
          typeof quando === 'string' ? DATA.test(quando) : emAlgumLugar,
          'nenhuma data em lugar nenhum: não dá para saber de que edição da tabela o número veio',
        ).toBe(true);
      });

      it('diz QUEM é a fonte, por nome', () => {
        // Aceita `fonte` no topo, `fontes`, ou dentro de `procedencia` — os três
        // formatos que os arquivos de hoje usam. O que não se aceita é nenhum.
        const candidatos = [d['fonte'], d['fontes'], d['procedencia'], d['credito_obrigatorio']];
        const temAlgum = candidatos.some((c) => c !== undefined && c !== null);
        expect(temAlgum, 'nenhuma fonte declarada').toBe(true);

        // E ela é um nome, não uma palavra vazia. Quinze caracteres reprovam
        // "NASA" sozinho e aprovam "JPL Horizons API (ssd.jpl.nasa.gov/...)".
        const nomeados = textos(candidatos).filter((t) => t.length >= 15);
        expect(nomeados.length, `fontes nomeadas em ${nome}: ${textos(candidatos).join(' | ')}`)
          .toBeGreaterThan(0);
      });

      it('diz ONDE, por URL — ou por que não há uma', () => {
        const temUrl = todo.some((t) => URL_HTTP.test(t.trim()));
        // Uma transcrição de tabela impressa não tem URL do dado; ela tem de
        // dizer isso com todas as letras. É a mesma exigência de `artistico`
        // nas texturas: a ausência é declarada, não presumida.
        const declaraTranscricao = todo.some((t) => /transcri|impress|sem url/i.test(t));
        expect(temUrl || declaraTranscricao, 'nem URL nem declaração de transcrição').toBe(true);
      });
    });
  }

  it('cada mapa de textura declara procedência, licença e o que foi feito com ele', () => {
    const t = ler('texturas.json');
    const mapas = t['mapas'] as Record<string, unknown>[];
    expect(mapas.length).toBeGreaterThan(10);
    const PROCEDENCIAS = ['imagem', 'derivado', 'artistico', 'calculado', 'decorativo'];
    for (const m of mapas) {
      const onde = `${String(m['corpo'])}/${String(m['papel'])}`;
      expect(PROCEDENCIAS, `${onde}: procedência desconhecida`).toContain(m['procedencia']);
      expect(typeof m['fonte'], `${onde}: sem fonte`).toBe('string');
      expect(String(m['url']), `${onde}: sem url`).toMatch(URL_HTTP);
      expect(typeof m['licenca'], `${onde}: sem licença`).toBe('string');
      // Um dado TRANSFORMADO tem de dizer o que foi feito com ele. "derivado"
      // sem nota é o caso em que o alfa de um anel vira profundidade óptica e
      // ninguém registra a conversão.
      if (m['procedencia'] === 'derivado' || m['procedencia'] === 'calculado') {
        expect(typeof m['nota'], `${onde}: transformado e sem nota`).toBe('string');
        expect(String(m['nota']).length, `${onde}: nota vazia`).toBeGreaterThan(20);
      }
      // E o que NÃO é medida tem de dizer isso, porque é o que o bloco de
      // honestidade cita pelo nome.
      if (m['procedencia'] === 'artistico') {
        expect(typeof m['nota'], `${onde}: reconstrução sem nota`).toBe('string');
      }
    }
  });
});
