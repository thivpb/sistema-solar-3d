/**
 * Todo o texto que aparece na tela, num lugar so.
 *
 * Motivo de estar junto, herdado literal do projeto anterior: assim da para
 * ler tudo de uma vez e conferir se a linguagem esta acessivel, se o tom esta
 * consistente e se nada promete mais precisao do que a simulacao tem.
 * Espalhado pelo codigo, ninguem revisa.
 *
 * ## Regras de escrita, mantidas
 *
 *   - Nada de "orbita real" nem "exata". A trajetoria e um calculo aproximado.
 *   - Separar sempre tres coisas: o que o JPL mediu, o que o modelo calcula e
 *     o que e so recurso visual.
 *   - Frase curta, palavra comum. Quem abre isto pode nunca ter usado um
 *     programa cientifico.
 *
 * ## Dois conjuntos, e por que a distincao importa
 *
 * **(a) Porte literal.** `DICAS`, `ATIVIDADES`, `TUTORIAL`, `BOTOES`,
 * `OPCOES`, `ABREVIACOES` e `HONESTIDADE.calcula` vieram palavra por palavra.
 * Texto escrito sob padrao editorial e o tipo de material que se "melhora"
 * acidentalmente durante um porte, e nao ha teste para tom de voz.
 *
 * **(b) Reescrita obrigatoria.** Alguns blocos ficaram FACTUALMENTE FALSOS com
 * a mudanca para 3D — `HONESTIDADE.simplifica` afirmava, com todas as letras,
 * que "a vista 3D e ortografica, sem perspectiva; os discos e segmentos sao
 * ordenados por profundidade, com oclusao aproximada". Portar isso literalmente
 * seria portar uma mentira. Cada bloco reescrito esta marcado abaixo com o
 * motivo, e foi reescrito sob o mesmo padrao editorial.
 */

export const ABREVIACOES: Record<string, string> = {
  sol: 'Sol',
  mercurio: 'Mer.',
  venus: 'Vên.',
  terra: 'Ter.',
  marte: 'Mar.',
  jupiter: 'Júp.',
  saturno: 'Sat.',
  urano: 'Ura.',
  netuno: 'Net.',
  lua: 'Lua',
  io: 'Io',
  europa: 'Eur.',
  ganimedes: 'Gan.',
  calisto: 'Cal.',
  tita: 'Titã',
  encelado: 'Enc.',
  fobos: 'Fob.',
  deimos: 'Dei.',
  titania: 'Tit.',
  oberon: 'Obe.',
  miranda: 'Mir.',
  tritao: 'Tri.',
};

// ── (a) porte literal ────────────────────────────────────────────────────────

/**
 * O que cada estado do controle de luas quer dizer, escrito.
 *
 * Tres frases e nao uma: um controle de tres posicoes cujo terceiro estado
 * ninguem explica e um controle de duas posicoes com um enigma. "Só elas" e o
 * que mais precisa de frase, porque ele NAO apaga os planetas, e alguem que
 * escolhe esperando uma tela sem planetas precisa ler por que ela nao veio.
 */
export const LUAS_NA_TELA = {
  com: 'As luas aparecem junto dos planetas. De longe elas somem sozinhas: a órbita inteira cabe dentro do disco do planeta, e desenhá-las ali seria ruído.',
  sem: 'Nenhuma lua é desenhada. A cena fica com os nove corpos que a física integra.',
  so: 'As luas passam a ser o assunto: todas abertas na lista, e na cena os nomes passam a ser delas antes dos planetas. Os planetas continuam desenhados — uma lua sem o planeta dela não diz em torno de quê ela gira.',
} as const;

export const BOTOES = {
  pausar: 'Pausar',
  continuar: 'Continuar',
  visaoGeral: 'Visão geral',
  focar: 'Focar planeta',
  ajuda: 'Ajuda',
  maisOpcoes: 'Mais opções',
  inicio: 'Voltar ao início',
  comparar: 'Comparar corpos',
  imersivo: 'Modo imersivo',
  sairDoImersivo: 'Sair do modo imersivo',
  fichaInteira: 'Ficha inteira',
  fecharFicha: 'Fechar a ficha inteira',
  atividades: 'Atividades',
  laboratorio: 'Explorar a matemática',
  fechar: 'Fechar',
  entendi: 'Entendi',
  pular: 'Pular orientação',
  proximo: 'Próximo',
} as const;

