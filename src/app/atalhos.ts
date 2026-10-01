/**
 * O mapa de teclas.
 *
 * Regra herdada e mantida: **os atalhos complementam os botoes; nenhum deles e
 * a unica forma de fazer alguma coisa.** Tudo aqui tem um controle escrito
 * equivalente em algum lugar da tela.
 *
 * **O que mudou em relacao a versao 2D, e por que.** As setas passam a
 * ORBITAR a camera; deslocar virou Shift+setas. O motivo e paridade com o
 * mouse: arrastar com o esquerdo orbita, arrastar com Shift desloca. Quando o
 * gesto primario do mouse e o gesto primario do teclado fazem a mesma coisa, a
 * tabela de atalhos vira ensinavel em vez de decorada. `TABELA_DE_ATALHOS`
 * abaixo e atualizada junto, e `atalhos.test.ts` falha se as duas divergirem —
 * esse teste existe exatamente para mudancas assim.
 */
import type { Acao } from './acoes.ts';
import { atalhoGlobalPodeAgir, type AlvoDaTecla } from './escopoDeTeclado.ts';

export interface Tecla {
  /** `KeyboardEvent.key`, como o navegador entrega — ja com o Shift aplicado. */
  tecla: string;
  /** Exige Cmd (macOS) ou Ctrl. */
  meta?: boolean;
  /**
   * Exige que o Shift NAO esteja apertado.
   *
   * O Shift normalmente nao entra na comparacao, e de proposito: e ele que faz
   * `/` virar `?`, e comparar os dois daria duas entradas quase iguais no mapa.
   * Mas Cmd+Shift+Z e o REFAZER convencional de quase todo aplicativo, e aqui
   * nao ha refazer. Sem esta marca, ele casaria com o desfazer e executaria um
   * desfazer A MAIS, com `preventDefault` por cima — a pessoa pediria para
   * voltar e perderia mais um corpo.
   */
  semShift?: boolean;
}

export interface Atalho {
  teclas: Tecla[];
  /** Como a combinacao aparece escrita na Ajuda. */
  escrito: string;
  descricao: string;
  acao: (evento: { shift: boolean }) => Acao;
}

const PASSO_DA_CAMERA = 0.06; // radianos por toque de seta
/**
 * Fracao da altura visivel por toque de Shift+seta. Adimensional.
 *
 * Era `48`, com o comentario "pixels por toque", e esse numero chegava sem
 * conversao em `deslocar(camera, dxUa, dyUa)` — 48 UA por toque. O 0,06 abaixo e
 * o mesmo numero do passo angular, e nao por coincidencia: a 45 graus de campo,
 * 0,06 rad de giro e 6% da altura deslocam a cena quase a mesma distancia na
 * tela, e ai as quatro setas com e sem Shift andam no mesmo ritmo.
 */
const PASSO_DO_DESLOCAMENTO = 0.06;

