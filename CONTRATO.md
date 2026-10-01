# Contrato de funcionalidades

As 43 funcionalidades do `Sim_NewVer_1.0` (pygame, 2D) que a versão 3D tem de entregar.
Este arquivo existe desde o primeiro dia, antes de qualquer código de produto, porque o risco
número um deste projeto é terminar com física certa, 3D bonito e metade do conteúdo educativo
faltando — o que seria **perda líquida** em relação ao programa que já funciona.

Regras:

- **Proibido começar a fase N+1 com uma linha vermelha na fase N.**
- Coluna `prova`: o teste automatizado que a verifica, ou `manual:` seguido do roteiro de uma frase.
- Coluna `estado`: `pendente` · `feito` · `mudado` (entrega o mesmo valor por outro meio — a nota
  diz o quê e por quê) · `defeito` (não funciona direito no programa atual e tem de melhorar).

Legenda de fase: F0 fundação · F1 física · F2 interface acessível · F3 portão de precisão ·
F4 cena elaborada · F5 conteúdo · F6 luas · F7 sandbox · F8 entrega.

---

## Tempo

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 1 | Pausar e continuar, por botão escrito e por `Espaço` | F2 | `atalhos.test.ts` · `e2e/acessibilidade.spec.ts` | **feito** |
| 2 | Escada de velocidade 1 / 5 / 30 / 100 / 365 / 1825 / 3650 / 7300 dias por segundo, por `−` `+` e por `[` `]` | F2 | `atalhos.test.ts` · `nucleo/relogio.test.ts` | **feito** |
| 3 | Calibragem da máquina na abertura, limitando a escada ao que o computador entrega | F1 | `nucleo/simulador.test.ts` | **feito** |
| 4 | Detecção de atraso: descarta passos, nunca acumula dívida, e avisa por escrito | F1 | `nucleo/simulador.test.ts` | **feito** |
| 5 | Passo único de 0,5 dia por `.`, que pausa e avança exatamente um passo do integrador | F1 | `nucleo/tempoExato.test.ts` | **feito** |
| 6 | Voltar ao início (`R`): restaura a época, limpa rastros, reenquadra | F2 | `atalhos.test.ts` · `nucleo/trilha.test.ts` | **feito** |
| 7 | Data civil por extenso na lateral ("21 de setembro de 2026") | F5 | `nucleo/relogio.test.ts` · `e2e/conteudo.spec.ts` | **feito** |
| 8 | Linha de equivalência "1 segundo = 30 dias", em âmbar quando pausado | F2 | `manual:` pausar e conferir a cor e o texto | **feito** |

## Câmera e vista

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 9 | Zoom por roda e por `+` `−`, ancorado no cursor | F3 | `cena/selecao.test.ts` · `e2e/selecao.spec.ts` | **feito** — a âncora é uma homotetia com centro no cursor: `pivo' = ancora + (pivo − ancora)/f`, e o ponto sob o cursor não se mexe |
| 10 | Arrastar para orbitar; deslocar por `Shift`+arrastar e por `Shift`+setas | F3 | `atalhos.test.ts` · `e2e/acessibilidade.spec.ts` | **mudado · feito** — as setas orbitam e `Shift`+setas desloca, em paridade com arrastar esquerdo e direito; `CONTROLES` diz isso e `atalhos.test.ts` impede mapa e tabela de divergirem |
| 11 | Três enquadramentos: Sistema completo (31,5 UA), Planetas internos (1,75 UA), Acompanhar — com transição interpolando `log(escala)` | F3 | `cena/camera.test.ts` · `e2e/maquete.spec.ts` | **feito** — mais o quarto, "perto", em órbita baixa |
| 12 | Seguir e soltar um corpo, com anel **tracejado** no corpo acompanhado | F3 | `rotulos.test.ts` · `e2e/rotulos.spec.ts` | **feito** — o acompanhamento tem erro zero por construção, e o anel é tracejado e não de outra cor: sobre uma cena que vai do preto ao branco, um contorno que só muda de cor some em metade dos fundos |
| 13 | Alternar perspectiva ⇄ ortográfica cenital por `V`, preservando centro, zoom e alvo | F3 | `atalhos.test.ts` · `e2e/ortografica.spec.ts` | **feito** — é uma `OrthographicCamera` de verdade, e o que se preserva na troca é a altura visível no plano do alvo, que é a mesma grandeza nas duas projeções |
| 14 | Vista de cima por `T` | F3 | `atalhos.test.ts` · `cena/camera.test.ts` | **feito** |
| 15 | Leitura do campo de visão em UA | F3 | `e2e/maquete.spec.ts` | **mudado · feito** — em perspectiva vira "largura visível no plano do alvo" e "câmera a Y UA do alvo"; com a compressão ligada as duas **somem** e dão lugar ao aviso |
| 16 | Régua de escala com passos adaptativos de 0,01 a 50 UA | F3 | `e2e/maquete.spec.ts` | **mudado** — não há régua gráfica: as duas leituras numéricas do item 15 fazem o papel dela, e sobre escala comprimida são substituídas pelo aviso, nunca postas ao lado dele |