/**
 * Seis perguntas, seis respostas. Sao as mesmas do projeto anterior.
 *
 * **La elas estavam praticamente inalcancaveis**: a acao que as abria era
 * importada e nunca usada, e o unico botao que chamava uma dica vivia DENTRO
 * de uma caixa de dica ja aberta. Quem nunca abrisse a primeira nunca veria
 * nenhuma. Aqui elas sao alcancaveis da tela principal, e
 * `dicasAlcancaveis.test.ts` reprova o programa se deixarem de ser.
 */
export const DICAS: Record<string, { pergunta: string; resposta: string }> = {
  mercurio_rapido: {
    pergunta: 'Por que Mercúrio parece mais rápido?',
    resposta:
      'Porque ele é. Mercúrio está oito vezes mais perto do Sol que Júpiter, e quanto mais ' +
      'perto, mais forte a gravidade puxa e mais depressa o planeta precisa andar para não cair.\n\n' +
      'Uma volta de Mercúrio leva 88 dias. Uma de Netuno leva 60 mil. Todos aqui andam no mesmo ' +
      'relógio: se você deixar rodando, Mercúrio dá centenas de voltas antes de Netuno completar uma.',
  },
  tamanho_planetas: {
    pergunta: 'Por que os planetas são desenhados maiores?',
    resposta:
      'Porque no tamanho certo você não veria nenhum.\n\n' +
      'A Terra tem 12.742 km de diâmetro e fica a 150 milhões de km do Sol. Se o Sol tivesse o ' +
      'tamanho de uma bola de futebol, a Terra seria um grão de areia a 25 metros dela.\n\n' +
      // REESCRITO: a frase original dizia "as posições são projetadas em 2D".
      'O quanto cada corpo está aumentado aparece escrito na tela, e o número cai sozinho ' +
      'conforme a câmera chega perto — ao encostar num planeta, ele está no tamanho certo. ' +
      'Ligue "Corpos no tamanho real" em Mais opções para ver o que acontece sem nenhum aumento.',
  },
  distancias: {
    pergunta: 'Por que os quatro primeiros ficam amontoados?',
    resposta:
      'Também porque é assim mesmo. Netuno está 77 vezes mais longe do Sol que Mercúrio.\n\n' +
      'Use "Planetas internos" para chegar perto dos quatro de dentro, ou ligue "Modo maquete" ' +
      'em Mais opções para ver os oito espalhados — lembrando que aí o desenho deixa de estar ' +
      'em escala.',
  },
  orbitas_mudam: {
    pergunta: 'A órbita muda de forma?',
    resposta:
      'Um pouco, sim. Cada planeta puxa os outros, e isso faz a elipse girar e mudar de formato ' +
      'devagar, ao longo de séculos.\n\n' +
      'O caminho previsto que aparece na tela é a elipse deste instante. Daqui a mil anos ' +
      'simulados ela estará um pouco diferente.',
  },
  sol_se_move: {
    pergunta: 'O Sol está se mexendo?',
    resposta:
      'Está. Júpiter é grande o bastante para balançar o Sol: os dois giram em torno de um ponto ' +
      'comum que fica um pouco fora da superfície solar.\n\n' +
      'Nesta simulação o Sol sente a gravidade dos oito planetas, como eles sentem a dele. Em ' +
      'doze anos ele se desloca mais que o próprio raio.',
  },
  data: {
    pergunta: 'De onde vem a data?',
    resposta:
      'A simulação começa em 1º de janeiro de 2026, com as posições e velocidades medidas pelo ' +
      'JPL, da NASA.\n\n' +
      'A partir daí o programa calcula o resto, avançando de meio em meio dia. A data mostrada ' +
      'sempre corresponde ao que está desenhado.',
  },
};

