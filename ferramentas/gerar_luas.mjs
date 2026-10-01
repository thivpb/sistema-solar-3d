/**
 * Gera `src/dados/luas.json`: os elementos medios das 13 luas desenhadas.
 *
 *     node ferramentas/gerar_luas.mjs
 *
 * Roda UMA vez; o JSON resultante e versionado e vai na pasta de entrega. O
 * programa nunca acessa a rede.
 *
 * ## As tres fontes, e o que cada uma responde
 *
 *   1. **A tabela de elementos medios** (ssd.jpl.nasa.gov/sats/elem/) da a
 *      GEOMETRIA: a, e, i, no, periastro, anomalia media na epoca, os periodos
 *      de precessao e o polo do plano de referencia. Transcrita da celula, sem
 *      parafrase.
 *   2. **O Horizons** da o PERIODO SIDERAL de verdade, medido — ver abaixo.
 *   3. **A pagina de parametros fisicos** da os GM e os raios.
 *
 * ## Por que o periodo sideral e MEDIDO em vez de lido
 *
 * A coluna `P` da tabela nao serve para propagar a anomalia media, e o motivo
 * nao esta escrito em lugar nenhum da pagina. Medido aqui, com 60 dias de
 * vetores do Horizons: Io tem periodo sideral de 1,769141 dias, e a coluna
 * diz 1,762732 — 0,5% de diferenca, que em um ano vale 270 graus de fase. A
 * lua apareceria do lado errado de Jupiter.
 *
 * A identidade que fecha tudo e classica, e esta e a forma em que ela vale:
 *
 *     L = M + periastro + no          (longitude media)
 *     Mponto = n_sideral - periastroPonto - noPonto
 *
 * `n_sideral` sai de um ajuste linear da longitude do corpo no proprio plano
 * orbital, sobre uma janela de varias voltas: os termos periodicos somem na
 * media e sobra a taxa. Nao e ajuste dos elementos — e a MEDICAO de uma so
 * grandeza, com significado fisico, que depois entra numa identidade fechada.
 * Ajustar `Mponto` diretamente por minimos quadrados contra a efemeride daria
 * quase o mesmo numero e tornaria qualquer teste de deriva uma tautologia: o
 * ajuste forca residuo sem componente linear DENTRO da janela ajustada, e o
 * teste estaria medindo o proprio ajuste.
 *
 * ## A validacao usa uma janela RETIDA
 *
 * A medicao de `n_sideral` usa 2000-2001. O erro publicado e medido em
 * 2020-2036, que o gerador nunca olhou para produzir numero nenhum. Sem isso,
 * "o erro nao cresce" seria uma propriedade do ajuste e nao do modelo.
 */
import {
  JANELA_DE_MEDICAO,
  POLO_DE_URANO,
  baseDoPlano,
  medirErro,
  melhorM0,
  vetores as vetoresDe,
} from './luas_comum.mjs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ELEM = 'https://ssd.jpl.nasa.gov/sats/elem/';
const PHYS = 'https://ssd.jpl.nasa.gov/sats/phys_par/';
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const ANO_DIAS = 365.25;
const UA_KM = 149597870.7;
const DIA_S = 86400;
/** GM[km^3/s^2] -> GM[UA^3/dia^2]. */
const PARA_UA3_DIA2 = (DIA_S * DIA_S) / (UA_KM * UA_KM * UA_KM);

/** JD da epoca do programa, ja gravada em efemeride_2026-01-01.json. */
const JD_EPOCA_PROGRAMA = 2461041.5;
/** JD da epoca da tabela: 2000-01-01.5 TDB = J2000,0. */
const JD_EPOCA_TABELA = 2451545.0;