## Cena — tudo alternável e persistido

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 17 | Caminhos previstos (elipses osculadoras recalculadas do estado vivo) | F4 | `nucleo/efemeride.test.ts` · `e2e/precisao.spec.ts` | **feito** |
| 18 | Rastros percorridos, amostrados por **tempo simulado** (0,25% do período de cada corpo) | F4 | `nucleo/trilha.test.ts` | **feito** — e o teste trava a propriedade que se perde sem ele: a amostragem é por tempo simulado, então a trilha não muda de aparência com a taxa de quadros |
| 19 | Nomes dos corpos com anti-colisão e histerese | F4 | `rotulos.test.ts` · `e2e/rotulos.spec.ts` (contraste medido em pixel) | **feito** — anti-colisão, histerese, banda morta de movimento e escada de abreviação. O contraste do nome sobre a placa é medido no **pixel composto**, com o Sol florescendo atrás; o teste analítico é derivado dele |
| 20 | Anéis de distância em 1, 5, 10, 20 e 30 UA, rotulados | F4 | `e2e/maquete.spec.ts` | **feito** — e encolhem junto com as órbitas no modo maquete, senão marcariam o lugar errado |
| 21 | Campo de estrelas | F4 | `manual:` ligar e desligar "Estrelas" e conferir Sirius, Órion e a faixa da Via Láctea | **mudado · feito** — Yale Bright Star Catalogue, 8.404 estrelas com magnitude e temperatura medidas, na orientação celeste correta |
| 22 | Planetas no tamanho real — sem piso e **sem impostor**, para que sumam de verdade | F4 | `cena/camera.test.ts` · `e2e/precisao.spec.ts` | **feito** |
| 23 | Comprimir distâncias (raiz quadrada, ângulo preservado), com a régua linear substituída por aviso | F4 | `cena/escalaVisual.test.ts` · `e2e/maquete.spec.ts` | **mudado · feito** — vira "Modo maquete". Esteve **defeito** por uma fase inteira: o alternador, o aviso falado e a etiqueta na tela existiam e nada comprimia. Hoje comprime, e o teste mede também que a **luz não muda** |
| 24 | HUD técnico: integrador, passo, orçamento, `t` em dias, energia total, `\|L\|`, FPS, ms do quadro | F2 | `e2e/conteudo.spec.ts` | **feito** — passo, passos por segundo, milissegundos por quadro, desvio de energia, desvio do momento angular, corpos e backend. O desvio de energia é o número que sustenta a escolha do integrador: num simplético ele oscila e não cresce |

## Seleção e informação

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 25 | Selecionar A por clique na cena, pela lista lateral ou por teclado | F2 | `e2e/selecao.spec.ts` · `cena/selecao.test.ts` · `e2e/acessibilidade.spec.ts` | **feito** — o picking é em espaço de tela, e não por raio: os corpos são desenhados ampliados, então um raio acertaria o tamanho real e erraria o disco que se vê |
| 26 | Selecionar B por `Shift`+`Enter` na lista, ou pelos seletores do modal | F2 | `e2e/acessibilidade.spec.ts` · `e2e/conteudo.spec.ts` | **feito** |
| 27 | Distintivos A e B na cena, nos rótulos e na lista — **escritos**, nunca só por cor | F4 | `rotulos.test.ts` · `contraste.test.ts` · `e2e/rotulos.spec.ts` | **feito** — "A" e "B" desenhados nos rótulos, anel tracejado no acompanhado, e os três repetidos por extenso no rótulo acessível da lista |
| 28 | Ficha curta embutida: distância ao Sol, velocidade, período. O Sol tem ficha própria | F5 | `e2e/conteudo.spec.ts` · `nucleo/presetCanonico.test.ts` | **feito** — e o Sol tem ficha de outra natureza, sem período |
| 29 | Ficha completa com os sete blocos, incluindo o de fontes | F5 | `e2e/conteudo.spec.ts` · `e2e/acessibilidade.spec.ts` | **mudado · feito** — deixou de ser modal e virou uma seção da lateral, aberta por `F` ou pelo botão "Ficha inteira". A caixa cobria a cena: ler sobre um planeta exigia parar de olhar para ele, e fechá-la para ver o planeta apagava o que se acabara de ler |
| 30 | Modal "Matemática do Sol": posição e velocidade relativas ao centro de massa, aceleração resultante e a lista ordenada da puxada de cada sistema planetário, em m/s² | F5 | `e2e/conteudo.spec.ts` | **feito** — e a coluna de comparação é com a puxada de Júpiter, não "fração do total": as parcelas são vetores e se cancelam em parte, de modo que os módulos somavam 147% |
| 31 | Modal de comparação A/B ao vivo, com o aviso de que velocidade × período não é distância percorrida | F5 | `e2e/conteudo.spec.ts` | **feito** |

## Aprendizado

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 32 | Tutorial de primeira execução, dispensável para sempre | F5 | `e2e/conteudo.spec.ts` | **mudado · feito** — ganha um quarto passo, sobre a câmera 3D, e fechar no `Esc` também marca como visto |
| 33 | Ajuda com os **três blocos de honestidade** e a tabela de atalhos | F5 | `e2e/conteudo.spec.ts` · `textos.test.ts` · `honestidade.test.ts` | **mudado · feito** — `honestidade.test.ts` amarra cada licença declarada a um fato do código, **nos dois sentidos**: declarar o que não se faz reprova igual a fazer o que não se declara |
| 34 | Quatro atividades guiadas, cada uma com a resposta escrita junto | F5 | `e2e/conteudo.spec.ts` | **feito** |
| 35 | Seis dicas escritas, alcançáveis a partir da tela principal | F5 | `e2e/dicasAlcancaveis.spec.ts` (alcançabilidade **transitiva**, medida no DOM) | **feito** — e o teste reprova o desenho antigo: apagar a lista de dicas da tela de Atividades deixa a suíte vermelha |
| 36 | Laboratório de Fourier: elipse osculadora do corpo selecionado tirada do **estado vivo**, reconstruída por harmônicos, com desvio médio/máximo/atual e convergência | F5 | `nucleo/fourier.test.ts` · `nucleo/kepler.test.ts` · `e2e/laboratorio.spec.ts` | **mudado · feito** — lâmina de 40% com a cena pausada ao lado, cadeia de epiciclos rotulada "construção histórica — não é a física do modelo", e os coeficientes conferidos contra uma quadratura independente do código |