export const ATALHOS: Atalho[] = [
  {
    teclas: [{ tecla: ' ' }],
    escrito: 'Espaço',
    descricao: 'Pausar ou continuar',
    acao: () => ({ tipo: 'alternar-pausa' }),
  },
  {
    teclas: [{ tecla: '[' }],
    escrito: '[ e ]',
    descricao: 'Diminuir e aumentar a velocidade do tempo',
    acao: () => ({ tipo: 'mudar-velocidade', passo: -1 }),
  },
  {
    teclas: [{ tecla: ']' }],
    escrito: '[ e ]',
    descricao: 'Diminuir e aumentar a velocidade do tempo',
    acao: () => ({ tipo: 'mudar-velocidade', passo: 1 }),
  },
  {
    teclas: [{ tecla: '.' }],
    escrito: '.',
    descricao: 'Pausar e avançar exatamente meio dia',
    acao: () => ({ tipo: 'avancar-passo', sentido: 1 }),
  },
  {
    teclas: [{ tecla: ',' }],
    escrito: ',',
    descricao: 'Pausar e voltar exatamente meio dia',
    acao: () => ({ tipo: 'avancar-passo', sentido: -1 }),
  },
  {
    teclas: [{ tecla: '1' }],
    escrito: '1, 2, 3, 4',
    descricao: 'Sistema completo, planetas internos, acompanhar, chegar perto',
    acao: () => ({ tipo: 'trocar-modo', modo: 'sistema' }),
  },
  {
    teclas: [{ tecla: '2' }],
    escrito: '1, 2, 3, 4',
    descricao: 'Sistema completo, planetas internos, acompanhar, chegar perto',
    acao: () => ({ tipo: 'trocar-modo', modo: 'internos' }),
  },
  {
    teclas: [{ tecla: '3' }],
    escrito: '1, 2, 3, 4',
    descricao: 'Sistema completo, planetas internos, acompanhar, chegar perto',
    acao: () => ({ tipo: 'trocar-modo', modo: 'acompanhar' }),
  },
  {
    teclas: [{ tecla: '4' }],
    escrito: '1, 2, 3, 4',
    descricao: 'Sistema completo, planetas internos, acompanhar, chegar perto',
    acao: () => ({ tipo: 'trocar-modo', modo: 'perto' }),
  },
  {
    teclas: [{ tecla: 'h' }, { tecla: 'H' }],
    escrito: 'H',
    descricao: 'Voltar à visão geral',
    acao: () => ({ tipo: 'trocar-modo', modo: 'sistema' }),
  },
  {
    teclas: [{ tecla: '+' }, { tecla: '=' }],
    escrito: '+ e −',
    descricao: 'Aproximar e afastar',
    acao: () => ({ tipo: 'ajustar-zoom', fator: 1.25 }),
  },
  {
    teclas: [{ tecla: '-' }, { tecla: '_' }],
    escrito: '+ e −',
    descricao: 'Aproximar e afastar',
    acao: () => ({ tipo: 'ajustar-zoom', fator: 0.8 }),
  },
  {
    teclas: [{ tecla: 'ArrowLeft' }],
    escrito: 'Setas',
    descricao: 'Girar a câmera em volta do alvo. Com Shift, desloca a câmera',
    acao: (ev) =>
      ev.shift
        ? { tipo: 'deslocar-camera', fracaoX: -PASSO_DO_DESLOCAMENTO, fracaoY: 0 }
        : { tipo: 'orbitar-camera', azimute: -PASSO_DA_CAMERA, elevacao: 0 },
  },
  {
    teclas: [{ tecla: 'ArrowRight' }],
    escrito: 'Setas',
    descricao: 'Girar a câmera em volta do alvo. Com Shift, desloca a câmera',
    acao: (ev) =>
      ev.shift
        ? { tipo: 'deslocar-camera', fracaoX: PASSO_DO_DESLOCAMENTO, fracaoY: 0 }
        : { tipo: 'orbitar-camera', azimute: PASSO_DA_CAMERA, elevacao: 0 },
  },
  {
    teclas: [{ tecla: 'ArrowUp' }],
    escrito: 'Setas',
    descricao: 'Girar a câmera em volta do alvo. Com Shift, desloca a câmera',
    acao: (ev) =>
      ev.shift
        ? { tipo: 'deslocar-camera', fracaoX: 0, fracaoY: -PASSO_DO_DESLOCAMENTO }
        : { tipo: 'orbitar-camera', azimute: 0, elevacao: PASSO_DA_CAMERA },
  },
  {
    teclas: [{ tecla: 'ArrowDown' }],
    escrito: 'Setas',
    descricao: 'Girar a câmera em volta do alvo. Com Shift, desloca a câmera',
    acao: (ev) =>
      ev.shift
        ? { tipo: 'deslocar-camera', fracaoX: 0, fracaoY: PASSO_DO_DESLOCAMENTO }
        : { tipo: 'orbitar-camera', azimute: 0, elevacao: -PASSO_DA_CAMERA },
  },
  {
    teclas: [{ tecla: 'v' }, { tecla: 'V' }],
    escrito: 'V',
    descricao: 'Alternar entre perspectiva e vista de cima sem perspectiva',
    acao: () => ({ tipo: 'alternar-vista' }),
  },
  {
    teclas: [{ tecla: 't' }, { tecla: 'T' }],
    escrito: 'T',
    descricao: 'Alinhar a câmera com o plano dos planetas',
    acao: () => ({ tipo: 'vista-superior' }),
  },
  {
    teclas: [{ tecla: 'r' }, { tecla: 'R' }],
    escrito: 'R',
    descricao: 'Voltar ao início',
    acao: () => ({ tipo: 'voltar-ao-inicio' }),
  },
  {
    // `F` e nao `D`: no modo imersivo o D voa para a direita, e um atalho que
    // faz duas coisas dependendo do modo e um atalho que ninguem ensina.
    teclas: [{ tecla: 'f' }, { tecla: 'F' }],
    escrito: 'F',
    descricao: 'Abrir e fechar a ficha completa do corpo escolhido, na lateral',
    acao: () => ({ tipo: 'alternar-ficha' }),
  },
  {
    teclas: [{ tecla: 'i' }, { tecla: 'I' }],
    escrito: 'I',
    descricao: 'Entrar e sair do modo imersivo: tela cheia, e W A S D para voar',
    acao: () => ({ tipo: 'alternar-imersivo' }),
  },
  {
    teclas: [{ tecla: 'l' }, { tecla: 'L' }],
    escrito: 'L',
    descricao: 'Passar as luas por com, sem, e só elas',
    // Ciclar tem acao PROPRIA em vez de um `definir-luas` com o proximo valor
    // dentro. O proximo valor depende do atual, e quem tem o atual e o reducer:
    // calcula-lo aqui exigiria que o mapa de teclas lesse o estado, e um mapa
    // de teclas que le estado deixa de ser uma tabela.
    acao: () => ({ tipo: 'ciclar-luas' }),
  },
  {
    teclas: [{ tecla: 'c' }, { tecla: 'C' }],
    escrito: 'C',
    descricao: 'Comparar dois corpos',
    acao: () => ({ tipo: 'abrir-tela', tela: 'comparar' }),
  },
  {
    // `G` de "guardar", e nao o `S` de "salvar" que estava aqui.
    //
    // O `S` do voo anda para tras, e com o `S` da captura no mesmo lugar a tecla
    // faria duas coisas conforme o modo: fora dele salvaria uma imagem, dentro
    // dele daria re. O `App` ate suprime as teclas de voo para o atalho nao
    // disparar, mas suprimir e um remendo — a tabela de atalhos continuaria
    // dizendo "S: salvar uma imagem da tela" para quem esta no modo em que ela
    // nao faz isso. `voo.test.ts` reprova qualquer atalho de uma letra que caia
    // sobre W, A, S, D, Q ou E, e foi esse teste que apontou esta.
    teclas: [{ tecla: 'g' }, { tecla: 'G' }],
    escrito: 'G',
    descricao: 'Guardar uma imagem da tela',
    acao: () => ({ tipo: 'capturar-tela' }),
  },
  {
    teclas: [{ tecla: 'F1' }, { tecla: '?' }, { tecla: '/' }],
    escrito: 'F1 ou ?',
    descricao: 'Abrir a ajuda',
    acao: () => ({ tipo: 'abrir-tela', tela: 'ajuda' }),
  },
  {
    // Cmd/Ctrl+Z, sem Shift. Ver `semShift` acima.
    teclas: [
      { tecla: 'z', meta: true, semShift: true },
      { tecla: 'Z', meta: true, semShift: true },
    ],
    escrito: 'Cmd+Z ou Ctrl+Z',
    descricao: 'Desfazer a última criação ou remoção',
    acao: () => ({ tipo: 'desfazer' }),
  },
  {
    teclas: [{ tecla: 'Escape' }],
    escrito: 'Esc',
    // Esc NUNCA encerra o programa. Fechar a aba faz isso; uma tecla que
    // encerra sem perguntar nao.
    descricao: 'Fechar a caixa aberta',
    acao: () => ({ tipo: 'fechar' }),
  },
];

