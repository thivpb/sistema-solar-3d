# Sistema Solar 3D

Simulador do Sistema Solar. Integração N-corpos simplética sobre efemérides do JPL, com a camada
educativa em português.

Sucede o `Sim_NewVer_1.0/` (Python + pygame, desenho 2D por CPU), que continua nesta mesma pasta,
intocado e funcionando. A física, os dados e os textos vêm de lá; o desenho é novo.

**Estado: F0 a F13 fechadas.** O programa abre, desenha os nove corpos da efeméride com textura,
rotação e anéis, desenha as treze luas, traz todo o conteúdo educativo, o laboratório de Fourier
e o sandbox. As 43 funcionalidades do contrato estão entregues — 31 como especificadas e 12 por
outro meio, com a nota de cada uma dizendo o quê e por quê. Não há linha parcial nem pendente.

**O que a última rodada mudou.** Chegar perto de um corpo virou o gesto central: o duplo clique
leva a câmera a três raios dele, e o resto do sistema desbota continuamente conforme se aproxima,
voltando a aparecer quando se afasta. Cinco luas ganharam mosaicos de imageamento real e o nível
8K entrou, só para o corpo que se está olhando. A interface foi reorganizada **por pergunta** em
vez de por widget: a barra de cima responde a *quando* e a *o que estou fazendo*, o painel responde
a *de onde vejo* e *qual corpo*, e sobre a cena não há mais nada clicável.

O que falta é fora das 43: as texturas em KTX2 (bloqueadas por um binário nativo que não instala
por npm) e a passada SDR pré-bloom das cenas douradas.

**O peso da entrega, dito por extenso.** O nível 8K levou `publico/texturas/` de 36 MB para
**150 MB**, e a pasta `dist/` inteira para 164 MB. Quando a decisão foi tomada a estimativa era de
uns 60 MB a mais; o número real é 114 MB, e vai escrito aqui em vez de ficar implícito. Metade
disso são cinco mapas — a Lua, Mercúrio, Vênus, as nuvens da Terra e Marte —, e o nível inteiro
sai de uma linha em `ferramentas/baixar_texturas.mjs` para quem preferir a pasta menor. Baixar a
qualidade do JPEG não compensa: medido, de 82 para 60 economiza só um quarto do peso, na única
camada cuja razão de existir é o detalhe.

**`three` continua num pacote só, de propósito.** Separá-lo em `manualChunks` faria as edições de
código pararem de invalidar 1 MB de cache — mas este programa é entregue como pasta e aberto por
duplo clique, não servido de um CDN: não há visita seguinte cujo cache se aproveite, e o custo
seria uma requisição a mais na única vez que importa.

O que dá para fazer:

- olhar o Sistema Solar de qualquer ângulo, de 31,5 UA até a órbita baixa de um planeta;
- acompanhar um corpo, comparar dois, ler a ficha de cada um com a procedência dos números;
- ver a órbita reescrita como cadeia de epiciclos, no laboratório de Fourier;
- criar corpos, ver a órbita que eles teriam antes de soltá-los, e desfazer.

## Como abrir

| Sistema | O que fazer |
|---|---|
| macOS | Duplo clique em **`run.command`**. Se o macOS barrar na primeira vez, clique com o botão direito e escolha **Abrir**. |
| Linux | `./run.sh` |
| Windows | Duplo clique em **`run.bat`**, ou `./run.ps1` no PowerShell |

Na primeira execução o lançador instala as bibliotecas e constrói o programa — leva um ou dois
minutos. Depois disso, abre direto. A pasta de entrega já vem com `dist/` pronto, e nessa não há
instalação nenhuma: só um servidor local sobe.

Feche a aba do navegador para encerrar o programa. Não é preciso voltar ao terminal.

## O programa não acessa a internet

Está afirmado quatro vezes na documentação do projeto anterior, e aqui virou teste: o
`testes/e2e/offline.spec.ts` aborta **toda** requisição que não seja para o servidor local e
exige que o programa abra do mesmo jeito. Todas as texturas, fontes e dados vão empacotados.

As únicas partes do projeto que tocam a rede estão em `ferramentas/`, e **nenhuma roda durante o
uso**:

| Ferramenta | O que faz | Quando roda |
|---|---|---|
| `gerar_efemeride.py` | posições e velocidades de partida, do JPL Horizons | uma vez. Veio do `Sim_NewVer_1.0` sem alteração, e o JSON que ele produziu está copiado **byte a byte** — é o que mantém a validação de ±100 anos valendo |
| `gerar_luas.mjs` | os elementos médios das treze luas, e o período sideral **medido** | uma vez |
| `conferir_luas.mjs` | o erro de cada lua contra o Horizons, numa janela retida | quando os dados das luas mudam |
| `gerar_estrelas.mjs` | o catálogo Yale, em 12 bytes por estrela | uma vez |
| `baixar_texturas.mjs` | os mapas de superfície, com a procedência de cada um | uma vez |

## Para desenvolver

```bash
npm install
npm run dev     # Vite com recarga automática, em http://localhost:5173
npm test        # tipos, lint, arquitetura, unidade e ponta a ponta
npm run build   # gera dist/
```

`npm test` é o portão. Ele roda, nesta ordem:

