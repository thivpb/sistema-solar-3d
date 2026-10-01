/**
 * Baixa as texturas uma vez e gera os niveis que o programa carrega.
 *
 * **Roda uma vez. O resultado e versionado.** O programa nunca acessa a rede —
 * esta ferramenta e, junto com `gerar_efemeride.py`, a unica parte do projeto
 * que toca a internet, e nenhuma das duas roda em uso normal.
 *
 *     node ferramentas/baixar_texturas.mjs
 *
 * **O que a fonte tem de verdade.** O servidor devolve 200 com uma pagina HTML
 * de erro para arquivos que nao existem, entao o codigo de status nao serve
 * para nada: quem decide e o tipo do conteudo. Sondado, existem 2K e 8K — NAO
 * existe 4K, com uma excecao. Urano e Netuno so tem 2K, o que nao custa nada:
 * nao ha o que ver neles.
 *
 * **Por que 4K e o nivel maximo entregue.** O 4K e gerado aqui, reduzindo o 8K
 * com o `sips` que ja vem no macOS. Entregar o 8K tambem levaria a pasta a
 * ~104 MB, e o ganho e nenhum dentro do alcance de camera que este programa
 * tem: a aproximacao maxima e orbita baixa, de 100 a 3.000 km. Em Marte, um
 * texel de 4K vale 5,2 km; a 3.000 km de altitude cada pixel da tela cobre
 * 7,7 km, e mesmo a 100 km cobre 4,2 km. Ou seja, o 4K so comeca a ficar
 * devendo bem no limite da aproximacao — e o 8K so faria diferenca num pouso
 * literal, que esta declarado fora de escopo.
 *
 * **Licenca.** Texturas por Solar System Scope (solarsystemscope.com), sob
 * CC BY 4.0. O credito e obrigatorio e aparece no bloco de fontes do programa.
 */
import { mkdir, writeFile, readFile, access, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const executar = promisify(execFile);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RAIZ, '.cache-texturas');
const DESTINO = join(RAIZ, 'publico', 'texturas');
/**
 * As fontes, por nome. Cada mapa diz de qual veio.
 *
 * O download era `${BASE}/${nome}.${ext}` com `BASE` fixo no Solar System
 * Scope, que nao publica mapa de lua nenhuma alem da nossa — e por isso doze
 * das treze luas eram desenhadas com uma `DataTexture` de 1x1 pixel com a cor
 * media, em qualquer distancia. A 3 px ninguem via; com o zoom, todas viravam
 * bolas lisas coloridas.
 *
 * Os mosaicos do USGS Astrogeology sao produto do governo dos EUA e estao em
 * dominio publico. Eles vem em GeoTIFF cilindrico simples, que e exatamente a
 * projecao que a esfera do programa espera, e o `sips` converte.
 */
const FONTES = {
  sss: {
    nome: 'Solar System Scope',
    url: 'https://www.solarsystemscope.com/textures/',
    licenca: 'CC BY 4.0',
    base: 'https://www.solarsystemscope.com/textures/download',
  },
  usgs: {
    nome: 'USGS Astrogeology Science Center',
    url: 'https://astrogeology.usgs.gov/',
    licenca: 'domínio público (produto do governo dos EUA)',
    base: 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic',
  },
};

/**
 * Procedencia por MAPA, e nao por corpo.
 *
 *   imagem     fotografia ou mosaico de imageamento direto
 *   derivado   dado medido, mas transformado (radar recolorido, elevacao virada
 *              em normal, alfa virado em profundidade optica)
 *   artistico  reconstrucao: nao existe o dado, so a cor integrada
 *
 * O campo e OBRIGATORIO. O mesmo criterio que recusa mapa de relevo num
 * gigante gasoso — inventar montanha onde nao ha superficie seria desonesto —
 * obriga a etiquetar o albedo de Urano e Netuno.
 */
