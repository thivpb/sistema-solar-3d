# Arquitetura

Documento de decisoes. O que esta aqui foi medido ou testado — nao e intencao.
A regra herdada do projeto anterior continua valendo: **uma afirmacao que nada verifica apodrece**.
Onde houver uma garantia escrita, ha um teste que a derruba se ela deixar de ser verdade.

## Camadas

```
contratos/   tipos que toda camada ve, e que ninguem importa de volta
nucleo/      fisica. Nao ve nada alem de si mesma e de contratos/
dados/       fatos congelados com procedencia. Nao ve app, cena, interface
app/         cola: acoes, o unico reducer, atalhos, o laco do quadro
cena/        three.js. Le um Instantaneo e desenha. Nao ve app nem interface
rotulos/     geometria em espaco de tela (pura) + uma camada de DOM
interface/   preact. Composta DEPOIS do tonemapping
```

As sete regras estao em `.dependency-cruiser.cjs` e rodam dentro de `npm test`, nao num script
separado que ninguem chama. `testes/arquitetura.test.ts` confere que as sete continuam existindo
e continuam em `error`, porque rebaixar uma regra para `warn` e o jeito mais facil de "passar"
num lint de arquitetura.

**Por que `Instantaneo` mora em `contratos/` e nao em `app/`:** se morasse em `app/`, a regra
`cena -> app` teria de ser liberada, e com ela entrariam `acoes.ts` e `aplicar.ts`. Essa e a porta
pela qual "a cena abre um modal" e "a cena despacha uma acao" entram. O teste antigo em Python
proibia `src/projecao -> src.app` exatamente por isso; o guarda-corpo novo tem de ser no minimo
tao forte.

**O que o dependency-cruiser nao pega, e o ESLint pega:** globais. `Math.random`, `Date.now`,
`performance` e `fetch` nao sao imports — o parse de AST do teste antigo nunca teria visto
nenhuma delas. Sao as quatro que quebram, em silencio, garantias que este projeto afirma por
escrito: determinismo do nucleo, relogio injetado, e "o programa nao acessa a internet".

## Armadilhas conhecidas

Cada linha aqui custou tempo. Estao escritas para nao custarem duas vezes.