export const TUTORIAL: { titulo: string; texto: string }[] = [
  {
    titulo: 'Observe os oito planetas',
    texto:
      'O Sol está no centro e os oito planetas se movem ao mesmo tempo, cada um na sua ' +
      'velocidade. Repare que os quatro de dentro ficam apertados perto do Sol: as distâncias ' +
      'na tela estão em escala.',
  },
  {
    titulo: 'Escolha um corpo',
    texto:
      'Clique na lista à direita, ou use as setas depois do Tab. Aparece uma ficha com a ' +
      'distância atual até o Sol, a velocidade e quanto tempo ele leva para dar uma volta. ' +
      '"Ver detalhes" abre a ficha completa.',
  },
  {
    titulo: 'Mude a velocidade do tempo',
    texto:
      'Use − e +, ou as teclas [ e ]. A tela sempre mostra quanto tempo simulado passa a cada ' +
      'segundo real, e a data acompanha.',
  },
  {
    // NOVO: a câmera 3D não existia na versão anterior.
    titulo: 'Gire a câmera',
    texto:
      'Arraste com o mouse, ou use as setas do teclado. Segure Shift para deslocar em vez de ' +
      'girar. A tecla T alinha a câmera com o plano onde os planetas orbitam, e a tecla 4 leva ' +
      'você até a órbita baixa do corpo escolhido.',
  },
];

export const ATIVIDADES: { titulo: string; tarefa: string; resposta: string }[] = [
  {
    titulo: 'Quem dá a volta primeiro?',
    tarefa:
      'Coloque o tempo em 30 dias por segundo e observe Mercúrio e a Terra. Conte quantas ' +
      'voltas Mercúrio dá enquanto a Terra dá uma.',
    resposta:
      'Mercúrio leva 88 dias e a Terra, 365. Mercúrio dá pouco mais de quatro voltas no tempo ' +
      'de uma da Terra.',
  },
  {
    titulo: 'Terra e Marte: quem está mais longe?',
    tarefa:
      'Escolha a Terra e anote a distância até o Sol. Depois escolha Marte e compare.',
    resposta:
      'A Terra fica a cerca de 1 UA do Sol e Marte, entre 1,38 e 1,67 UA. Marte está sempre ' +
      'mais longe, mas a distância dele varia bem mais, porque a órbita é mais alongada.',
  },
  {
    titulo: 'O Sol fica parado?',
    tarefa:
      'Use "Planetas internos", aproxime bem do Sol e deixe o tempo correr rápido por um tempo.',
    resposta:
      'O Sol desenha um lacinho em volta de um ponto. Quem manda nisso é Júpiter, que puxa o ' +
      'Sol enquanto dá a volta de doze anos.',
  },
  {
    titulo: 'Por que Netuno demora tanto?',
    tarefa:
      'Acompanhe Netuno na velocidade máxima e veja a data avançar enquanto ele completa uma volta.',
    resposta:
      'Netuno leva cerca de 165 anos. Ele está trinta vezes mais longe do Sol que a Terra, e ' +
      'quanto mais longe, mais devagar o planeta anda.',
  },
];

export const OPCOES = {
  estrelas: 'Mostrar estrelas',
  orbitas: 'Caminhos previstos',
  trilhas: 'Rastros percorridos',
  rotulos: 'Nomes dos corpos',
  aneisDeDistancia: 'Anéis de distância',
  tamanhoReal: 'Corpos no tamanho real',
  textoMaior: 'Texto maior',
  reduzirAnimacao: 'Reduzir animação',
  tecnico: 'Mostrar dados técnicos',
} as const;