const MAPAS = [
  { corpo: 'mercurio', papel: 'albedo', arquivo: 'mercury', melhor: '8k', procedencia: 'imagem' },
  {
    corpo: 'venus', papel: 'albedo', arquivo: 'venus_surface', melhor: '8k', procedencia: 'derivado',
    nota: 'radar do Magellan, recolorido — a superfície de Vênus nunca foi fotografada de órbita, porque a atmosfera é opaca',
  },
  { corpo: 'venus', papel: 'nuvens', arquivo: 'venus_atmosphere', melhor: '4k', procedencia: 'imagem' },
  { corpo: 'terra', papel: 'albedo', arquivo: 'earth_daymap', melhor: '8k', procedencia: 'imagem' },
  {
    corpo: 'terra', papel: 'noite', arquivo: 'earth_nightmap', melhor: '8k', procedencia: 'imagem',
    nota: 'luzes de cidade do programa Suomi NPP / VIIRS',
  },
  { corpo: 'terra', papel: 'nuvens', arquivo: 'earth_clouds', melhor: '8k', procedencia: 'imagem' },
  { corpo: 'marte', papel: 'albedo', arquivo: 'mars', melhor: '8k', procedencia: 'imagem' },
  { corpo: 'lua', papel: 'albedo', arquivo: 'moon', melhor: '8k', procedencia: 'imagem' },
  { corpo: 'jupiter', papel: 'albedo', arquivo: 'jupiter', melhor: '8k', procedencia: 'imagem' },
  { corpo: 'saturno', papel: 'albedo', arquivo: 'saturn', melhor: '8k', procedencia: 'imagem' },
  {
    corpo: 'saturno', papel: 'anel', arquivo: 'saturn_ring_alpha', melhor: '8k', ext: 'png',
    procedencia: 'derivado', semNiveis: true,
    nota: 'o canal alfa é cobertura em incidência normal; o programa converte para profundidade óptica por tau = −ln(1 − alfa)',
  },
  {
    corpo: 'urano', papel: 'albedo', arquivo: 'uranus', melhor: '2k', procedencia: 'artistico',
    nota: 'não existe imageamento global de Urano: a aparência é uma reconstrução a partir da cor integrada',
  },
  {
    corpo: 'netuno', papel: 'albedo', arquivo: 'neptune', melhor: '2k', procedencia: 'artistico',
    nota: 'não existe imageamento global de Netuno: a aparência é uma reconstrução a partir da cor integrada',
  },
  {
    corpo: 'sol', papel: 'albedo', arquivo: 'sun', melhor: '8k', procedencia: 'derivado',
    nota: 'imagem solar tratada; a granulação real muda em minutos e esta é uma única fotografia',
  },
  {
    corpo: 'ceu', papel: 'viaLactea', arquivo: 'stars_milky_way', melhor: '8k', procedencia: 'derivado',
    nota: 'panorama da Via Láctea; o campo de estrelas nomeadas vem do catálogo Yale, não daqui',
  },

  // ── As luas, do USGS ──────────────────────────────────────────────────────
  //
  // **A regra e "o mapa que existe", e nao "um mapa para cada uma".** Cinco das
  // treze luas tem mosaico global publicado; as outras oito nao, e ficam com a
  // cor media e a ficha dizendo por que. Titan foi imageado no infravermelho
  // atraves da bruma e o mosaico nao esta neste acervo; Fobos, Deimos, Titania,
  // Oberon, Miranda e Tritao foram vistos de uma passagem so, com metade do
  // corpo na sombra. Inventar o resto seria desenhar o que ninguem viu.
  //
  // A resolucao da fonte vai por METRO POR PIXEL, que e como o USGS publica, e
  // nao em "8k": o que sai daqui e 2K e 4K de qualquer jeito.
  {
    corpo: 'io', papel: 'albedo', fonte: 'usgs', procedencia: 'imagem',
    arquivo: 'io', origem: 'Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif',
    longitude: { direcao: 'oeste', minima: -180 },
    nota: 'mosaico global Galileo SSI + Voyager, 1 km/pixel, com a cor do Galileo mesclada sobre o mosaico em tons de cinza',
  },
  {
    corpo: 'europa', papel: 'albedo', fonte: 'usgs', procedencia: 'imagem',
    arquivo: 'europa', origem: 'Europa_Voyager_GalileoSSI_global_mosaic_500m.tif',
    longitude: { direcao: 'oeste', minima: 0 },
    nota: 'mosaico global Voyager + Galileo SSI, 500 m/pixel, em tons de cinza — a cor do Galileo não cobre o globo inteiro',
  },
  {
    corpo: 'ganimedes', papel: 'albedo', fonte: 'usgs', procedencia: 'imagem',
    arquivo: 'ganymede', origem: 'Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif',
    longitude: { direcao: 'leste', minima: 0 },
    nota: 'mosaico global colorido Voyager + Galileo SSI, 1.435 m/pixel',
  },
  {
    corpo: 'calisto', papel: 'albedo', fonte: 'usgs', procedencia: 'imagem',
    arquivo: 'callisto', origem: 'Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif',
    longitude: { direcao: 'oeste', minima: 0 },
    nota: 'mosaico global Voyager + Galileo SSI, 1 km/pixel, em tons de cinza',
  },
  {
    corpo: 'encelado', papel: 'albedo', fonte: 'usgs', procedencia: 'imagem',
    arquivo: 'enceladus', origem: 'Enceladus_Cassini_mosaic_global_110m.tif',
    longitude: { direcao: 'oeste', minima: -180 },
    nota: 'mosaico global Cassini ISS, 110 m/pixel',
  },
];

