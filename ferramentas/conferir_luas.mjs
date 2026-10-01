/**
 * Confere `src/dados/luas.json` contra o Horizons, numa janela RETIDA.
 *
 *     node ferramentas/conferir_luas.mjs
 *
 * `gerar_luas.mjs` mede tudo — taxa sideral, plano de referencia e anomalia
 * inicial — dentro de 2000-2016. Esta conferencia mede o erro em 2020-2040,
 * vinte anos que o gerador nunca olhou, com tres anos de folga entre as duas.
 *
 * **Por que a separacao nao e zelo.** Qualquer ajuste linear forca residuo sem
 * componente linear dentro da janela ajustada. Medir o erro ali mediria o
 * proprio ajuste, e a frase "o erro nao cresce com o tempo" seria uma
 * tautologia — verdadeira sobre o metodo e muda sobre o modelo. O numero que
 * este arquivo escreve e o que vai publicado no bloco de honestidade, e ha um
 * teste que falha se o programa passar dele.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDS, JANELA_DE_CONFERENCIA, baseDoPlano, medirErro, posicao, vetores } from './luas_comum.mjs';

/** De onde vem o lado medido da subtracao. Ver `procedencia.test.ts`. */
const FONTE = {
  "fonte": "JPL Horizons API (ssd.jpl.nasa.gov/api/horizons.api), vetores geometricos do satelite relativos ao planeta",
  "url": "https://ssd.jpl.nasa.gov/api/horizons.api",
  "nota": "Este arquivo nao traz dado medido de fora: ele traz a DIFERENCA entre a posicao que src/dados/luas.json produz e a que o Horizons devolve, amostrada de 13 em 13 dias na janela retida. A fonte e o lado do Horizons da subtracao."
};

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const dados = JSON.parse(await readFile(join(RAIZ, 'src', 'dados', 'luas.json'), 'utf8'));
const JD0 = dados.epoca.jd;

console.log(`conferindo em ${JANELA_DE_CONFERENCIA.de} .. ${JANELA_DE_CONFERENCIA.ate}`);
console.log('janela retida: nenhum numero do modelo saiu dela\n');

const relatorio = [];
/**
 * Pontos de amarra entre as duas implementacoes.
 *
 * O erro publicado e medido AQUI, em JavaScript de ferramenta; quem desenha na
 * tela e `src/nucleo/luas.ts`, em TypeScript. Se as duas divergirem, o numero
 * do bloco de honestidade passa a descrever um programa que nao e o entregue.
 * Estes pontos sao a unica coisa que impede isso, e `luas.test.ts` falha se a
 * diferenca passar de um metro.
 */
const amarras = [];

for (const l of dados.luas) {
  const [id, centro] = IDS[l.chave];
  const pontos = await vetores(id, centro, JANELA_DE_CONFERENCIA.de, JANELA_DE_CONFERENCIA.ate, '13d');
  if (pontos.length < 400) throw new Error(`${l.chave}: so ${pontos.length} pontos`);

  const base = baseDoPlano(l.poloUsado);
  const inteira = medirErro(l, base, l.anomaliaMediaGraus, pontos, JD0);

  // A metade de cada lado, para responder a unica pergunta que importa sobre
  // deriva: o erro no fim e maior que o do comeco?
  const meio = Math.floor(pontos.length / 2);
  const primeira = medirErro(l, base, l.anomaliaMediaGraus, pontos.slice(0, meio), JD0);
  const segunda = medirErro(l, base, l.anomaliaMediaGraus, pontos.slice(meio), JD0);

  relatorio.push({
    chave: l.chave,
    aKm: l.aKm,
    erroMaximoKm: Math.round(inteira.maximo),
    erroRmsKm: Math.round(inteira.rms),
    fracaoDoSemieixo: Number((inteira.maximo / l.aKm).toFixed(4)),
    primeiraMetadeMaximoKm: Math.round(primeira.maximo),
    segundaMetadeMaximoKm: Math.round(segunda.maximo),
    cresce: Number((segunda.maximo / primeira.maximo).toFixed(2)),
  });

  for (const dias of [0, 1234.5, 9496.5, 14610]) {
    const [x, y, z] = posicao(l, base, dias, l.anomaliaMediaGraus);
    amarras.push({ chave: l.chave, dias, xKm: x, yKm: y, zKm: z });
  }

  const r = relatorio[relatorio.length - 1];
  console.log(
    `${l.chave.padEnd(11)} max ${String(r.erroMaximoKm).padStart(8)} km  ` +
      `rms ${String(r.erroRmsKm).padStart(8)} km  ` +
      `${String((100 * r.fracaoDoSemieixo).toFixed(2)).padStart(6)}% do semieixo  ` +
      `2a metade / 1a = ${r.cresce}`,
  );
}

const pior = relatorio.reduce((a, b) => (b.erroMaximoKm > a.erroMaximoKm ? b : a));
const maiorCrescimento = relatorio.reduce((a, b) => (b.cresce > a.cresce ? b : a));

await writeFile(
  join(RAIZ, 'src', 'dados', 'derivaDasLuas.json'),
  JSON.stringify(
    {
      _leia_isto: 'Gerado por ferramentas/conferir_luas.mjs. Nao edite a mao.',
      // Sem procedencia, nao grava. Este arquivo nao traz dado medido de fora:
      // ele traz a DIFERENCA entre o que o modelo produz e o que o Horizons
      // devolve. A fonte e o lado do Horizons da subtracao, e sem ela escrita o
      // numero "52.636 km" fica orfao — daqui a um ano ninguem reconstitui
      // contra o que ele foi medido. `procedencia.test.ts` reprova a falta.
      fonte: FONTE,
      janela: { ...JANELA_DE_CONFERENCIA, passo: '13 dias', retida: true },
      metodo:
        'Tudo do modelo foi medido em 2000-2016. Esta janela comeca em 2020 e o gerador nunca ' +
        'a olhou, entao o erro aqui e o erro do modelo e nao o do ajuste.',
      pior: { chave: pior.chave, erroMaximoKm: pior.erroMaximoKm },
      maiorCrescimento: { chave: maiorCrescimento.chave, razao: maiorCrescimento.cresce },
      luas: relatorio,
      amarras,
      gerado_em: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + '\n',
);

console.log(`\npior caso: ${pior.chave}, ${pior.erroMaximoKm} km`);
console.log(`maior crescimento entre as metades: ${maiorCrescimento.chave}, ${maiorCrescimento.cresce}x`);
console.log('escrito em src/dados/derivaDasLuas.json');
