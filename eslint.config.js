/**
 * O que este arquivo pega e o dependency-cruiser nao pega: globais.
 *
 * `Math.random`, `Date.now`, `performance` e `fetch` nao sao imports — sao globais. O parse de
 * AST do teste antigo em Python nunca teria pego nenhuma delas, porque ele so olhava a lista de
 * imports. Sao exatamente as quatro que quebrariam, em silencio, garantias que este projeto
 * afirma por escrito:
 *
 *   Math.random / Date.now   quebram o determinismo do nucleo e o arquivo dourado
 *   performance              o relogio e injetado; ler o proprio relogio torna o teste de
 *                            orcamento incapaz de simular um quadro lento
 *   fetch                    "o programa nao acessa a internet"
 *
 * E a segunda regra, sobre leitura de layout no caminho por quadro: uma chamada a
 * getBoundingClientRect dentro do rAF forca layout sincrono. E o equivalente exato, no DOM, do
 * font.render() por quadro que o projeto antigo ja mediu (4,4 us -> 0,17 us com cache) e
 * resolveu. Medir texto se faz por measureText num canvas fora da tela; retangulo de painel se
 * obtem por ResizeObserver.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const LEITURAS_DE_LAYOUT = [
  'getBoundingClientRect',
  'getClientRects',
  'offsetWidth',
  'offsetHeight',
  'offsetTop',
  'offsetLeft',
  'clientWidth',
  'clientHeight',
  'scrollWidth',
  'scrollHeight',
  'getComputedStyle',
].map((property) => ({
  property,
  message:
    'Leitura de layout forca reflow sincrono. No caminho por quadro isto e proibido: ' +
    'meca texto com measureText num canvas fora da tela e obtenha retangulos por ResizeObserver.',
}));

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'publico/**', 'testes/e2e/**/*-snapshots/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2023 },
      parserOptions: {
        // Os arquivos de configuracao na raiz sao JS puro e nao estao no tsconfig. Sem isto o
        // lint com tipos recusa cada um deles com "not found by the project service".
        projectService: { allowDefaultProject: ['*.js', '*.mjs', '*.cjs', 'ferramentas/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  {
    name: 'nucleo-deterministico-e-offline',
    files: ['src/nucleo/**/*.ts', 'src/dados/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'performance', message: 'O relogio e injetado. Receba o tempo, nao o leia.' },
        { name: 'window', message: 'O nucleo roda sem navegador — e o teste em ambiente node prova.' },
        { name: 'document', message: 'O nucleo roda sem navegador.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'O nucleo e deterministico: o arquivo dourado e o teste de reversibilidade dependem ' +
            'disso. Receba a semente ou o valor por parametro.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'O relogio e injetado. `tDias` vem do simulador, nao do relogio da maquina.',
        },
      ],
    },
  },

  {
    // `fetch` so e permitido em quatro arquivos, cada um por um motivo escrito:
    //
    //   app/batida.ts        mantem o servidor local de pe
    //   app/preferencias.ts  le e grava o arquivo de preferencias
    //   cena/ceu/estrelas.ts carrega o catalogo BINARIO da pasta de entrega
    //   cena/texturas/*      carrega as texturas da pasta de entrega
    //
    // Os dois ultimos buscam arquivos que VAO JUNTO na entrega, por caminho
    // relativo — a mesma coisa que o `TextureLoader` faz por dentro. Em
    // qualquer outro lugar de src/, buscar alguma coisa significa depender de
    // algo que nao esta na pasta.
    //
    // O teste autoritativo do requisito offline continua sendo
    // `testes/e2e/offline.spec.ts`, que aborta toda requisicao externa de
    // verdade e exige que o programa abra igual. Esta regra e a barreira
    // barata, que avisa antes.
    name: 'so-quem-tem-motivo-escrito-busca-arquivo',
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      'src/app/batida.ts',
      'src/app/preferencias.ts',
      'src/cena/ceu/estrelas.ts',
      'src/cena/texturas/*.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'O programa nao acessa a internet. Os dados vao empacotados.' },
        { name: 'XMLHttpRequest', message: 'O programa nao acessa a internet.' },
        { name: 'localStorage', message: 'Preferencia vai para arquivo, pelo servidor local.' },
        { name: 'sessionStorage', message: 'Preferencia vai para arquivo, pelo servidor local.' },
      ],
    },
  },

  {
    name: 'caminho-por-quadro-nao-le-layout',
    files: ['src/app/laco.ts', 'src/cena/**/*.ts', 'src/rotulos/**/*.ts', 'src/rotulos/**/*.tsx'],
    rules: { 'no-restricted-properties': ['error', ...LEITURAS_DE_LAYOUT] },
  },

  {
    name: 'ferramentas-servidor-e-testes-rodam-em-node',
    files: [
      'ferramentas/**/*.ts',
      'ferramentas/**/*.mjs',
      'testes/**/*.ts',
      '*.config.ts',
      '*.js',
      '*.mjs',
      '*.cjs',
    ],
    languageOptions: { globals: { ...globals.node } },
    // O servidor fala com quem abriu o programa pela janela do terminal: e ali que ele imprime
    // o endereco e o aviso de que fechar a aba encerra tudo. console.log e a interface dele.
    rules: { 'no-console': 'off' },
  },
);