/**
 * Os niveis entregues, e por que o 8K so existe as vezes.
 *
 * O 2K e o 4K sao gerados sempre, inclusive quando a fonte e menor: o `sips`
 * nao amplia, entao o arquivo no `4k/` de Urano e um 2048 com outro nome. Isso
 * e de proposito — o carregador pode pedir qualquer nivel de qualquer mapa sem
 * ter de saber quais existem.
 *
 * O 8K NAO segue essa regra, e a razao e peso: um 8K a qualidade 82 pesa de 8
 * a 15 MB, e vinte copias de arquivos que nao tem 8K de verdade custariam
 * duzentos megabytes de pasta de entrega para nao mostrar nada. Entao ele so
 * e gerado quando a fonte tem 8192 pixels ou mais, e o carregador ja sabe
 * ficar com o que tem quando o nivel nao existe.
 */
const NIVEIS = [
  { nome: '2k', largura: 2048 },
  { nome: '4k', largura: 4096 },
  { nome: '8k', largura: 8192, exigeFonteDoTamanho: true },
];

/** A largura em pixels de um arquivo, pelo `sips`. */
async function larguraDe(caminho) {
  const { stdout } = await executar('/usr/bin/sips', ['-g', 'pixelWidth', caminho]);
  const m = /pixelWidth:\s*(\d+)/.exec(stdout);
  return m ? Number(m[1]) : 0;
}

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function baixar(nomeNoCache, url) {
  const destino = join(CACHE, nomeNoCache);
  if (await existe(destino)) return destino;
  const resp = await fetch(url);
  const tipo = resp.headers.get('content-type') ?? '';
  const dados = Buffer.from(await resp.arrayBuffer());
  // O servidor devolve 200 com HTML para arquivo inexistente. O tipo e quem diz.
  if (!tipo.startsWith('image/')) throw new Error(`${url} nao e imagem (${tipo})`);
  await writeFile(destino, dados);
  return destino;
}

/**
 * Reduz com o `sips`, que ja vem no macOS. Qualidade 82: o borrao some antes
 * do peso.
 *
 * `--setProperty format jpeg` e explicito porque as fontes do USGS chegam em
 * GeoTIFF: sem ele, o `sips` guardaria um TIFF com extensao `.jpg`, e o
 * navegador recusaria o arquivo sem dizer por que.
 */