export const AJUDA_OPCOES = {
  estrelas:
    'O céu de verdade: 8.404 estrelas do catálogo Yale, até a magnitude que o olho nu alcança, ' +
    'com a cor que a temperatura de cada uma tem.',
  orbitas:
    'A elipse que o corpo percorreria se só o Sol existisse. É um cálculo a partir da posição ' +
    'de agora.',
  trilhas: 'O caminho por onde o corpo realmente passou nesta simulação.',
  rotulos: 'Liga e desliga os nomes ao lado de cada corpo.',
  aneisDeDistancia: 'Círculos marcando 1, 5, 10, 20 e 30 UA de distância do Sol.',
  // REESCRITO: o texto original falava de pixels numa tela 2D.
  tamanhoReal:
    'No tamanho real os corpos somem: da visão geral, a Terra fica muito menor que um ponto na ' +
    'tela. É essa a lição — e por isso não há nada desenhado no lugar dela.',
  maquete:
    'Aproxima os corpos distantes para todos caberem juntos. A simulação continua usando as ' +
    'distâncias reais, a iluminação também, e os números da ficha não mudam.',
  textoMaior: 'Aumenta todas as letras e os botões.',
  reduzirAnimacao: 'Desliga as transições de câmera e reduz o brilho em volta das estrelas.',
  tecnico: 'Mostra passo de integração, energia, desempenho e qual placa está desenhando.',
} as const;

// ── (b) reescrita obrigatoria ────────────────────────────────────────────────

/**
 * Os tres blocos que o projeto separa desde a primeira versao.
 *
 * `calcula` veio literal. Os outros dois foram reescritos, e o motivo esta
 * dentro de cada um: o texto antigo descrevia uma tela que nao existe mais.
 */
