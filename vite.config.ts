/**
 * Build. Tres ajustes nao sao preferencia, sao requisito:
 *
 *   base: './'            a pasta de entrega tem de abrir de qualquer caminho, inclusive
 *                         de um pendrive montado com outro nome.
 *   assetsInlineLimit: 0  nada de embutir binario em base64. Uma textura embutida some do
 *                         controle do carregador progressivo e vira parte do bundle inicial.
 *   assetsInclude         .ktx2 e .bin nao estao na lista padrao do Vite. Sem isto eles
 *                         viram import quebrado em vez de URL.
 *
 * Os cabecalhos COOP/COEP existem no servidor de desenvolvimento para ficar em paridade com
 * servidor.mjs. Hoje nada depende de SharedArrayBuffer; a paridade e para que uma diferenca
 * entre desenvolvimento e entrega nunca apareca so na entrega.
 */
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath, URL } from 'node:url';

const daPasta = (caminho: string) => fileURLToPath(new URL(caminho, import.meta.url));

const CABECALHOS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default defineConfig({
  base: './',
  // As texturas sao copiadas verbatim para dist/ e referenciadas por caminho,
  // porque o carregamento e por demanda: quem decide se busca o 2K ou o 4K e a
  // distancia da camera, em tempo de execucao, e nao o empacotador.
  publicDir: 'publico',
  plugins: [preact()],
  resolve: {
    alias: {
      '@contratos': daPasta('./src/contratos'),
      '@nucleo': daPasta('./src/nucleo'),
      '@dados': daPasta('./src/dados'),
      '@app': daPasta('./src/app'),
      '@cena': daPasta('./src/cena'),
      '@rotulos': daPasta('./src/rotulos'),
      '@interface': daPasta('./src/interface'),
    },
  },
  assetsInclude: ['**/*.ktx2', '**/*.bin'],
  server: { port: 5173, strictPort: true, headers: CABECALHOS },
  preview: { port: 8731, strictPort: true, headers: CABECALHOS },
  build: {
    target: 'es2023',
    assetsInlineLimit: 0,
    /**
     * **Sem mapa de origem na pasta de entrega.**
     *
     * Ele pesava 5,7 MB num `dist/` de 41 MB — catorze por cento da entrega
     * para uma ferramenta que so serve a quem tem o codigo-fonte ao lado, e
     * quem tem o codigo-fonte roda `npm run dev`, que continua com mapa.
     */
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