async function reduzir(origem, destino, largura, formato = 'jpeg') {
  await executar('/usr/bin/sips', [
    '-s', 'format', formato,
    '-Z', String(largura), '--setProperty', 'formatOptions', '82', '-o', destino, origem,
  ]);
}

/**
 * Onde a longitude zero cai na imagem, e para que lado ela cresce.
 *
 * ## Por que isto existe, e por que nao da para "so usar o arquivo"
 *
 * O programa desenha todos os corpos com a mesma convencao, herdada dos mapas
 * do Solar System Scope: **longitude 0 no MEIO da imagem, crescendo para LESTE
 * a direita**. E o que se ve no mapa da Terra, com o Atlantico no centro.
 *
 * Os mosaicos do USGS nao seguem uma convencao so — cada um declara a sua no
 * rotulo PDS que vem ao lado, e os cinco que este projeto usa nao concordam
 * entre si:
 *
 *     Io          PositiveWest, de −180 a +180   → so espelhar
 *     Europa      PositiveWest, de 0 a 360       → espelhar e girar meia volta
 *     Calisto     PositiveWest, de 0 a 360       → espelhar e girar meia volta
 *     Encelado    PositiveWest, de −180 a +180   → so espelhar
 *     Ganimedes   PositiveEast, de 0 a 360       → so girar meia volta
 *
 * Ignorar isso nao daria erro nenhum: daria uma lua bonita com os continentes
 * no lugar errado, espelhada, e ninguem notaria ate comparar com uma foto. E
 * exatamente o tipo de mentira silenciosa que este projeto trata como defeito.
 *
 * A conta, uma vez: a imagem vai de `minima` a `minima + 360` na direcao
 * declarada, entao `u = A ± x/L`, com `A = 0,5 + minima/360` para leste e
 * `A = 0,5 − minima/360` para oeste, e o sinal negativo para oeste. Espelhar
 * resolve o sinal; girar por `A mod 1` resolve o resto.
 */
function transformacaoDaLongitude(longitude) {
  if (!longitude) return { espelhar: false, girar: 0 };
  const { direcao, minima } = longitude;
  const oeste = direcao === 'oeste';
  const a = 0.5 + (oeste ? -minima : minima) / 360;
  return { espelhar: oeste, girar: ((a % 1) + 1) % 1 };
}

/**
 * Aplica espelho e giro na imagem, e nao na textura.
 *
 * Daria para fazer isto em tempo de execucao, com `repeat.x = -1` e
 * `offset.x`, e seria menos codigo. Mas ai a convencao de cada mapa viraria
 * estado do renderizador, que e onde ela seria esquecida na primeira vez que
 * alguem trocasse o material — e o custo de gravar certo e pago uma vez, aqui,
 * numa ferramenta que roda a mao.
 */