export const HONESTIDADE = {
  calcula: {
    titulo: 'O que a simulação calcula',
    texto:
      'A atração gravitacional entre o Sol e os oito planetas, todos ao mesmo tempo. Cada corpo ' +
      'puxa todos os outros, inclusive o Sol.\n\n' +
      'As posições e velocidades de partida foram medidas pelo JPL, da NASA, para 1º de janeiro ' +
      'de 2026. Daí em diante o programa avança o tempo de meio em meio dia simulado.\n\n' +
      'Distâncias, velocidades e datas mostradas vêm desse cálculo.',
  },
  simplifica: {
    titulo: 'O que a tela simplifica',
    texto:
      'Os corpos são desenhados maiores que o tamanho real. No tamanho certo nenhum apareceria ' +
      'de longe. O quanto cada um está aumentado aparece escrito na tela, e o aumento some ' +
      'sozinho conforme a câmera se aproxima.\n\n' +
      'A física anda de meio em meio dia. Entre um passo e o outro, o desenho interpola a ' +
      'posição — medido, o maior desvio é de 0,09 km, em Mercúrio. A data escrita acompanha o ' +
      'instante desenhado, e não o último passo calculado.\n\n' +
      'As luas não são integradas junto com os planetas. A posição delas vem de um modelo de ' +
      'órbita aproximado, com os elementos médios do JPL, e não da efeméride. Elas aparecem na ' +
      'tela, recebem luz e projetam sombra, e não puxam nada — inclusive não puxam o planeta que ' +
      'orbitam.\n\n' +
      'O erro disso foi medido, contra a efeméride do JPL, num intervalo de vinte anos que o ' +
      'modelo nunca viu ao ser construído: vai de 456 km em Deimos a 52.636 km em Tritão, ' +
      'e a Lua fica em 15.293 km. Ele não cresce com o tempo — é um desvio limitado, feito dos ' +
      'empurrões periódicos que um modelo de duas massas não tem. A sombra que a Lua projeta ' +
      'sobre a Terra é consequência geométrica da iluminação, e com esse erro ela não serve para ' +
      'prever um eclipse.\n\n' +

      'O lado noturno não é preto. Ele recebe 14% da luz do meio-dia, e é a mesma luz, com ' +
      'um mínimo — não uma segunda lâmpada. Sem isso, aproximar-se de um planeta pelo lado ' +
      'errado entregava um disco inteiramente preto: a textura estava carregada, o eixo estava ' +
      'certo, e não havia nada para ver. O que se perde é o preto absoluto do espaço sobre a ' +
      'superfície; o que se ganha é o planeta inteiro. O terminador continua onde a geometria ' +
      'manda, e o céu ao redor continua preto de verdade.\n\n' +
      'A rotação desenhada tem um teto, e por isso ela ATRASA. A escada de tempo vai a 30 dias ' +
      'por segundo, e nessa velocidade Marte dá 29 voltas por segundo — mais voltas do que a ' +
      'tela tem quadros, o que transforma a superfície num serrilhado que pisca. Então, quando ' +
      'um corpo fica grande na tela, o giro desenhado é reduzido até caber no quadro. O eixo, a ' +
      'inclinação e a sombra continuam certos; o que fica para trás é qual meridiano está de ' +
      'frente, e o atraso não se recupera sozinho. "Voltar ao início" zera tudo.\n\n' +

      // As duas entradas das luas. A primeira e sobre o que EXISTE de mapa; a
      // segunda e sobre onde a longitude zero foi posta, que e uma escolha e
      // nao uma medida.
      'Cinco das treze luas são desenhadas com mosaicos de imageamento real: Io, Europa, ' +
      'Ganimedes e Calisto, das sondas Voyager e Galileo, e Encélado, da Cassini. As outras oito ' +
      'ficam com uma cor só, e ficam de propósito: não existe mosaico global publicado delas. ' +
      'Titã está sob uma bruma que a luz visível não atravessa; Fobos, Deimos, Titânia, Oberon, ' +
      'Miranda e Tritão foram vistos numa passagem única, com metade do corpo na sombra. ' +
      'Desenhar o resto seria desenhar o que ninguém viu.\n\n' +
      'Onde a longitude zero de uma lua cai é uma convenção, e não uma medida. Para uma lua ' +
      'travada por maré, a União Astronômica Internacional define o meridiano zero como o que ' +
      'encara o planeta — e é isso que o programa desenha, derivando o ângulo da própria órbita. ' +
      'Cada mosaico traz a convenção dele declarada no rótulo publicado junto, e as imagens foram ' +
      'espelhadas e giradas de acordo antes de entrar; o que não foi feito é conferir o resultado ' +
      'contra uma fotografia de referência. O eixo e o período de rotação, esses, são medidos.\n\n' +

      // Esta entrada nao e opcional: `procedencia.test.ts` falha se um mapa de
      // textura marcado `artistico` nao for citado aqui pelo nome do corpo.
      'As imagens de Urano e de Netuno são reconstruções. Não existe fotografia global desses ' +
      'dois planetas: a cor vem de medidas do brilho integrado, e as faixas que aparecem na tela ' +
      'são desenho, não observação. O mesmo vale para o fundo da Via Láctea, que é um panorama ' +
      'tratado — as estrelas com nome, essas, vêm de um catálogo medido.\n\n' +
      'O halo de ar no limbo dos planetas é um modelo aproximado, e não um cálculo de como a luz ' +
      'atravessa a atmosfera. O que ele calcula é o caminho que a vista percorre dentro de uma ' +
      'casca da espessura certa — por isso o arco é fino no meio do disco e brilhante na borda, ' +
      'e por isso ele some no lado noturno. O que ele não calcula é espalhamento múltiplo nem ' +
      'dependência de cor, e a cor de cada halo foi escolhida olhando imagens publicadas, não um ' +
      'espectro. A altura de cada casca, essa, é a altura de escala da ficha da NASA.\n\n' +
      'A coroa do Sol é desenho. Ela existe porque o brilho que nasce do disco solar não ' +
      'sobrevive ao zoom: de Netuno o Sol tem menos de um pixel, e sem um halo próprio a estrela ' +
      'que segura o sistema inteiro viraria um ponto igual aos do fundo. A queda de brilho dela ' +
      'não é o perfil medido da coroa solar — é uma queda suave escolhida para o halo terminar ' +
      'dentro do quadro.\n\n' +
      'O brilho da cena passa por uma exposição automática, como a de uma câmera fotográfica. ' +
      'Sem ela, Urano e Netuno seriam pixels pretos. O fator aparece escrito sempre que sai de ' +
      'um. A luz que cada corpo recebe continua caindo com o quadrado da distância real.\n\n' +
      'Com "Modo maquete" ligado, as distâncias desenhadas deixam de ser proporcionais. A ' +
      'iluminação e a geometria continuam usando as distâncias reais, e as fichas também.',
  },
  naoInclui: {
    titulo: 'O que o modelo não inclui',
    texto:
      'As luas aparecem desenhadas, mas não entram no cálculo: elas não puxam nada e não são ' +
      'puxadas. A Terra e a Lua ainda contam como um ponto só na física, no centro de massa dos ' +
      'dois — é esse ponto que a efeméride do JPL mede e que o programa move. O centro do planeta ' +
      'fica a cerca de 4.671 km dele, do lado oposto ao da Lua, e o que se vê é esse ponto ' +
      'separado em dois pelo modelo de órbita.\n\n' +
      'Plutão, os asteroides e os cometas não existem aqui — mas dá para criar um. Os corpos que ' +
      'você cria entram na mesma física dos outros, e a partir do primeiro deles o programa deixa ' +
      'de mostrar a efeméride do JPL e passa a mostrar um sistema inventado. Ele diz isso na ' +
      'tela, e tem um botão para voltar.\n\n' +
      'Colisões não existem: os corpos atravessam uns aos outros. Calcular choque, quebra e ' +
      'destroços é outro programa. Por isso há uma distância mínima entre corpos criados — dois ' +
      'corpos no mesmo lugar dariam uma atração infinita, e o cálculo devolveria lixo para todos ' +
      'os outros no mesmo passo.\n\n' +
      'A relatividade geral também não. O efeito maior seria girar lentamente a órbita de ' +
      'Mercúrio, 43 segundos de arco por século.\n\n' +
      'Por isso os resultados se afastam devagar das medidas do JPL. Comparando com a efeméride ' +
      'de referência, o desvio fica abaixo de 0,5% da distância ao Sol ao longo de cem anos para ' +
      'frente ou para trás — Mercúrio é o caso mais difícil, com 0,45%. É uma simulação para ' +
      'entender como o sistema se move, não um substituto da efeméride.',
  },
} as const;

