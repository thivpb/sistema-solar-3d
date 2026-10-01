/**
 * Os testes de nucleo rodam em ambiente `node`, nao `jsdom`, de proposito.
 *
 * E rapido, mas o motivo principal e outro: se um modulo de src/nucleo/ um dia importar
 * algo que toca `document` ou `window`, o teste quebra na hora. E uma segunda barreira de
 * arquitetura, de graca, alem do dependency-cruiser.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const daPasta = (caminho: string) => fileURLToPath(new URL(caminho, import.meta.url));

export default defineConfig({
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
  test: {
    environment: 'node',
    include: ['testes/**/*.test.ts'],
    exclude: ['testes/e2e/**'],
    reporters: ['default'],
  },
});