| Armadilha | O que acontece | O que fazer |
|---|---|---|
| **App sem assinatura na pasta Desktop** | Um bundle `.app` proprio, aberto pelo Finder, recebe `Operation not permitted` ao ler qualquer arquivo dentro de `~/Desktop`. E o TCC do macOS: a pasta e protegida, e liberar exige que a pessoa va as Configuracoes do Sistema conceder acesso a um app sem assinatura. Foi tentado e descartado. | Usar `run.command`, que o Finder abre por duplo clique atraves do Terminal — que ja tem o acesso. A janela de terminal e o preco, e e menor que mandar alguem mexer em permissao do sistema. |
| **`do shell script` do AppleScript nao desacopla** | Ele so retorna quando o grupo de processos que criou se fecha. Um servidor iniciado por ali deixa o applet pendurado para sempre, mesmo com `nohup`, `&` e `</dev/null`. | Nao iniciar processo longo por AppleScript. |
| **O Finder nao passa pelo `.zshrc`** | Numa maquina onde o Node veio do nvm, `command -v node` falha em tudo que e aberto pelo Finder sem passar por um shell de login, e o programa "simplesmente nao abre", calado. | `run.sh` procura o Node em `~/.nvm/versions/node/*/bin`, `~/.volta/bin`, `/opt/homebrew/bin` e `/usr/local/bin` antes de desistir. |
| **`file://` nao serve para abrir o programa** | O Chromium recusa `new Worker()` de origem opaca, e o fetch do JSON de efemerides, dos `.ktx2` e do `.bin` do catalogo de estrelas e bloqueado por CORS. | Sempre um servidor local. Dai `servidor.mjs` existir. |
| **`python3 -m http.server` nao substitui o servidor** | Nao envia COOP/COEP, nao conhece `.ktx2` nem `.wasm`, e nao tem o PUT das preferencias nem a batida. | `ferramentas/servidor.py`, que e `ThreadingHTTPServer` subclassado e paritario com o de Node. |
| **`stdout` do Python fica em buffer de bloco quando redirecionado** | O endereco que o servidor imprime ao subir — a unica interface de quem abriu pelo lancador — nunca aparece. | `sys.stdout.reconfigure(line_buffering=True)` antes de imprimir qualquer coisa. |
| **Um teste que mede o proprio teste** | Um canvas WebGL2 lido fora do quadro devolve buffer vazio, e uma leitura vazia e PERFEITAMENTE ESTAVEL entre dois quadros — o teste de z-fighting passaria com zero medindo nada. O mesmo padrao apareceu quatro vezes: uma assercao algebrica verdadeira para qualquer entrada, um corpo de teste que "se move" com a gravidade desligada, um corpo em deriva inercial, e um teste de texto que passou verde com o paragrafo apagado porque as palavras apareciam noutro lugar. | Toda medicao vem com uma guarda que afirma que ela esta medindo: `contrasteDoQuadro > 30` ao lado do stipple, valores do DE440 em vez da identidade, o corpo largado em repouso, e a amarra por FRASE em vez de por palavra. |
| **A coluna `P` da tabela de luas do JPL nao e o periodo sideral** | Em Io ela diz 1,762732 dia e o periodo medido e 1,769141 — 0,36%, que em um ano vale 270 graus de fase. A lua aparece do lado errado de Jupiter. A pagina nao avisa, e dez das treze linhas batem. | O periodo e MEDIDO, casando a fase entre duas janelas de vetores do Horizons separadas por dezesseis anos. `ferramentas/gerar_luas.mjs`. |
| **O polo da IAU para Urano sai invertido para as luas** | Com o polo publicado (257,311 / −15,175), Titania, Oberon e Miranda saem retrogradas e erram 600 mil km. Urano gira ao contrario da propria orbita, e o JPL orienta o quadro equatorial da tabela pelo momento angular das luas. | O gerador testa as duas orientacoes e grava qual reproduz a posicao, com o erro de cada uma ao lado. Nada e presumido. |
| **A identidade da anomalia media tem um `cos i`** | `n_sideral = Mponto + periastroPonto + noPonto·cos(i)`. Para as doze luas quase equatoriais `cos i` vale mais de 0,996 e o fator passa despercebido. Para Tritao, retrogrado, ele vale −0,92: sem o fator, o erro foi de 377.835 km, 106% do semieixo — a lua do outro lado de Netuno. | As duas formas sao testadas contra a efemeride, e a escolhida fica gravada no JSON. Um fator que so importa numa lua e um fator que passa quando esta errado. |
| **Ajustar um parametro e depois medir o erro na mesma janela** | Minimos quadrados forcam residuo sem componente linear DENTRO da janela ajustada. Medir ali mede o ajuste, e "o erro nao cresce" vira tautologia — verdadeira sobre o metodo e muda sobre o modelo. | Duas janelas que nao se tocam: mede-se em 2000–2016, confere-se em 2020–2040. |
| **Buscar corpo por INDICE quando a lista pode crescer** | A cena guarda os corpos da fisica e depois as treze luas na mesma lista. `catalogo.corpos[i]` para um indice de lua devolvia `undefined`, e o rotulo saia como a chave, em minuscula. Depois de criar um corpo no sandbox, o mesmo indice passa a devolver OUTRO corpo — e a lua sai rotulada com o nome do asteroide recem-criado. | Busca por CHAVE em tudo que pode mudar de tamanho, e `sincronizarCorpos` na cena compara por chave em vez de por posicao. |
| **`mu = gm_i + gm_j` numa guarda de separacao** | As predefinicoes "Asteroide" e "Cometa" tem massa exatamente zero. Com a soma, um par delas daria separacao minima zero e a guarda aceitaria dois corpos sobrepostos. | A separacao usa a GM do VIZINHO. Dois corpos sem massa realmente nao tem restricao — eles nao se puxam —, e o que a guarda impede e chegar perto de quem tem massa. |
| **Cmd+Shift+Z quando nao ha refazer** | Shift nao entra na comparacao de teclas, de proposito: e ele que faz `/` virar `?`. Sem uma marca explicita, o Refazer convencional de todo aplicativo casa com o desfazer e tira mais um corpo, com `preventDefault` por cima. | O campo `semShift` na tecla, e um teste que aperta Cmd+Shift+Z e exige que nada aconteca. |
| **Trava de servidor que sobrevive ao processo** | A trava guarda o PID para que abrir duas vezes reaproveite a instancia de pe. Quando o processo morre sem poder limpar — `SIGKILL`, a maquina desligando, uma suite de testes encerrando —, ela fica. Sem recuperacao, a abertura seguinte le a trava, acha que ha instancia viva, abre o navegador num endereco morto e sai. O programa nunca mais abre, e nada na tela diz por que. | `process.kill(pid, 0)` nao mata: so pergunta se o processo existe. Se lancar, a trava e apagada e o servidor sobe. `testes/servidor.test.ts` poe uma trava com PID inexistente no caminho e exige que o servidor responda 200. |
| **JSON valido nao e a mesma coisa que objeto** | `42`, `"texto"`, `[1,2]` e `null` sao JSON validos. Gravados em `preferencias.json`, deixam o carregador recebendo um numero onde espera um objeto na abertura seguinte. Descoberto por um teste que ele mesmo estava errado: o Playwright codifica `data` em string como JSON, entao `'nao sou json'` chegava como `"nao sou json"`, que e valido. | Os dois servidores exigem objeto. O teste manda o corpo como bytes e cobre os cinco casos. |