/** REESCRITO: a versão anterior descrevia cliques de mouse numa tela 2D. */
export const CONTROLES =
  'Na lista da direita: um Tab entra nela e as setas percorrem os corpos. Enter escolhe como A; ' +
  'Shift+Enter escolhe como B, que é o outro lado da comparação. Tudo o que se faz com o mouse ' +
  'tem esse caminho pelo teclado — nenhum atalho é a única forma de fazer alguma coisa.\n\n' +
  'Na cena: arraste com o botão esquerdo para girar a câmera em volta do alvo, e com o direito ' +
  'para deslocar. As setas fazem o mesmo, e Shift+setas desloca. A roda do mouse aproxima e ' +
  'afasta, e + e − também.\n\n' +
  'As teclas 1, 2, 3 e 4 mudam o enquadramento: sistema completo, planetas internos, acompanhar ' +
  'o corpo escolhido, e chegar perto dele. T alinha a câmera com o plano onde os planetas ' +
  'orbitam. V alterna entre perspectiva e vista de cima sem perspectiva.\n\n' +
  'No modo imersivo: a barra e o painel recuam, a cena ocupa a janela e a câmera passa a voar. ' +
  'W e S vão para frente e para trás, A e D para os lados, Q e E descem e sobem, e Shift acelera ' +
  'quatro vezes. A velocidade é uma fração da distância até o alvo, então aproximar é desacelerar ' +
  '— e o número em UA por segundo fica escrito na tela. Esc sai, e o botão "Sair do modo ' +
  'imersivo" faz o mesmo sem tecla nenhuma.\n\n' +
  'Nas caixas: Tab percorre os controles, Esc fecha. A caixa prende o foco enquanto está aberta ' +
  'e devolve para quem a abriu ao fechar.';

/** REESCRITO: a escala visual mudou de significado e de nome. */
export const ESCALA_FICHA =
  'As posições e velocidades são calculadas em três dimensões, e os números desta ficha vêm ' +
  'direto desse cálculo. Eles não mudam com o zoom, com o aumento dos corpos nem com o modo ' +
  'maquete.\n\n' +
  'O desenho é que tem licenças, e cada uma aparece escrita na tela quando está ligada: o ' +
  'aumento dos corpos, a compressão das distâncias no modo maquete, e a exposição automática.';