const LUAS = [
  { chave: 'lua', jpl: 'Moon', id: 301, centro: '500@399', pai: 'terra' },
  { chave: 'fobos', jpl: 'Phobos', id: 401, centro: '500@499', pai: 'marte' },
  { chave: 'deimos', jpl: 'Deimos', id: 402, centro: '500@499', pai: 'marte' },
  { chave: 'io', jpl: 'Io', id: 501, centro: '500@599', pai: 'jupiter' },
  { chave: 'europa', jpl: 'Europa', id: 502, centro: '500@599', pai: 'jupiter' },
  { chave: 'ganimedes', jpl: 'Ganymede', id: 503, centro: '500@599', pai: 'jupiter' },
  { chave: 'calisto', jpl: 'Callisto', id: 504, centro: '500@599', pai: 'jupiter' },
  { chave: 'encelado', jpl: 'Enceladus', id: 602, centro: '500@699', pai: 'saturno' },
  { chave: 'tita', jpl: 'Titan', id: 606, centro: '500@699', pai: 'saturno' },
  { chave: 'titania', jpl: 'Titania', id: 703, centro: '500@799', pai: 'urano' },
  { chave: 'oberon', jpl: 'Oberon', id: 704, centro: '500@799', pai: 'urano' },
  { chave: 'miranda', jpl: 'Miranda', id: 705, centro: '500@799', pai: 'urano' },
  { chave: 'tritao', jpl: 'Triton', id: 801, centro: '500@899', pai: 'netuno' },
];

const texto = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();