## As duas guardas de texto

Duas afirmacoes do projeto sao sobre PROSA, e por isso nenhuma ferramenta comum as verifica.
Ambas viraram teste depois de falharem.

**`testes/honestidade.test.ts`** amarra cada licenca declarada no bloco "o que a tela simplifica"
a um fato verificavel do codigo, **nos dois sentidos**. Declarar o que nao se faz reprova igual a
fazer o que nao se declara. Nasceu de um defeito: o "Modo maquete" tinha o alternador, o aviso
falado e a etiqueta na tela, e nao comprimia nada.

**`testes/contrato.test.ts`** le o `CONTRATO.md` e exige que toda prova citada exista no disco.
Nasceu de uma auditoria que encontrou **catorze arquivos de teste citados que nunca existiram**,
em dezessete dos quarenta e tres itens. Um contrato que afirma prova inexistente e pior que um
contrato omisso: quem le a linha e confia nela para de procurar.

## Execucao

`run.sh` · `run.command` · `run.bat` · `run.ps1` fazem o mesmo em cada sistema: se faltar
biblioteca, instalam; se faltar `dist/`, constroem; e sobem `servidor.mjs`. A pasta de entrega
ja vem com `dist/` pronto, entao na maquina de quem recebe nada e instalado nem construido —
so um servidor local sobe. Se a maquina nem Node tiver, `ferramentas/servidor.py` assume.

O servidor escuta em **127.0.0.1**, nao em 0.0.0.0: nem outra maquina da mesma rede o enxerga.
Porta fixa **8731**, para que a URL seja sempre a mesma e para que abrir duas vezes reaproveite
a instancia de pe em vez de subir uma segunda.

**A batida** e o que faz "fechar a aba" encerrar o programa. A pagina bate em `/_batida` a cada
10 s; sem batida por 30 s, o processo sai sozinho e remove o arquivo de trava. Sem isso, cada
abertura deixaria um processo orfao segurando a porta, e encerrar o programa passaria a exigir
um terminal — quebrando o requisito que o projeto afirma desde a primeira versao.

**As preferencias vao para um arquivo**, por `PUT /preferencias.json`, e nao para `localStorage`.
Assim continuam sendo o mesmo `preferencias.json` que o projeto sempre teve, sobrevivem a troca
de navegador, e nao ficam presas a origem — que inclui a porta.