export const RODAPE = {
  ampliado: 'Corpos desenhados maiores que o tamanho real',
  comprimido: 'DISTÂNCIAS COMPRIMIDAS — o desenho não está em escala',
  atrasado: 'Seu computador não está acompanhando esta velocidade',
  sistemaModificado: 'Sistema modificado — não é mais a efeméride do JPL',
  passoCurto:
    'Passo curto ligado — a física anda de 0,125 em 0,125 dia, e a velocidade máxima do tempo caiu para um quarto',
} as const;

/**
 * O laboratorio de Fourier.
 *
 * `avisoHistorico` e OBRIGATORIO e nao e cortesia: a cadeia de epiciclos
 * descreve a orbita com a precisao que se quiser, e sem essa frase o
 * laboratorio ensinaria que o programa simula epiciclos. Ele nao simula — a
 * fisica dele e a integracao de N corpos, e esta lamina e uma releitura da
 * mesma elipse. `laboratorio.spec.ts` falha se a frase sumir da tela.
 */
export const LABORATORIO = {
  avisoHistorico:
    'Construção histórica — não é a física do modelo. O programa não calcula epiciclos: as ' +
    'posições vêm da integração da gravidade entre os nove corpos. O que está desenhado aqui é ' +
    'a mesma órbita, reescrita como soma de círculos, do jeito que os astrônomos antigos a ' +
    'descreviam.',
  comoLer:
    'A linha tracejada é a órbita calculada. A linha cheia é o que os círculos desenham até ' +
    'agora. O ponto amarelo cheio é o Sol, no foco; o vazado é de onde a corrente de círculos ' +
    'parte, e a distância entre os dois é a excentricidade da órbita vista de outro jeito.\n\n' +
    'Aumente o número de epiciclos e veja o desvio cair. Órbitas mais alongadas precisam de ' +
    'mais círculos: Vênus fecha com dois, Mercúrio pede bem mais.',
  semOrbita:
    'Este corpo não está numa órbita fechada em torno do Sol, então não há uma volta para ' +
    'decompor. Escolha um dos oito planetas.',
} as const;

/**
 * As recusas do sandbox, escritas em portugues.
 *
 * O nucleo devolve FATOS — quantos passos cabem numa volta, a que distancia
 * esta o vizinho —, e nunca frases: ele nao tem por que saber que em portugues
 * se escreve 11,6 e nao 11.6, e uma frase escondida na fisica escaparia da
 * revisao que este arquivo existe para permitir.
 *
 * Toda recusa diz TRES coisas: o que aconteceu, por que, e o que fazer. Uma
 * recusa sem saida e um beco.
 */
export const RECUSAS = {
  periastroCurto: (perielioUa: number, passos: number, temSaida: boolean): string =>
    `Esse corpo passaria a ${numeroPt(perielioUa, 3)} UA do Sol, e por lá ele corre tanto que o ` +
    `cálculo daria só ${numeroPt(passos, 1)} passos na passagem. Abaixo de 40 o resultado deixa de ` +
    'ser uma órbita e vira um desenho. ' +
    (temSaida
      ? 'O passo curto resolve: ele divide o meio dia por quatro, e o tempo passa a correr no ' +
        'máximo quatro vezes mais devagar.'
      : 'Nem o passo curto resolve. Coloque o corpo mais longe do Sol, ou com menos velocidade.'),

  voltaCurta: (periodoDias: number, passos: number, temSaida: boolean): string =>
    `Esse corpo daria uma volta em ${numeroPt(periodoDias, 1)} dias, o que são só ` +
    `${numeroPt(passos, 0)} passos de cálculo por volta. Abaixo de 40 a órbita calculada gira e ` +
    'encolhe sozinha, sem que nada na tela avise. ' +
    (temSaida
      ? 'O passo curto resolve, dividindo o meio dia por quatro.'
      : 'Nem o passo curto resolve. Coloque o corpo mais longe do Sol.'),

  vizinhoPerto: (nome: string, distanciaUa: number, minimaUa: number): string =>
    `Perto demais de ${nome}: ${numeroPt(distanciaUa, 4)} UA, e o mínimo para o cálculo aguentar ` +
    `é ${numeroPt(minimaUa, 4)} UA. Mais perto que isso, a atração cresce tanto entre um passo e ` +
    'o outro que o resultado vira lixo — e o lixo contamina os outros corpos no mesmo passo. ' +
    'Escolha um ponto mais afastado.',

  lotado: (maximo: number): string =>
    `Já são ${maximo} corpos criados, que é o limite. Cada corpo novo custa tempo de cálculo para ` +
    'todos os outros, e acima disso o programa começaria a engasgar sem dizer por quê. Apague um ' +
    'para criar outro.',
} as const;

