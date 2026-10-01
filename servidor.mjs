/**
 * O servidor local. Node puro, sem dependencia nenhuma.
 *
 * Por que existe um servidor, se o programa e uma pagina:
 *
 *   `file://` nao serve. O Chromium recusa `new Worker()` de uma origem opaca, e o fetch do
 *   JSON de efemerides, dos .ktx2 e do .bin do catalogo de estrelas e bloqueado por CORS.
 *   Nao ha como abrir esta pasta com duplo clique no HTML e ter o programa funcionando.
 *
 * O que ele NAO faz: acessar a internet. Ele escuta em 127.0.0.1 — nao em 0.0.0.0 — entao nem
 * outra maquina da mesma rede o enxerga. `testes/e2e/offline.spec.ts` e quem prova isso.
 *
 * Tres detalhes que parecem zelo e nao sao:
 *
 *   Porta fixa 8731    para que a URL seja sempre a mesma e para que abrir duas vezes reuse a
 *                      instancia que ja esta de pe em vez de subir uma segunda.
 *   Batida de 30 s     a pagina bate num endereco local enquanto estiver aberta. Sem batida,
 *                      o processo sai sozinho. E o que faz "fechar a aba" encerrar o programa,
 *                      sem pedir que ninguem va ao terminal matar nada.
 *   PUT das preferencias  elas vao para um ARQUIVO ao lado de dist/, como no programa antigo,
 *                      e nao para localStorage. Preferencia guardada no navegador se perderia
 *                      ao trocar de navegador e ficaria presa a origem (que inclui a porta).
 */
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA_PUBLICA = join(AQUI, 'dist');
const ARQUIVO_PREFERENCIAS = join(AQUI, 'preferencias.json');
const ARQUIVO_TRAVA = join(AQUI, '.servidor.trava');

const PORTA_PREFERIDA = 8731;
const ENDERECO = '127.0.0.1';
const SILENCIO_ATE_SAIR_MS = 30_000;
const TAMANHO_MAXIMO_PREFERENCIAS = 64 * 1024;

const semNavegador = process.argv.includes('--sem-navegador');

/** COOP/COEP hoje nao sao exigidos por nada; ficam para que uma diferenca entre o servidor de
 *  desenvolvimento e o de entrega nunca apareca so na entrega. CORP fecha o conjunto. */