async function ajustarLongitude(caminho, { espelhar, girar }) {
  if (!espelhar && girar === 0) return;
  const { PNG } = await import('pngjs');
  const png = PNG.sync.read(await readFile(caminho));
  const { width: L, height: A, data } = png;
  const saida = Buffer.alloc(data.length);
  const desloca = Math.round(girar * L);
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      const origem = espelhar ? L - 1 - x : x;
      const destino = (x + desloca) % L;
      data.copy(saida, 4 * (y * L + destino), 4 * (y * L + origem), 4 * (y * L + origem) + 4);
    }
  }
  png.data = saida;
  await writeFile(caminho, PNG.sync.write(png));
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  for (const n of NIVEIS) await mkdir(join(DESTINO, n.nome), { recursive: true });

  const manifesto = [];
  let total = 0;

  for (const mapa of MAPAS) {
    const ext = mapa.ext ?? 'jpg';
    const fonte = FONTES[mapa.fonte ?? 'sss'];
    // Duas formas de nomear o arquivo remoto, porque as duas fontes nomeiam de
    // jeitos diferentes: o Solar System Scope publica `8k_mars.jpg` e o USGS
    // publica o nome inteiro do mosaico. `origem` manda quando existe.
    const noCache = mapa.origem ?? `${mapa.melhor}_${mapa.arquivo}.${ext}`;
    process.stdout.write(`${mapa.corpo}/${mapa.papel}  ${noCache} ... `);
    const cache = await baixar(noCache, `${fonte.base}/${noCache}`);

    const niveis = {};
    if (mapa.semNiveis) {
      // O alfa do anel e uma faixa de 1 pixel de altura: reduzir destruiria a
      // estrutura fina das divisoes, que e justamente o que se quer ver.
      const alvo = join(DESTINO, '2k', `${mapa.arquivo}.${ext}`);
      await writeFile(alvo, await readFile(cache));
      niveis['2k'] = `texturas/2k/${mapa.arquivo}.${ext}`;
      niveis['4k'] = niveis['2k'];
      niveis['8k'] = niveis['2k'];
    } else {
      const ajuste = transformacaoDaLongitude(mapa.longitude);
      const larguraDaFonte = await larguraDe(cache);
      for (const n of NIVEIS) {
        if (n.exigeFonteDoTamanho && larguraDaFonte < n.largura) continue;
        const alvo = join(DESTINO, n.nome, `${mapa.arquivo}.jpg`);
        // Sem ajuste de longitude, um passo so: TIFF/JPEG -> JPEG.
        // Com ajuste, tres: o PNG intermediario existe porque e o unico
        // formato sem perda que o `pngjs` deste projeto ja sabe ler, e
        // reescrever JPEG duas vezes empilharia artefato de compressao sobre
        // artefato.
        if (ajuste.espelhar || ajuste.girar !== 0) {
          const temporario = `${alvo}.png`;
          await reduzir(cache, temporario, n.largura, 'png');
          await ajustarLongitude(temporario, ajuste);
          await reduzir(temporario, alvo, n.largura);
          await rm(temporario);
        } else {
          await reduzir(cache, alvo, n.largura);
        }
        niveis[n.nome] = `texturas/${n.nome}/${mapa.arquivo}.jpg`;
      }
    }

    for (const caminho of new Set(Object.values(niveis))) {
      total += (await stat(join(RAIZ, 'publico', caminho))).size;
    }

    manifesto.push({
      corpo: mapa.corpo,
      papel: mapa.papel,
      niveis,
      procedencia: mapa.procedencia,
      ...(mapa.nota ? { nota: mapa.nota } : {}),
      fonte: fonte.nome,
      url: fonte.url,
      licenca: fonte.licenca,
      resolucao_da_fonte: mapa.melhor ?? mapa.origem,
      ...(mapa.longitude
        ? {
            longitude_da_fonte: `${mapa.longitude.direcao === 'oeste' ? 'positiva para oeste' : 'positiva para leste'}, de ${mapa.longitude.minima}° a ${mapa.longitude.minima + 360}°`,
            nota_da_projecao:
              'a imagem entregue foi espelhada e/ou girada para a convenção do programa: longitude 0 no meio, crescendo para leste',
          }
        : {}),
    });
    console.log('ok');
  }

  const saida = {
    _leia_isto:
      'Gerado por ferramentas/baixar_texturas.mjs. Nao edite a mao: rode a ferramenta. ' +
      'O campo `procedencia` e obrigatorio e aparece no bloco de fontes do programa.',
    credito_obrigatorio:
      'Texturas por Solar System Scope (solarsystemscope.com), CC BY 4.0. ' +
      'Mosaicos das luas pelo USGS Astrogeology Science Center, domínio público.',
    gerado_em: new Date().toISOString().slice(0, 10),
    mapas: manifesto,
  };
  await writeFile(join(RAIZ, 'src', 'dados', 'texturas.json'), JSON.stringify(saida, null, 2) + '\n');

  console.log(`\n${manifesto.length} mapas, ${(total / 1048576).toFixed(1)} MB em publico/texturas/`);
  console.log('manifesto: src/dados/texturas.json');
}

await main();