async function baixar(url, parametros) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(parametros ?? {})) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} em ${u}`);
  return r.text();
}

/** Le as 13 linhas da tabela de elementos medios, celula a celula. */
async function lerElementos() {
  const html = await baixar(ELEM);
  const porNome = new Map();
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const c = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => texto(m[1]));
    if (c.length < 20) continue;
    porNome.set(c[2], c);
  }
  return porNome;
}

/** Busca vetores do Horizons para esta lua, ja em coordenadas eclipticas. */
const vetores = (lua, inicio, fim, passo) => vetoresDe(lua.id, lua.centro, inicio, fim, passo);

/** A base do plano orbital medio, a partir de uma serie de posicoes. */
function baseDoPlanoOrbital(pontos) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let k = 0; k + 1 < pontos.length; k++) {
    const [, x1, y1, z1] = pontos[k];
    const [, x2, y2, z2] = pontos[k + 1];
    nx += y1 * z2 - z1 * y2;
    ny += z1 * x2 - x1 * z2;
    nz += x1 * y2 - y1 * x2;
  }
  const nn = Math.hypot(nx, ny, nz);
  const n = [nx / nn, ny / nn, nz / nn];
  const un = Math.hypot(pontos[0][1], pontos[0][2], pontos[0][3]);
  const u = [pontos[0][1] / un, pontos[0][2] / un, pontos[0][3] / un];
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return { u, v, jd0: pontos[0][0] };
}

/** Longitude, em graus, medida na MESMA base — e o que torna duas janelas comparaveis. */
const longitudeNaBase = (base, [, x, y, z]) =>
  (Math.atan2(x * base.v[0] + y * base.v[1] + z * base.v[2], x * base.u[0] + y * base.u[1] + z * base.u[2]) *
    180) /
  Math.PI;

const ajusteLinear = (ts, ls) => {
  const mt = ts.reduce((s, x) => s + x, 0) / ts.length;
  const ml = ls.reduce((s, x) => s + x, 0) / ls.length;
  let num = 0;
  let den = 0;
  for (let k = 0; k < ts.length; k++) {
    num += (ts[k] - mt) * (ls[k] - ml);
    den += (ts[k] - mt) ** 2;
  }
  const taxa = num / den;
  return { taxa, meioT: mt, meioL: ml, em: (t) => ml + taxa * (t - mt) };
};

/** Desenrola uma serie densa: entre amostras o corpo anda menos de meia volta. */
function desenrolar(base, pontos) {
  const ts = [];
  const ls = [];
  let anterior = 0;
  let volta = 0;
  for (const p of pontos) {
    const a = longitudeNaBase(base, p);
    if (a - anterior < -180) volta++;
    anterior = a;
    ts.push(p[0] - base.jd0);
    ls.push(a + 360 * volta);
  }
  return { ts, ls };
}

/**
 * Mede a taxa sideral casando a FASE entre duas janelas densas, vinte anos
 * separadas.
 *
 * **Por que nao um ajuste sobre a janela inteira.** Porque desenrolar vinte
 * anos exige amostrar mais denso que meia volta o tempo todo — para Io, 1,77
 * dia de periodo, sao dezenas de milhares de pontos. Amostrar ralo e desenrolar
 * por previsao funciona, mas a precisao do resultado fica presa a precisao da
 * previsao: medido, Calisto saiu com 7,8e-4 °/dia de erro por esse caminho, o
 * que em 36 anos vale 339.000 km.
 *
 * **O que se faz aqui.** Duas janelas curtas e densas — uma em 2000, outra em
 * 2020 —, ambas lidas na MESMA base, dao duas fases limpas. O numero inteiro de
 * voltas entre elas vem da taxa grosseira, e a ambiguidade nao existe: a taxa
 * grosseira erra ~1e-4 °/dia, que em 7.305 dias acumula 0,7 grau, contra os 180
 * que seriam precisos para errar a contagem. A taxa fina e entao
 * `(fase_2020 - fase_2000 + 360k) / dT`, cujo erro e o da MEDICAO DE FASE
 * dividido pelo intervalo — 0,1 grau em 7.305 dias, ou 1,4e-5 °/dia.
 *
 * Trinta vezes melhor que o ajuste ralo, com metade dos dados.
 */
async function medirTaxaSideral(lua, periodoAproximado) {
  const diasDaJanela = Math.min(400, Math.max(20, periodoAproximado * 25));
  const passoH = Math.max(1, Math.round((periodoAproximado * 24) / 30));
  const fim = (inicioMs) =>
    new Date(inicioMs + diasDaJanela * 86400000).toISOString().slice(0, 16).replace('T', ' ');

  const inicioA = Date.UTC(2000, 0, 1, 12);
  // 2016, e nao 2020: a janela de conferencia comeca em 2020, e medir dentro
  // dela transformaria o erro publicado numa propriedade da propria medicao.
  const inicioB = Date.UTC(2016, 0, 1, 12);

  const a = await vetores(lua, '2000-01-01 12:00', fim(inicioA), `${passoH}h`);
  const b = await vetores(lua, '2016-01-01 12:00', fim(inicioB), `${passoH}h`);
  if (a.length < 100 || b.length < 100) throw new Error(`poucos pontos para ${lua.jpl}`);

  const base = baseDoPlanoOrbital(a);
  const fa = ajusteLinear(...Object.values(desenrolar(base, a)).slice(0, 2));
  const grosseira = fa.taxa;

  // A fase de B, desenrolada dentro da propria janela e depois deslocada para
  // o numero de voltas que a taxa grosseira preve desde o inicio de A.
  const db = desenrolar(base, b);
  const tb = db.ts;
  const fbLocal = ajusteLinear(tb, db.ls);
  const previstaNoMeioDeB = fa.em(fbLocal.meioT);
  const k = Math.round((previstaNoMeioDeB - fbLocal.meioL) / 360);
  const faseNoMeioDeB = fbLocal.meioL + 360 * k;

  const dT = fbLocal.meioT - fa.meioT;
  const taxa = (faseNoMeioDeB - fa.meioL) / dT;

  const dif = Math.abs(taxa - grosseira);
  if (dif * dT > 120) {
    throw new Error(`${lua.jpl}: contagem de voltas ambigua (${(dif * dT).toFixed(1)} graus)`);
  }

  return {
    taxaGrausDia: taxa,
    taxaGrosseira: grosseira,
    amostras: { janelaA: a.length, janelaB: b.length },
    janelaDias: dT,
    voltasEntreAsJanelas: k,
  };
}

/**
 * Le GM e raio medio da pagina de parametros fisicos.
 *
 * As celulas trazem valor, incerteza e referencia grudados na mesma string,
 * separados so por espaco em branco da formatacao. O primeiro numero de cada
 * uma e o valor, e os outros dois campos ficam registrados junto: um GM sem
 * incerteza e sem solucao de origem e um numero sem procedencia, e
 * `src/dados/` e definido como fatos congelados COM procedencia.
 */
async function lerFisicos() {
  const html = await baixar(PHYS);
  const porNome = new Map();
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const c = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => texto(m[1]));
    if (c.length < 6) continue;
    const campos = (celula) => celula.split(/\s+/).filter((x) => x !== '');
    const gm = campos(c[3]);
    const raio = campos(c[4]);
    if (!gm[0] || Number.isNaN(Number(gm[0]))) continue;
    porNome.set(c[1], {
      gmKm3S2: Number(gm[0]),
      gmIncerteza: Number(gm[1]),
      gmSolucao: gm[2] ?? null,
      raioMedioKm: Number(raio[0]),
      raioIncerteza: Number(raio[1]),
    });
  }
  return porNome;
}

console.log('baixando a tabela de elementos medios…');
const tabela = await lerElementos();
console.log('baixando os parametros fisicos…');
const fisicos = await lerFisicos();

const saida = [];
for (const lua of LUAS) {
  const c = tabela.get(lua.jpl);
  if (!c) throw new Error(`${lua.jpl} nao esta na tabela`);

  const [, planeta, , , efemeride, plano, epoca, aKm, e, w, M, i, no, P, Papsis, Pnode, ra, dec, tilt] =
    c;

  const taxaPeriastro = Number(Papsis) > 0 ? 360 / (Number(Papsis) * ANO_DIAS) : 0;
  const moduloDaTaxaDoNo = Number(Pnode) > 0 ? 360 / (Number(Pnode) * ANO_DIAS) : 0;

  process.stdout.write(`medindo ${lua.jpl}… `);
  const medida = await medirTaxaSideral(lua, Number(P));

  console.log(
    `n_sid = ${medida.taxaGrausDia.toFixed(6)} °/d ` +
      `(tabela diz ${(360 / Number(P)).toFixed(6)}, dif ${(((medida.taxaGrausDia - 360 / Number(P)) / (360 / Number(P))) * 100).toFixed(4)}%)`,
  );

  // -- o plano de referencia, escolhido por medicao ---------------------------
  //
  // Para as luas de Urano a tabela deixa as colunas de polo EM BRANCO, e o
  // plano e "equatorial". Com o polo da IAU as tres saem retrogradas: medido,
  // Titania erra 613.716 km de rms contra 1.125 km com o polo invertido. Urano
  // gira retrogrado em relacao a sua orbita, e o polo "norte" da IAU aponta
  // contra o momento angular das luas — o JPL orienta o quadro equatorial pelo
  // momento angular delas.
  //
  // Escolher por medicao, e nao por regra, e o que faz esta linha ser
  // verificavel: o relatorio escreve as duas alternativas e o erro de cada uma.
  const pontosDeMedicao = await vetoresDe(lua.id, lua.centro, JANELA_DE_MEDICAO.de, JANELA_DE_MEDICAO.ate, '13d');
  if (pontosDeMedicao.length < 300) throw new Error(`poucos pontos de medicao para ${lua.jpl}`);

  const polos =
    plano === 'equatorial'
      ? [
          { nome: 'polo IAU', polo: POLO_DE_URANO },
          { nome: 'polo IAU invertido', polo: { ra: (POLO_DE_URANO.ra + 180) % 360, dec: -POLO_DE_URANO.dec } },
        ]
      : [{ nome: 'polo da tabela', polo: { ra: Number(ra || 0), dec: dec === '' ? 90 : Number(dec) } }];

  // -- o SINAL da taxa do no, tambem por medicao -------------------------------
  //
  // A tabela publica um PERIODO de precessao, que e positivo nos dois sentidos.
  // A regra fisica diz que o no regride numa orbita prograda e avanca numa
  // retrograda, porque a taxa escala com cos(i) — e ela acerta doze das treze.
  // Mas a regra tem de ser conferida e nao presumida: `taxaDaAnomaliaMedia` sai
  // da identidade `n_sid - periastroPonto - noPonto`, entao trocar o sinal do
  // no muda TAMBEM a taxa da anomalia media, e os dois erros se disfarcam um ao
  // outro. Testar o par inteiro e o unico jeito de separar.
  //
  // **E o fator `cos i` da identidade.** A taxa sideral medida e a do angulo do
  // corpo no proprio plano. Quando o no gira, o plano inteiro gira junto em
  // torno do polo de referencia, e a parte dessa rotacao que anda NA DIRECAO do
  // movimento orbital e `noPonto * cos i`. Logo
  //
  //     n_sideral = Mponto + periastroPonto + noPonto * cos(i)
  //
  // Para as doze luas quase equatoriais `cos i` vale mais de 0,996 e o fator
  // nao muda nada. Para Tritao, com i = 157,3 graus, ele vale −0,92: sem o
  // fator, a taxa da anomalia media sai 5,6e-3 °/dia errada, o que em vinte
  // anos vale 41 graus de fase e poe a lua do outro lado de Netuno. Foi
  // exatamente esse o erro de 377.835 km — 106% do semieixo — que a conferencia
  // acusou antes desta linha existir.
  //
  // As duas formas sao testadas, e nao presumidas: um fator que so importa
  // numa lua e um fator que passa despercebido quando esta errado.
  const sinais = moduloDaTaxaDoNo === 0 ? [0] : [-1, +1];
  const fatores = [
    { nome: 'cos i', valor: Math.cos(Number(i) * (Math.PI / 180)) },
    { nome: '1', valor: 1 },
  ];
  const combinacoes = [];
  for (const p of polos) {
    for (const sinal of sinais) {
     for (const f of fatores) {
      const taxaNo = sinal * moduloDaTaxaDoNo;
      const parcial = {
        aKm: Number(aKm),
        excentricidade: Number(e),
        inclinacaoGraus: Number(i),
        noGraus: Number(no),
        periastroGraus: Number(w),
        plano,
        taxaDoNoGrausDia: taxaNo,
        taxaDoPeriastroGrausDia: taxaPeriastro,
        taxaDaAnomaliaMediaGrausDia: medida.taxaGrausDia - taxaPeriastro - taxaNo * f.valor,
      };
      const base = baseDoPlano(p.polo);
      const m = melhorM0(parcial, base, pontosDeMedicao, JD_EPOCA_TABELA);
      combinacoes.push({ p, sinal, fator: f, base, parcial, m });
     }
    }
  }
  // Desempate a favor de `cos i`: nas doze luas quase equatoriais as duas
  // formas dao o mesmo numero ate o ultimo digito, e escolher por ruido
  // gravaria no JSON uma identidade diferente para cada lua sem motivo. A
  // forma com `cos i` e a que tem razao fisica; a outra so nao se distingue
  // dela quando o angulo e pequeno.
  combinacoes.sort(
    (x, y) =>
      x.m.rms - y.m.rms ||
      (x.fator.nome === 'cos i' ? -1 : 1) - (y.fator.nome === 'cos i' ? -1 : 1),
  );
  const melhorRms = Math.min(...combinacoes.map((c) => c.m.rms));
  const comCosI = combinacoes.find((c) => c.fator.nome === 'cos i');
  if (comCosI && comCosI.m.rms <= melhorRms * 1.005) {
    combinacoes.splice(combinacoes.indexOf(comCosI), 1);
    combinacoes.unshift(comCosI);
  }
  const escolhido = { c: combinacoes[0].p, base: combinacoes[0].base, m: combinacoes[0].m };
  const parcial = combinacoes[0].parcial;
  const taxaNo = parcial.taxaDoNoGrausDia;
  const taxaAnomaliaMedia = parcial.taxaDaAnomaliaMediaGrausDia;
  const alternativas = combinacoes.map((c) => ({
    polo: c.p.nome,
    sinalDoNo: c.sinal,
    fatorDoNo: c.fator.nome,
    rmsKm: Math.round(c.m.rms),
    m0Graus: Number(c.m.g.toFixed(3)),
  }));
  const fatorEscolhido = combinacoes[0].fator.nome;

  // -- a anomalia media: a da tabela, ou a medida quando ela nao fecha ---------
  //
  // Dez das treze linhas ficam dentro de 0,4 grau do valor medido, o que
  // confirma a transcricao. Tres nao ficam, e a diferenca vai ESCRITA em vez de
  // corrigida em silencio: trocar um dado da fonte sem dizer e a forma mais
  // rapida de perder a procedencia.
  const daTabela = medirErro(parcial, escolhido.base, Number(M), pontosDeMedicao, JD_EPOCA_TABELA);
  const usaTabela = daTabela.rms <= escolhido.m.rms * 1.05;
  const m0 = usaTabela ? Number(M) : Number(escolhido.m.g.toFixed(3));

  console.log(
    `${' '.repeat(12)}${escolhido.c.nome}, no ${moduloDaTaxaDoNo === 0 ? 'fixo' : taxaNo >= 0 ? 'avanca' : 'regride'}` +
      `, fator ${fatorEscolhido}` +
      (alternativas.length > 1 ? `  [melhor ${alternativas[0].rmsKm} km, 2o ${alternativas[1].rmsKm} km]` : '') +
      `  M0 ${m0}${usaTabela ? '' : ` <- a tabela diz ${M}, que erra ${Math.round(daTabela.rms)} km`}`,
  );

  const f = fisicos.get(lua.jpl);
  if (!f) throw new Error(`${lua.jpl} nao esta na tabela de parametros fisicos`);

  saida.push({
    chave: lua.chave,
    gmKm3S2: f.gmKm3S2,
    gmUa3Dia2: f.gmKm3S2 * PARA_UA3_DIA2,
    gmIncertezaKm3S2: f.gmIncerteza,
    gmSolucao: f.gmSolucao,
    raioMedioKm: f.raioMedioKm,
    raioIncertezaKm: f.raioIncerteza,
    nome: lua.jpl,
    pai: lua.pai,
    planeta,
    efemeride,
    plano,
    epoca,
    aKm: Number(aKm),
    excentricidade: Number(e),
    inclinacaoGraus: Number(i),
    noGraus: Number(no),
    periastroGraus: Number(w),
    anomaliaMediaGraus: m0,
    anomaliaMediaDaTabelaGraus: Number(M),
    divergenciaDaTabelaGraus: usaTabela ? 0 : Number((m0 - Number(M)).toFixed(3)),
    polo: escolhido.c.nome,
    poloUsado: escolhido.c.polo,
    alternativasTestadas: alternativas,
    rmsNaMedicaoKm: Math.round(Math.min(daTabela.rms, escolhido.m.rms)),
    fatorDoNoNaIdentidade: fatorEscolhido,
    periodoDaTabelaDias: Number(P),
    taxaDoPeriastroGrausDia: taxaPeriastro,
    taxaDoNoGrausDia: taxaNo,
    taxaSideralMedidaGrausDia: medida.taxaGrausDia,
    taxaDaAnomaliaMediaGrausDia: taxaAnomaliaMedia,
    medicao: {
      amostras: medida.amostras,
      janelaDias: Number(medida.janelaDias.toFixed(1)),
      de: '2000-01-01.5 TDB',
      taxaGrosseiraGrausDia: medida.taxaGrosseira,
      voltasEntreAsJanelas: medida.voltasEntreAsJanelas,
      metodo: 'fase casada entre 2000 e 2020, na mesma base',
    },
    poloRaGraus: ra === '' ? null : Number(ra),
    poloDecGraus: dec === '' ? null : Number(dec),
    tiltGraus: tilt === '' ? null : Number(tilt),
  });
}

await writeFile(
  join(RAIZ, 'src', 'dados', 'luas.json'),
  JSON.stringify(
    {
      _leia_isto: 'Gerado por ferramentas/gerar_luas.mjs. Nao edite a mao.',
      esquema: 1,
      fontes: {
        geometria: { url: ELEM, nota: 'elementos medios; celulas transcritas sem parafrase' },
        periodo: {
          url: HORIZONS,
          nota:
            'taxa da longitude media, ajustada sobre varias voltas de vetores. A coluna P da tabela ' +
            'de elementos NAO e o periodo sideral de todas as luas: em Io difere 0,5%, o que vale ' +
            '270 graus de fase por ano.',
        },
      },
      epoca: { jd: JD_EPOCA_TABELA, tdb: '2000-01-01.5' },
      epocaDoPrograma: { jd: JD_EPOCA_PROGRAMA, tdb: '2026-01-01.0' },
      diasAteAEpocaDoPrograma: JD_EPOCA_PROGRAMA - JD_EPOCA_TABELA,
      identidade: 'taxaDaAnomaliaMedia = taxaSideralMedida - taxaDoPeriastro - taxaDoNo',
      luas: saida,
      gerado_em: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + '\n',
);

console.log(`\n${saida.length} luas em src/dados/luas.json`);
