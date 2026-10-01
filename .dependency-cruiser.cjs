/**
 * O lint de arquitetura. Sucessor autoritativo de tests/test_arquitetura.py.
 *
 * O docstring do teste antigo explica por que ele existe, e vale repetir aqui:
 *
 *   "A documentacao antiga deste projeto afirmava que core/ e ui/ eram separados, enquanto
 *    src/ui/hud.py importava um atalho da raiz e ninguem percebia. Uma afirmacao que nada
 *    verifica apodrece."
 *
 *   "Por que importa aqui especificamente: a regra 'a escala visual comprimida nunca altera a
 *    fisica' so se sustenta se o pacote de fisica nao puder nem ver o modulo que faz a
 *    compressao."
 *
 * As tres regras do teste antigo eram:
 *
 *   src/fisica   nao ve pygame, projecao, ui, app, dados
 *   src/dados    nao ve pygame, projecao, ui, app
 *   src/projecao nao ve ui, app
 *
 * As sete daqui sao as mesmas, traduzidas, mais tres que so passam a fazer sentido no navegador.
 * Roda dentro de `npm test`, e nao num script separado que ninguem chama.
 */
module.exports = {
  forbidden: [
    {
      name: 'nucleo-isolado',
      comment:
        'src/nucleo/ e a fisica. So pode ver a si mesmo e src/contratos/. Nem dados, nem app, ' +
        'nem cena, nem interface. E a traducao direta da primeira regra do teste antigo.',
      severity: 'error',
      from: { path: '^src/nucleo/' },
      to: {
        pathNot: ['^src/nucleo/', '^src/contratos/'],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'nucleo-sem-navegador',
      comment:
        'A fisica nao conhece three, preact, nem API de navegador. O relogio e INJETADO: se o ' +
        'nucleo pudesse ler performance.now() sozinho, o teste de determinismo perderia o sentido.',
      severity: 'error',
      from: { path: '^src/nucleo/' },
      to: { path: 'node_modules/(three|preact|@preact)' },
    },
    {
      name: 'dados-nao-ve-a-tela',
      comment:
        'src/dados/ sao fatos congelados com procedencia. Nao ve app, cena, interface nem rotulos. ' +
        'Pode ver nucleo e contratos, porque precisa devolver um EstadoSistema pronto.',
      severity: 'error',
      from: { path: '^src/dados/' },
      to: {
        path: ['^src/app/', '^src/cena/', '^src/interface/', '^src/rotulos/'],
      },
    },
    {
      name: 'cena-nao-ve-app',
      comment:
        'A cena le um Instantaneo e desenha. Se pudesse importar src/app/, entrariam acoes.ts e ' +
        'aplicar.ts junto, e com eles "a cena abre um modal" e "a cena despacha uma acao". ' +
        'E exatamente por isso que Instantaneo mora em src/contratos/ e nao em src/app/.',
      severity: 'error',
      from: { path: '^src/cena/' },
      to: { path: ['^src/app/', '^src/interface/'] },
    },
    {
      name: 'rotulos-puros-sao-puros',
      comment:
        'posicionador, oclusao, prioridade e medida sao geometria em espaco de tela. Sem preact e ' +
        'sem three eles rodam headless no vitest, e e isso que mantem o teste de colocacao de ' +
        'rotulos barato o bastante para ser fuzzado. Quem pode importar preact e camada.tsx.',
      severity: 'error',
      from: { path: '^src/rotulos/(posicionador|oclusao|prioridade|medida)\\.ts$' },
      to: { path: 'node_modules/(three|preact|@preact)' },
    },
    {
      name: 'interface-nao-ve-three',
      comment:
        'A interface e DOM composta DEPOIS do tonemapping. Se ela importasse three, a fronteira ' +
        'que garante que nenhum bloom lava o texto deixaria de ser estrutural e viraria promessa.',
      severity: 'error',
      from: { path: '^src/interface/' },
      to: { path: 'node_modules/three' },
    },
    {
      name: 'sem-ciclos',
      comment: 'Dependencia circular entre modulos proprios.',
      severity: 'error',
      from: { pathNot: '^node_modules/' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