const CABECALHOS_FIXOS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-cache',
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const PAGINA_SEM_BUILD = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<title>Sistema Solar — falta construir</title>
<style>body{background:#0c0e16;color:#e8eaf0;font:17px/1.6 system-ui,sans-serif;margin:0;
display:grid;place-items:center;min-height:100vh}main{max-width:36rem;padding:2rem}
code{background:#1a1d2c;padding:.15em .4em;border-radius:4px}</style>
<main><h1>Falta construir o programa</h1>
<p>A pasta <code>dist/</code> nao existe. Rode <code>npm install</code> e depois
<code>npm run build</code>, ou use o lancador (<code>run.command</code>, <code>run.sh</code>,
<code>run.bat</code>), que faz os dois sozinho.</p></main></html>`;

// ---------------------------------------------------------------- instancia unica

function instanciaViva() {
  if (!existsSync(ARQUIVO_TRAVA)) return null;
  try {
    const trava = JSON.parse(readFileSync(ARQUIVO_TRAVA, 'utf8'));
    process.kill(trava.pid, 0); // nao mata: so pergunta se o processo existe
    return trava;
  } catch {
    try { unlinkSync(ARQUIVO_TRAVA); } catch { /* ja saiu */ }
    return null;
  }
}

function abrirNavegador(url) {
  if (semNavegador) return;
  const comando =
    process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  try {
    spawn(comando[0], comando[1], { stdio: 'ignore', detached: true }).unref();
  } catch {
    console.log(`Abra no navegador: ${url}`);
  }
}

// ---------------------------------------------------------------- preferencias

async function lerPreferencias(res) {
  try {
    const conteudo = await readFile(ARQUIVO_PREFERENCIAS, 'utf8');
    JSON.parse(conteudo); // arquivo corrompido nao vira erro na tela: vira padrao
    responder(res, 200, TIPOS['.json'], conteudo);
  } catch {
    responder(res, 200, TIPOS['.json'], '{}');
  }
}

/**
 * Nao basta ser JSON valido: tem de ser um OBJETO.
 *
 * `42` e `"qualquer coisa"` sao JSON perfeitamente validos, e gravar um deles aqui deixaria o
 * carregador de preferencias recebendo um numero onde espera um objeto na proxima abertura.
 * O projeto antigo ja tinha a regra certa escrita: "Preferencia e conveniencia, nao pode virar
 * motivo de tela de erro." Barrar na gravacao e mais barato que tratar na leitura.
 */
function ehObjetoDePreferencias(texto) {
  try {
    const valor = JSON.parse(texto);
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  } catch {
    return false;
  }
}

function gravarPreferencias(req, res) {
  let corpo = '';
  let excedeu = false;
  req.on('data', (pedaco) => {
    corpo += pedaco;
    if (corpo.length > TAMANHO_MAXIMO_PREFERENCIAS) { excedeu = true; req.destroy(); }
  });
  req.on('end', async () => {
    if (excedeu) return responder(res, 413, TIPOS['.json'], '{"erro":"grande demais"}');
    if (!ehObjetoDePreferencias(corpo)) {
      return responder(res, 400, TIPOS['.json'], '{"erro":"esperava um objeto json"}');
    }
    try {
      await writeFile(ARQUIVO_PREFERENCIAS, corpo, 'utf8');
      responder(res, 204, null, '');
    } catch {
      responder(res, 500, TIPOS['.json'], '{"erro":"nao consegui gravar"}');
    }
  });
}

// ---------------------------------------------------------------- arquivos

function responder(res, codigo, tipo, corpo) {
  const cabecalhos = { ...CABECALHOS_FIXOS };
  if (tipo) cabecalhos['Content-Type'] = tipo;
  res.writeHead(codigo, cabecalhos);
  res.end(corpo);
}

/** Impede subir de pasta. `normalize` resolve os `..` e a checagem de prefixo faz o resto. */
function caminhoSeguro(url) {
  const bruto = decodeURIComponent(url.split('?')[0]);
  const relativo = normalize(bruto === '/' ? '/index.html' : bruto).replace(/^(\.\.[/\\])+/, '');
  const absoluto = join(PASTA_PUBLICA, relativo);
  return absoluto.startsWith(PASTA_PUBLICA) ? absoluto : null;
}

async function servirArquivo(res, url) {
  if (!existsSync(PASTA_PUBLICA)) return responder(res, 200, TIPOS['.html'], PAGINA_SEM_BUILD);
  const caminho = caminhoSeguro(url);
  if (!caminho) return responder(res, 403, TIPOS['.html'], 'caminho recusado');
  try {
    const info = await stat(caminho);
    if (!info.isFile()) throw new Error('nao e arquivo');
    const tipo = TIPOS[extname(caminho).toLowerCase()] ?? 'application/octet-stream';
    responder(res, 200, tipo, await readFile(caminho));
  } catch {
    responder(res, 404, TIPOS['.html'], 'nao encontrado');
  }
}

// ---------------------------------------------------------------- batida

let saidaAgendada = null;
function adiarSaida() {
  if (saidaAgendada) clearTimeout(saidaAgendada);
  saidaAgendada = setTimeout(() => {
    console.log('\nA pagina foi fechada. Encerrando o programa.');
    encerrar(0);
  }, SILENCIO_ATE_SAIR_MS);
}

function encerrar(codigo) {
  try { unlinkSync(ARQUIVO_TRAVA); } catch { /* ja saiu */ }
  process.exit(codigo);
}

// ---------------------------------------------------------------- servidor

const servidor = createServer((req, res) => {
  const url = req.url ?? '/';

  if (url === '/_batida') { adiarSaida(); return responder(res, 204, null, ''); }
  if (url === '/preferencias.json') {
    if (req.method === 'PUT') return gravarPreferencias(req, res);
    if (req.method === 'GET') return lerPreferencias(res);
    return responder(res, 405, null, '');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, null, '');
  return servirArquivo(res, url);
});

function subir(porta, jaTentouOutra) {
  servidor.once('error', (erro) => {
    if (erro.code !== 'EADDRINUSE' || jaTentouOutra) {
      console.error(`Nao foi possivel subir o servidor: ${erro.message}`);
      encerrar(1);
    }
    console.log(
      `A porta ${PORTA_PREFERIDA} esta ocupada por outro programa.\n` +
      `Subindo numa porta livre. O endereco desta vez sera diferente do de costume;\n` +
      `suas preferencias continuam guardadas, porque ficam em preferencias.json e nao no navegador.`,
    );
    subir(0, true);
  });

  servidor.listen(porta, ENDERECO, () => {
    const { port } = servidor.address();
    const url = `http://${ENDERECO}:${port}/`;
    writeFileSync(ARQUIVO_TRAVA, JSON.stringify({ pid: process.pid, porta: port }), 'utf8');
    console.log(`\n  O Sistema Solar esta aberto no navegador: ${url}`);
    console.log('  Feche a aba para encerrar o programa. Esta janela pode ficar como esta.\n');
    abrirNavegador(url);
    adiarSaida();
  });
}

const viva = instanciaViva();
if (viva) {
  console.log(`O programa ja esta rodando em http://${ENDERECO}:${viva.porta}/ — reaproveitando.`);
  abrirNavegador(`http://${ENDERECO}:${viva.porta}/`);
  process.exit(0);
}

for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => encerrar(0));
subir(PORTA_PREFERIDA, false);