## Sistema

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 37 | Captura de tela em PNG, sem virar salto na data simulada | F4 | `manual:` capturar com o tempo correndo e conferir a data antes e depois | **feito** — a composição inclui rótulos e rodapé, e a leitura acontece dentro do quadro |
| 38 | Persistência de preferências, descartando o que é transitório (seleção, acompanhado, modal aberto) | F0 | `e2e/offline.spec.ts` · `e2e/conteudo.spec.ts` | **mudado · feito** — grava em **arquivo** por `PUT /preferencias.json`, não em `localStorage`, que é particionado por origem |
| 39 | "Texto maior" (1,25×), reescalando fontes, alvos e espaçamento | F2 | `e2e/layout.spec.ts` · `e2e/rotulos.spec.ts` | **feito** |
| 40 | Janela redimensionável a partir de 960×600, com a lateral virando sobreposição abaixo do breakpoint | F2 | `e2e/layout.spec.ts` (70 tamanhos × 2 escalas, medidos no DOM) · `e2e/acessibilidade.spec.ts` (reflow a 320 px) | **mudado · feito** — a prova era `layout.test.ts`, 560 combinações contra `src/interface/layout.ts`, um módulo que **nada no programa importava**: `medirLayout` e `aplicarVariaveis` nunca eram chamados e todo `var(--x, fallback)` do CSS resolvia para o fallback. O módulo foi apagado e o teste passou a medir a tela de verdade |
| 41 | Avisos temporários de 2,6 s confirmando cada ação | F2 | `e2e/acessibilidade.spec.ts` | **mudado · feito** — duas regiões `polite` separadas, porque uma só embaralha quando se segura `]` |
| 42 | Navegação completa por teclado, com foco visível só no uso por teclado e foco preso em modais | F2 | `e2e/acessibilidade.spec.ts` | **feito** |
| 43 | Rótulo acessível em todo controle ("Mostrar estrelas. Ligado.") | F2 | `e2e/acessibilidade.spec.ts` | **feito** |

---

## O que é novo, e portanto não conta como paridade

Entra depois das 43, e nunca no lugar delas.

| Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|
| 13 luas cinemáticas, com a deriva medida e publicada | F6 | `nucleo/luas.test.ts` · `e2e/conteudo.spec.ts` | **feito** — o desvio vai de 456 km em Deimos a 52.636 km em Tritão, medido contra a efeméride numa janela de vinte anos que o gerador dos dados nunca viu |
| Rotação e obliquidade reais aplicadas às malhas | F4 | `cena/orientacao.test.ts` | **feito** |
| Anéis com as duas sombras | F4 | `e2e/precisao.spec.ts` | **feito** |
| Modo sandbox: criar corpos com a órbita prevista e desfazer | F7 | `nucleo/sandbox.test.ts` · `e2e/sandbox.spec.ts` | **feito** |
| O mesmo resultado **sem arrastar** (WCAG 2.2, 2.5.7) | F7 | `e2e/sandbox.spec.ts` | **mudado · feito** — não existe caminho com arrasto a que dar alternativa: o único caminho é apontar, clicar e usar um controle deslizante, que o teclado opera |
| Distintivo permanente "sistema modificado", com o botão de voltar junto | F7 | `e2e/sandbox.spec.ts` | **feito** |
| Guarda de periastro e guarda de vizinhança, com a saída escrita | F7 | `nucleo/guardaPeriastro.test.ts` · `nucleo/sandbox.test.ts` | **feito** |
| Quarto enquadramento "Perto do corpo", até órbita baixa | F3 | `cena/camera.test.ts` · `e2e/precisao.spec.ts` | **feito** |
| "Ver como tabela" — a cena descrita em palavras, para leitor de tela | F2 | `e2e/conteudo.spec.ts` | **feito** — e as luas entraram nela: elas eram desenhadas e rotuladas e não existiam para quem usa leitor de tela |
| Modo maquete que de fato comprime, e não mexe na luz | F4 | `cena/escalaVisual.test.ts` · `e2e/maquete.spec.ts` | **feito** |
| O texto de honestidade amarrado ao código, nos dois sentidos | F5 | `honestidade.test.ts` | **feito** |
| Contraste dos rótulos medido no pixel composto | F4 | `e2e/rotulos.spec.ts` | **feito** — e o teste analítico passou a ser derivado dele |
| Lista de corpos em dois níveis, com as luas agrupadas sob o planeta | F6 | `e2e/acessibilidade.spec.ts` · `e2e/conteudo.spec.ts` | **feito** — `listbox > group > option`, e não `tree`: um `tree` tomaria a seta direita para abrir nós, e ela é a que anda na lista |
| Luas com três estados escritos: com · sem · só elas | F6 | `e2e/conteudo.spec.ts` | **feito** — em "só elas" os planetas continuam desenhados, porque uma lua sem o planeta dela não diz em torno de quê gira |
| Modo imersivo: tela cheia, controles recuados e câmera com W A S D | F4 | `voo.test.ts` · `e2e/imersivo.spec.ts` | **feito** — voar é transladar o pivô, e não uma segunda câmera: a origem flutuante, as fatias de profundidade e o picking continuam valendo sem exceção |
| As licenças visuais continuam escritas dentro do modo imersivo | F4 | `e2e/imersivo.spec.ts` | **feito** — esconder a ampliação e a exposição no modo mais bonito seria escondê-las exatamente onde mais importam |
| Shift+seta desloca a câmera na mesma unidade que o arrasto do mouse | F3 | `atalhos.test.ts` · `e2e/imersivo.spec.ts` | **defeito corrigido** — a tecla mandava `48` com o comentário "pixels por toque" e isso chegava cru em `deslocar(camera, dxUa, dyUa)`: 48 UA por toque, num sistema de 31,5 UA de raio. A ação passou a carregar fração da altura visível, e a conversão acontece num lugar só |
| Orçamento de controles com fiscal próprio | F8 | `e2e/orcamento.spec.ts` | **feito** — o arquivo era citado por `BarraSuperior.tsx` e não existia no disco: a afirmação ficava, o fiscal não. Os tetos foram medidos no desenho de hoje e postos um acima do observado |
| Doze cenas douradas, cada backend contra a própria imagem | F8 | `e2e/douradas.spec.ts` | **parcial** — as 24 imagens existem e reprovam regressão estrutural (ordem de desenho, orientação, corpo faltando). Não reprovam regressão fina: o gancho pré-bloom que o plano pedia não existe, e medido depois do bloom o ruído de driver chega a 0,2% dos pixels em cena com muita linha fina. O limite de cada cena é o ruído MEDIDO dela, vezes três |
| "Sem procedência, não grava", verificado | F8 | `procedencia.test.ts` | **feito** — e ele achou uma falta: `derivaDasLuas.json` não declarava fonte nenhuma. Corrigido no gerador, não no arquivo |
| Conferência cruzada do polo IAU, em todos os corpos | F4 | `cena/orientacao.test.ts` | **feito** — e ela achou DOIS defeitos de dados. A IAU 2015 publica o polo de Marte como uma constante mais um termo de amplitude 1,591274°, e só a constante tinha sido transcrita: o eixo estava 1,55° torto e a obliquidade derivada dava 23,92° contra os 25,19° escritos na linha ao lado. Netuno tinha o mesmo problema, com 0,5°. Agora os oito batem dentro de 0,04° |
| Rótulos ancorados POR QUADRO, com o desvio suavizado | F4 | `ancoragem.test.ts` · `e2e/rotulos.spec.ts` | **feito** — dois comentários afirmavam que a ancoragem acompanhava o quadro e o único caminho até o DOM era a publicação do estado, a 8 Hz. Medido: a placa ocupava 8 posições distintas em 40 quadros de giro, e agora ocupa 40. O que se suaviza é o DESVIO, nunca a posição: suavizar a posição faria a placa perseguir o corpo com atraso |
| Casca de atmosfera no limbo e coroa do Sol | F4 | `honestidade.test.ts` · `e2e/douradas.spec.ts` | **feito** — as duas entram como licença declarada. O halo calcula o caminho da vista dentro de uma casca da altura de escala da NASA, e multiplica pela mesma penumbra do terminador: ele acende no limbo iluminado e some no lado noturno. A coroa existe porque o brilho que nasce do disco não sobrevive ao zoom — de Netuno o Sol tem menos de um pixel |
| Passo curto anunciado na tela enquanto está ligado | F7 | `e2e/sandbox.spec.ts` | **feito** — e o teto da escada de velocidade passou a ser recalculado a partir do passo de agora: com ele congelado, o passo curto deixava a simulação permanentemente atrasada e o único sinal era o aviso de atraso, que parece defeito da máquina |
| Duplo clique na cena leva a câmera ATÉ o corpo, e o resto do sistema desbota | F9 | `cena/foco.test.ts` · `e2e/foco.spec.ts` | **feito** — o duplo clique enquadrava a *órbita* (afélio × 1,25): a textura, o terminador com penumbra e as sombras do anel eram carregados e nunca vistos. Agora ele enquadra `3R`, o corpo ocupa 80% da altura, e um escalar contínuo em `escala/foco.ts` apaga órbitas, anéis e nomes conforme se chega perto. O que desbota é auxílio de desenho — nenhuma malha é tocada —, e a atenuação MULTIPLICA: quem desligou "Caminhos previstos" não os vê voltar |
| O corpo inteiro aparece: o lado noturno deixou de ser preto | F14 | `e2e/ladoNoturno.spec.ts` | **defeito corrigido** — a cor era `dia × luz × irradiância`, e `luz` é exatamente zero na noite. Medido: Marte a três raios com o Sol atrás saía com **o disco inteiramente preto**, e o único desenho que sobrava era o arco da atmosfera no limbo. O mapa de 8K estava carregado, o eixo estava certo pelo polo da IAU, e não havia nada para ver. O lado noturno passou a receber 14% da luz do meio-dia — a mesma luz, com um mínimo, e não uma segunda lâmpada. O teste prende o valor pelos DOIS lados: com o piso em 0 reprova "a noite saiu preta", com o piso em 1 reprova "a noite está clara demais" |
| A esfera dos corpos estava NOVENTA GRAUS fora de tudo o mais | F14 | `cena/esfera.test.ts` · `e2e/orientacaoDaTextura.spec.ts` | **defeito corrigido, o mais grave da rodada** — `SphereGeometry` do three.js constrói os polos em ±Y, e todo o resto do programa trata +Z como polo: a construção da IAU, o achatamento (que espremia o eixo Z), `poloDoCorpo`, e o plano dos anéis. **O polo da textura estava desenhado sobre o equador do corpo.** Fotografado: apontando a câmera pelo +Z da Terra apareciam a América do Sul e a África, e era pelo +Y que apareciam a calota do Ártico e a Groenlândia. A inclinação de cada planeta era desenhada em torno do eixo errado — inclusive os 98° de Urano, que o projeto usa como cena dourada. **Nenhum teste pegava**, e o motivo é instrutivo: `orientacao.test.ts` mede a MATRIZ, que sempre esteve certa, e as 24 imagens douradas foram gravadas já com o defeito dentro, travando o erro em vez de acusá-lo. Faltava perguntar onde a TEXTURA cai na GEOMETRIA |
| Esconder o painel APAGAVA a simulação | F14 | `e2e/layout.spec.ts` | **defeito corrigido, o mais destrutivo achado** — `RenderTarget.setSize` descarta o recurso de GPU do alvo HDR, e o `RenderPipeline` que compõe esse alvo na tela ficava lendo o que não existia mais: **o canvas ficava preto**. Medido na cena de partida: brilho médio 5,9 antes de esconder o painel e **0,76** depois, e não voltava ao mostrar o painel — só um redimensionamento de janela, que passa por outro caminho, devolvia alguma imagem. Ou seja: um botão da barra de cima, ao lado da Ajuda, apagava o programa. O alvo passou a ser **recriado** em vez de redimensionado. Por que nada pegava: `precisao.spec.ts` esconde e mostra o painel, mas mede `__projecoes`, que vem da CPU e continua perfeitamente correta com a tela preta; e as douradas nunca redimensionam. Faltava alguém olhar para os PIXELS depois de mudar de tamanho |
| E agora há um teste de ponta a ponta com resposta conhecida | F14 | `e2e/orientacaoDaTextura.spec.ts` | **feito** — a Lua é travada por maré, então da Terra vê-se sempre a face próxima, a dos grandes mares escuros; a oculta quase não tem mar. A diferença é enorme e mensurável, e só sai certa se a matriz, a geometria, o meridiano derivado e a convenção do mapa estiverem certos ao mesmo tempo. Medido: com a esfera 90° fora, a área escura cai de 12%+ para 6,1% |
| A sombra do anel de Saturno lia um mapa de 1×1, para sempre | F14 | `e2e/ladoNoturno.spec.ts` | **defeito corrigido** — o nó que amostra o anel para calcular a sombra sobre o planeta era criado com o objeto `Texture` do instante da montagem, que é sempre o marcador de 1 pixel. `trocarMapa('anel', …)` escrevia no nó do anel e nunca alcançava este. O anel desenhava as faixas e a Divisão de Cassini, e a sombra dele sobre o planeta era uma tira de profundidade óptica constante — dois desenhos do mesmo anel, lado a lado, discordando, enquanto o comentário do código dizia que os dois liam "o MESMO mapa" |
| A barra de cima rolava de lado e escondia o botão de acelerar o tempo | F14 | `e2e/layout.spec.ts` | **defeito corrigido** — a 320 px o grupo de tempo pedia 44 + 44 + 103 + 155 px e escorria para fora. A **página** não rolava — `.barra` tem `overflow-y: auto`, e o navegador computa `overflow-x: auto` junto —, então o teste de refluxo passava verde enquanto a BARRA rolava por dentro, escondendo o "+" e a data atrás de uma rolagem que ninguém procura numa barra de ferramentas. Os grupos passaram a quebrar em linha, a data a ceder espaço, e a barra a `overflow-x: clip`. A guarda nova mede `scrollWidth` da própria barra, e não só o da página |
| Três avisos do visor eram desenhados no mesmo ponto | F14 | `e2e/orcamento.spec.ts` | **defeito corrigido** — o distintivo de sistema modificado, a tarja de "não está acompanhando" e a pílula de passo curto usavam os três o mesmo `top: 0.75rem; left: 50%; translateX(-50%)`, com `z-index` incoerente. E eles acendem juntos com facilidade: o passo curto entra sozinho quando o computador não acompanha, que é exatamente quando o aviso de atraso também acende. Como o fundo tem 0,86 de opacidade, o texto de baixo vazava pelo de cima e os dois ficavam ilegíveis. Agora são uma faixa em coluna |
| Entrar em "Criar" com o painel escondido era um beco sem saída | F14 | `e2e/sandbox.spec.ts` | **defeito corrigido** — `PainelDeCriacao` só existe dentro da lateral, e o botão que esconde a lateral fica ao lado do próprio segmentado de modo, na mesma faixa. Escolher "Criar" com ela escondida não mostrava nada: nem o tipo de corpo, nem a mira, nem o botão de criar. Clicar na cena desenhava uma elipse de previsão solta, sem texto e sem forma de confirmar. Entrar em Criar agora abre o painel, pelo mesmo motivo que entrar em Voar pede tela cheia |
| O painel entrava como obstáculo de rótulo com 8 px, e ele tem 340 | F14 | `e2e/rotulos.spec.ts` | **defeito corrigido** — acima do ponto de quebra o painel fica ao lado da cena e a tira era inofensiva porque era inútil; abaixo de 1000 px ele vira sobreposição opaca e os nomes da faixa direita eram desenhados atrás dele, gastando uma das dezoito vagas do teto. O retângulo passou a ser **medido do próprio painel**: `--largura-lateral` são 20rem, e 20rem não são 320 px — a raiz tem 17 px de fonte, e com "Texto maior" tem 21. A guarda mede a ENTRADA do cálculo, porque a saída não distingue as duas versões quando nenhum corpo calha de cair naquela faixa |
| A sombra do anel sobre o planeta também deixou de ser um vazio | F14 | `e2e/ladoNoturno.spec.ts` | **feito** — o piso entra DEPOIS da sombra do anel, e não antes: a faixa que os anéis projetam sobre Saturno passou a ser uma sombra com a superfície dentro, e não uma fita preta atravessando o planeta. Os próprios anéis já tinham um piso escrito à mão como `luz*0,9 + 0,1`, sem explicação; agora é a mesma constante, porque é a mesma ideia |
| A rotação desenhada tem um teto, medido em pixels por quadro | F14 | `cena/giroVisivel.test.ts` · `e2e/giro.spec.ts` | **defeito corrigido** — a escada de tempo vai a **20 anos por segundo**, e ali Marte dá milhares de voltas por segundo contra sessenta quadros: dois quadros seguidos mostravam lados opostos do planeta, e a textura virava um serrilhado que piscava. O teto é em pixels, e não em graus, porque o mesmo giro é invisível num disco de três pixels e um borrão num de seiscentos. Medido, com Marte a 319 px de raio: **179 px por quadro sem o teto, 1,67 com ele**. Abaixo de 8 px de raio o fator é exatamente 1, então a vista geral e todas as douradas continuam intactas |
| E o teste do teto de giro media a si mesmo | F14 | `e2e/giro.spec.ts` | **defeito corrigido, no próprio teste** — ele comparava o resultado com `PIXELS_POR_QUADRO`, importado do módulo sob medição: subir a constante subia junto o limite da comparação, e o teste passava verde com o teto desligado. Provado ao tentar sabotar o código e ver o teste continuar verde. O limite passou a ser um número escrito no teste, com a medição ao lado |
| O voo funciona também para as treze luas | F9 | `e2e/foco.spec.ts` | **defeito corrigido** — `indiceDe` procura só em `catalogo.corpos` e devolve −1 para lua nenhuma, e a transição decidia o destino por `i >= 0`: voar até Io levava a câmera ao **Sol** por 0,45 s e só então ela saltava para Io num quadro. Medido pelo pivô: agora ele é visto no meio do caminho, que é o que um salto nunca produz |
| A roda do mouse continua viva DURANTE o voo | F9 | `e2e/foco.spec.ts` | **defeito corrigido** — `ajustar-zoom` era o único efeito de câmera que não cancelava a transição: a roda era escrita e sobrescrita no mesmo quadro, e o raio saltava no prazo fixo. Sem isso, "ao ir tirando o zoom vamos nos afastando" não existia |
| A interface reorganizada por PERGUNTA, e não por widget | F11 | `e2e/orcamento.spec.ts` · `e2e/acessibilidade.spec.ts` · `e2e/layout.spec.ts` | **feito** — a barra respondia a três perguntas misturadas e tinha seis grupos; agora tem **três** e responde a duas: *quando* (pausa · velocidade · a data, que subiu da lateral) e *o que estou fazendo* (Explorar · Criar · Voar). O enquadramento desceu para o painel, junto das outras perguntas de câmera. O painel passou de sete blocos para **quatro**, cada um com título escrito, e "Mais opções" — que não é uma pergunta, é uma gaveta de sobras — virou três gavetas nomeadas: *Mais opções* (a cena), *Leitura* (o leitor) e *Ir para* (destinos) |
| Sobre a cena não há NADA clicável | F11 | `e2e/orcamento.spec.ts` | **feito** — eram três botões soltos num canto do canvas, sem grupo e sem título, disputando atenção com o que a cena mostrava. Que nunca tenham pertencido ali já estava escrito no CSS: o modo imersivo precisava de uma regra própria para escondê-los. O teto virou **zero**, que é afirmação mais forte que "poucos". A única exceção é o distintivo de sistema modificado, que carrega a saída junto e só aparece depois de um ato da própria pessoa |
| Os controles de marcação recuam, em vez de disputar com a cena | F11 | `botoes.test.ts` · `contraste.test.ts` · `e2e/acessibilidade.spec.ts` | **feito** — a caixa em repouso usava `--separador` (#788cb4), quase a cor do texto: vinte caixas vazias eram vinte retângulos claros competindo com a cena. Agora ela é um contorno em `--grade` e só se preenche quando marcada. O segmentado perdeu a moldura externa e virou trilho com pílula. E `.alternador` ganhou os 44 px que `.botao` obedecia desde sempre — **na linha inteira**, e não na caixinha de 1,35rem |
| As setas navegam dentro de um grupo exclusivo | F11 | `botoes.test.ts` | **defeito corrigido** — o cabeçalho de `controles.tsx` prometia que "as setas navegam entre as opções" desde a primeira versão, e não havia seta nem `tabIndex`: os três botões eram três paradas de Tab. Agora há roving tabindex, com Home e End, e `stopPropagation` — sem ele a mesma seta escolheria a opção **e** giraria a câmera, porque as quatro setas já são atalhos globais |
| A ajuda de uma opção não entra no NOME dela | F11 | `botoes.test.ts` · `e2e/acessibilidade.spec.ts` | **defeito corrigido** — era um `<small>` dentro do `<label>`, e tudo o que está dentro de um rótulo entra no nome acessível: o leitor de tela lia a frase inteira antes de dizer "caixa de seleção, marcada", a cada passagem. Agora é uma irmã ligada por `aria-describedby` |
| `base.css` e `tema.ts` dizem a MESMA cor | F11 | `contraste.test.ts` | **defeito corrigido** — as duas listas sempre foram duas cópias e ninguém as comparava. Achou duas divergências reais: `--painel` e `--texto-fraco`. O contraste era conferido em valores que a tela não usava |
| As douradas remedidas: de 0,83% para 0,01% | F11 | `e2e/douradas.spec.ts` | **feito** — os tetos antigos não mediam ruído de driver: mediam que as imagens tinham sido fotografadas em datas de simulação diferentes. Com a captura ancorada em `tDias = 0`, **vinte e três das vinte e quatro cenas dão zero pixel de diferença** em três execuções. O teto caiu cem vezes |
| Cinco luas com mosaico de imageamento real | F12 | `procedencia.test.ts` · `honestidade.test.ts` | **feito** — doze das treze luas eram uma `DataTexture` de **1×1 pixel** com a cor média, em qualquer distância: a 3 px ninguém via, e com o zoom viravam bolas lisas. Io, Europa, Ganimedes e Calisto entraram com os mosaicos Voyager/Galileo e Encélado com o da Cassini, do USGS Astrogeology, em domínio público. As outras oito continuam com a cor média **e a ficha diz por quê**: não existe mosaico global delas |
| A convenção de longitude de cada mosaico, lida do rótulo publicado | F12 | `honestidade.test.ts` | **feito** — os cinco mosaicos **não concordam entre si**: Io e Encélado vão de −180° a +180° com longitude positiva para oeste, Europa e Calisto de 0° a 360° também para oeste, e Ganimedes de 0° a 360° para leste. Ignorar isso não daria erro nenhum: daria uma lua bonita com os acidentes no lugar errado, espelhada, e ninguém notaria. Cada imagem foi espelhada e girada conforme o rótulo PDS dela antes de entrar. O que **não** foi feito, e está escrito no bloco de honestidade, é conferir o resultado contra uma fotografia de referência |
| Nível 8K, só no corpo que se está olhando | F12 | `cena/texturas.test.ts` | **feito** — o limiar é **6 raios**, o dobro do enquadramento "perto": na prática um corpo por vez chega lá. A escada virou função pura, e o teste afirma a propriedade que ela existe para ter — ponto fixo, nenhuma oscilação na fronteira, e nunca um pulo de 2K direto para 8K. O 8K só é gerado quando a fonte tem 8192 pixels de verdade |
| A régua embaixo da cena deixou de marcar zero ao aproximar | F12 | `formato.test.ts` | **defeito corrigido** — a três raios de Io as duas leituras diziam "0,0000 UA", que são 5.464 km. A régua parava de medir exatamente quando alguém estava olhando para ela, e o defeito só ficou visível porque chegar perto virou o gesto central. A unidade agora acompanha a grandeza, e `formato.ts` recolheu as cinco cópias de `numero` que havia em `src/` — com duas regras diferentes entre elas |
| O terceiro nível de frequência, que `estado.ts` afirmava ter | F13 | `e2e/rotulos.spec.ts` · `e2e/precisao.spec.ts` | **defeito corrigido** — o cabeçalho descrevia "os números do HUD, por `textContent`, com a string comparada com a anterior", e não havia **nenhum** `textContent` em `src/`: iam na árvore Preact, republicada a 8 Hz. Invisível enquanto aproximar não era um gesto; com o zoom, a régua andava aos saltos de 125 ms com a cena a sessenta. As duas leituras passaram a ser escritas por fora do Preact, por `data-leitura` |
| Menos trabalho por quadro, medido e não suposto | F13 | `nucleo/trilha.test.ts` · `e2e/precisao.spec.ts` | **feito** — `Trilha.pontos()` alocava um `Float64Array` de 10 KB por corpo por quadro, ~5,4 MB/s de lixo para ser copiado e descartado no mesmo instante; agora devolve uma vista reutilizada, e o teste afirma que é o **mesmo objeto**. `projetar()` — que roda oclusão O(n²) — passou a valer por quadro desenhado. A ancoragem dos rótulos deixou de varrer o DOM duas vezes por quadro, com a invalidação por `MutationObserver`: a contagem de filhos pareceria bastar e teria um buraco silencioso, porque um corpo que troca de forma substitui o nó sem mudar o número deles. E o `dist/` perdeu os 5,7 MB de mapa de origem |
| As buscas por chave viraram tabela — e a tabela nascia VAZIA | F13 | `e2e/douradas.spec.ts` · `e2e/rotulos.spec.ts` | **defeito corrigido, achado pelas douradas** — `indiceDe` era uma varredura linear e virou um `Map`, preenchido em `publicarMudanca`, que é por onde a lista muda. Só que `publicarMudanca` não roda na abertura: o programa inteiro começava com índice −1 para todo mundo, o sujeito da exposição virava nenhum, e `jupiter-e-as-galileanas` saiu com **74% dos pixels diferentes**. `rotulos.spec.ts` acusou junto, pelo outro lado — com a exposição errada o Sol estourava e o nome da Terra, por cima do brilho, caía para 1,35:1. Um cache que nasce vazio é um cache errado até a primeira escrita, e aqui a primeira escrita vinha de um gesto que pode nunca acontecer |
| A medida de contraste dos rótulos tinha DOIS defeitos, e os dois nela mesma | F13 | `e2e/rotulos.spec.ts` | **defeitos corrigidos, no próprio teste** — (1) ela comparava a foto da tela com retângulos lidos do DOM algumas centenas de milissegundos depois, e uma placa ainda se acomodando andava no meio; agora espera as placas pararem antes de fotografar. (2) Ela agrupava pixels por **cor RGB exata** e exigia quatro iguais para aceitar um glifo — o que vale sobre fundo chapado e falha sobre gradiente: a placa de "Terra" caiu sobre o brilho do Sol, onde cada pixel da letra sai com uma cor diferente do vizinho, nenhuma alcançava quatro, e a medida concluía que a placa estava vazia. Agrupa por faixa de luminância, e o fundo passou a ser a **mediana** em vez da cor mais comum, que tinha 4% da caixa. O resultado oscilava entre 1,31:1 e 3,00:1 sem que a legibilidade mudasse; agora é estável — e continua reprovando: com a placa a 5% de opacidade dá 1,16:1 |
| Escolher um corpo não move a cena | F9 | `e2e/layout.spec.ts` | **defeito corrigido** — `.corpo` era `flex: 1 1 auto`, e base `auto` faz a altura sair do conteúdo: o conteúdo é o `<canvas>`, cujo tamanho intrínseco são os atributos que o próprio programa escreve depois de medir a caixa. Escolher Júpiter trocava o rótulo de um botão, a barra caía de 97,5 px para 82 e a cena INTEIRA subia 15,5 px. A consequência não era o salto, que passa por piscada: era que **nenhum duplo clique na cena funcionava**, porque os dois cliques chegavam com `y` 15,5 px diferente contra 4 px de folga. Consertado dos dois lados — base zero no CSS, e a comparação do duplo clique em coordenadas de tela |

---

## Onde está cada coisa, hoje

<!-- contagem: feito=31, mudado=12 -->

| Estado | Quantos | O que significa |
|---|---|---|
| **feito** | 31 | entregue e com a prova citada rodando no `npm test` |
| **mudado** | 12 | entrega o mesmo valor por outro meio; a nota da linha diz o quê e por quê |
| **parcial** | 0 | — |
| **pendente** | 0 | ainda não existe |

As três linhas que ficaram `parcial` por fases — 9, 12 e 13 — estavam prontas havia tempo: o
picking, o anel tracejado e a câmera ortográfica foram entregues e as notas nunca foram
atualizadas. É a mesma classe de defeito que a auditoria abaixo descreve, com o sinal trocado:
antes o contrato afirmava prova que não existia; aqui ele negava trabalho que existia.

**Os quatro que faltavam foram feitos.** Este parágrafo dizia que faltavam o picking (9 e 25), o
anel tracejado no corpo acompanhado (12), a câmera ortográfica de verdade (13) e os distintivos A e
B desenhados na cena (27) — "todos da mesma família, todos precisam que a cena saiba responder que
corpo está sob este pixel". A cena sabe responder: `cena/selecao.ts` faz a escolha em espaço de
tela, e não por raio, porque os corpos são desenhados ampliados e um raio acertaria o tamanho real
em vez do disco que se vê.

O que falta agora, e só isto:

- **Texturas em KTX2/Basis, e o nível de 8K sob demanda.** As quinze texturas são JPG/PNG em 2K e
  4K, 31 MB em disco, e sobem descomprimidas para a VRAM. O plano pedia ETC1S para o albedo e
  UASTC para as normais, mais a assadura de `tau = −ln(1 − alfa)` no mapa do anel em vez de um
  logaritmo por pixel no shader. **Está bloqueado por fora**: `toktx` é binário nativo, não instala
  por npm — o próprio plano diz isso — e não está nesta máquina. Os 8K também precisam ser
  baixados (`ferramentas/baixar_texturas.mjs`, ~55 MB). Desbloqueia com o `toktx` instalado e uma
  passada do gerador; nada no programa muda além da tabela de níveis.
- **Abrir o `dist/` construído no Arc e no Safari, por duplo clique**, que é o portão de "pronto"
  da fase F8. É a única linha do plano que pede um par de olhos humanos numa máquina, e nenhum
  teste substitui.

### O que este arquivo aprendeu sobre si mesmo

Uma auditoria encontrou o contrato citando **catorze arquivos de teste que nunca existiram**, em
dezessete dos quarenta e três itens, e nove linhas marcadas `pendente` que estavam prontas havia
fases. Um contrato que afirma prova inexistente é pior que um contrato omisso: quem lê a linha e
confia nela para de procurar.

`testes/contrato.test.ts` passou a ler este arquivo. Ele não julga se o teste citado prova o que
diz provar — isso nenhuma máquina faz —, mas exige que ele **exista**, que todo item tenha prova
ou roteiro manual, que todo estado seja um dos quatro, e que a tabela acima bata com a contagem
das linhas. A contagem fica num comentário para que a conferência seja automática: um resumo
escrito à mão diverge da tabela no primeiro item que muda de estado, e ninguém recontaria 43
linhas para conferir.