/** Teclas que o `<dialog>` e os componentes tratam sozinhos, e nao aparecem aqui. */
export const TECLAS_DO_NAVEGADOR = ['Tab', 'Enter', 'Page Up', 'Page Down', 'Home', 'End'] as const;

/**
 * A tabela escrita, como a Ajuda mostra.
 *
 * Derivada do mapa, e nao escrita a mao — na versao anterior o rodape era uma
 * string com os atalhos, e qualquer mudanca no codigo a deixava mentindo sem
 * ninguem notar. `atalhos.test.ts` confere os dois sentidos mesmo assim.
 */
export const TABELA_DE_ATALHOS: { escrito: string; descricao: string }[] = (() => {
  const vistos = new Map<string, string>();
  for (const a of ATALHOS) if (!vistos.has(a.escrito)) vistos.set(a.escrito, a.descricao);
  return [...vistos].map(([escrito, descricao]) => ({ escrito, descricao }));
})();

/**
 * Do evento de teclado para a acao, ou null quando a tecla nao e nossa.
 *
 * **Shift nao entra na comparacao**, e isso e deliberado. `KeyboardEvent.key`
 * ja entrega o caractere DEPOIS do Shift: quem aperta Shift+/ recebe `key`
 * igual a `'?'`. Comparar `shiftKey` alem disso quebraria justamente o atalho
 * da Ajuda, que so existe com Shift apertado — e foi o que a primeira versao
 * desta funcao fazia.
 *
 * Onde o Shift MUDA o que a tecla faz — nas setas, que orbitam sem ele e
 * deslocam com ele —, quem decide e a propria acao, que recebe o estado do
 * Shift. Assim nao ha duas entradas quase iguais no mapa.
 *
 * Meta/Ctrl, esse sim, entra: um atalho de uma letra nao pode disparar quando
 * a pessoa quis um atalho do navegador (Cmd+S para salvar a pagina, por
 * exemplo).
 */
export function resolver(
  evento: { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  alvo: AlvoDaTecla | null,
): Acao | null {
  if (!atalhoGlobalPodeAgir(evento.key, alvo)) return null;
  const comModificador = evento.metaKey || evento.ctrlKey;
  for (const atalho of ATALHOS) {
    for (const t of atalho.teclas) {
      if (t.tecla !== evento.key) continue;
      if ((t.meta ?? false) !== comModificador) continue;
      if (t.semShift === true && evento.shiftKey) continue;
      return atalho.acao({ shift: evento.shiftKey });
    }
  }
  return null;
}