/** Um número com vírgula, como se escreve em português. */
function numeroPt(v: number, casas: number): string {
  return v.toFixed(casas).replace('.', ',');
}

export const SANDBOX = {
  ondeMirar:
    'Clique num ponto da cena. O corpo é colocado no plano em que os oito planetas orbitam, à ' +
    'distância do Sol que você apontou.',
  velocidadeZero:
    'Parado, ele cai direto no Sol. É a demonstração mais curta de que órbita é queda que erra o ' +
    'alvo.',
  velocidadeAbaixo:
    'Devagar demais para uma órbita redonda: ele vai cair para dentro e formar uma elipse, com o ' +
    'ponto de partida no lado mais distante.',
  velocidadeAcima:
    'Acima da velocidade de órbita redonda: a elipse se alonga para fora, e o ponto de partida ' +
    'passa a ser o mais próximo do Sol.',
  velocidadeDeEscape:
    'Na velocidade de escape ou acima dela — 1,41 vez a de órbita redonda. Ele vai embora e não ' +
    'volta.',
  semColisoes:
    'Os corpos atravessam uns aos outros: este programa não calcula colisões. Dois corpos no ' +
    'mesmo lugar dariam uma atração infinita, e por isso há uma distância mínima entre eles.',
  distintivo: 'Sistema modificado — não é mais a efeméride do JPL',
  fichaDeCriado: 'Corpo criado por você. Não vem de medida nenhuma, e por isso não tem fontes.',
} as const;

export const FONTES = {
  titulo: 'De onde vêm os dados',
  blocos: [
    {
      nome: 'Posições e velocidades de partida',
      texto:
        'JPL Horizons, da NASA, para 1º de janeiro de 2026 (JD 2461041,5 TDB). Efeméride DE441, ' +
        'centro no baricentro do Sistema Solar, plano e equinócio da eclíptica de J2000.',
    },
    {
      nome: 'Massas',
      texto: 'Cabeçalho da efeméride DE440: GMS e as GM de sistema de cada planeta.',
    },
    {
      nome: 'Raios, temperaturas, atmosferas e número de luas',
      texto: 'NASA Planetary Fact Sheet e as fichas do NSSDCA.',
    },
    {
      nome: 'Eixo de rotação e período',
      texto:
        'Relatório do grupo de trabalho da União Astronômica Internacional sobre coordenadas ' +
        'cartográficas e elementos de rotação, edição de 2015 (Archinal e outros, 2018).',
    },
    {
      nome: 'Geometria dos anéis',
      texto: 'NSSDCA, ficha de cada planeta.',
    },
    {
      nome: 'Estrelas',
      texto:
        'Yale Bright Star Catalogue, 5ª edição revisada (Hoffleit e Warren, 1991). 8.404 ' +
        'estrelas até magnitude 6,5, com a temperatura de cor medida.',
    },
    {
      nome: 'Texturas',
      texto:
        'Solar System Scope (solarsystemscope.com), sob licença CC BY 4.0. Cada mapa traz a ' +
        'procedência declarada: fotografia, dado derivado ou reconstrução.',
    },
  ],
} as const;