| Etapa | O que trava |
|---|---|
| `tipos` | TypeScript estrito, com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` |
| `lint` | globais proibidas no núcleo (`Math.random`, `Date.now`, `performance`, `fetch`) e leitura de layout no caminho por quadro |
| `arquitetura` | as sete regras de camada, em `.dependency-cruiser.cjs` |
| `unidade` | núcleo em ambiente `node` — se a física tocar `document`, quebra aqui; mais as duas guardas de texto: `honestidade.test.ts` amarra o que o programa afirma ao que ele faz, e `contrato.test.ts` exige que toda prova citada no `CONTRATO.md` exista |
| `e2e` | offline, acessibilidade, teclado, conteúdo dos modais, alcançabilidade transitiva das dicas, contraste dos rótulos medido em pixel, precisão de profundidade nos dois backends, laboratório, modo maquete e sandbox |

## O que ainda não foi conferido a olho

O portão da última fase, escrito no plano, é **abrir o `dist/` construído no Arc e no Safari, por
duplo clique, a partir da pasta de entrega**. Isso não foi feito: a suíte roda o bundle construído
num Chromium sem janela, e os dois backends de desenho são exercitados ali — WebGPU por padrão e
WebGL2 por `?render=webgl2` —, mas nenhum ser humano abriu o programa nos dois navegadores de
verdade. Quem receber a pasta faz isso em trinta segundos, e é o único passo que falta.

## Onde ler o resto

- **`CONTRATO.md`** — as 43 funcionalidades que a versão 2D entrega e esta tem de entregar, cada
  uma com o teste que a prova. É a régua do projeto.
- **`ARQUITETURA.md`** — as camadas, por que elas existem, e a tabela de armadilhas já pagas.

## O que o programa admite sobre si mesmo

Três blocos de texto, na Ajuda, dizem o que ele calcula, o que a tela simplifica e o que o modelo
não inclui. Eles não são decoração: `testes/honestidade.test.ts` amarra **cada licença declarada
a um fato do código, nos dois sentidos** — declarar uma licença que não se toma reprova igual a
tomar uma que não se declara.

A amarra nasceu de um defeito real. O "Modo maquete" tinha o alternador, o aviso falado e a
etiqueta "DISTÂNCIAS COMPRIMIDAS" na tela, e **não comprimia nada**. Por uma fase inteira o
programa afirmou ao usuário uma liberdade que não tinha tomado.

Os números que ele publica sobre o próprio erro:

| O quê | Quanto | Medido como |
|---|---|---|
| Desvio das posições contra a efeméride do JPL | abaixo de 0,5% da distância ao Sol em ±100 anos, Mercúrio no pior caso | `nucleo/efemeride.test.ts`, contra os pontos de validação do JSON |
| Interpolação entre passos de meio dia | 0,09 km, em Mercúrio | `nucleo/hermite.test.ts` |
| Posição das luas | 456 km (Deimos) a 52.636 km (Tritão) | contra o Horizons, em 2020–2040 — uma janela que o gerador dos dados nunca viu |
| Energia total ao longo do tempo | oscila, não cresce | visível ao vivo em "Mostrar dados técnicos" |

## Escolhas que talvez surpreendam

**As luas não entram no integrador.** Io dá uma volta em 1,77 dia; com o passo de meio dia seriam
três passos e meio por órbita, e nesse regime o integrador não integra, inventa. Elas são
propagadas por Kepler, fora da física, e o preço disso é o erro da tabela acima — medido e
publicado em vez de escondido. Em troca, a camada validada contra o JPL continua idêntica.

**O sandbox não arrasta nada.** O plano pedia arrastar o vetor de velocidade, com um diálogo
"Criar pelos números" como caminho acessível ao lado. Aqui o caminho sem arrasto é o único:
apontar, clicar, e um controle deslizante marcado em "redonda" e "escapa". A lição sobre
velocidade orbital é a mesma, e ninguém precisa de um caminho separado.

**TypeScript 5.9, não 7.** O 7 já saiu, mas a cadeia de lint com tipos ainda não o acompanha com
segurança. Nada aqui precisa do que ele traz, e um portão de testes que quebra por causa da
ferramenta é pior que uma versão menor.

**Sem `Sistema Solar.app`.** Um bundle de duplo clique sem janela de terminal foi construído e
descartado: o macOS recusa a um app sem assinatura o acesso a arquivos dentro de `~/Desktop`, e
liberar isso exigiria ir às Configurações do Sistema. O `run.command` é aberto por duplo clique
do mesmo jeito e não pede nada. O detalhe está em `ARQUITETURA.md`.

## Procedência e licenças do material visual

As texturas vão versionadas neste repositório porque o programa promete abrir sem rede e sem
instalação. Elas não são do projeto, e o crédito é obrigatório:

| Fonte | Licença | O que vem dela |
| --- | --- | --- |
| [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 | Os mapas dos nove corpos da física, da Lua e o panorama da Via Láctea |
| [USGS Astrogeology Science Center](https://astrogeology.usgs.gov/) | Domínio público (produto do governo dos EUA) | Os mosaicos de Io, Europa, Ganimedes, Calisto e Encélado |

A procedência **de cada mapa**, uma a uma — fonte, URL, licença, resolução da origem e uma nota
dizendo se é imagem, derivado ou reconstrução — está em `src/dados/texturas.json`, gerada por
`ferramentas/baixar_texturas.mjs`. O arquivo não é editado à mão, e `testes/procedencia.test.ts`
reprova qualquer textura que entre sem esses campos.

As efemérides são do [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) e os elementos das luas,
das fichas do JPL; a geração está em `ferramentas/`. O catálogo de estrelas é o Yale Bright Star.

O código em `src/`, `testes/` e `ferramentas/` é de Thiago Brito.
