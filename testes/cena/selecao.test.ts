/**
 * Escolher um corpo clicando nele, e aproximar sem o mundo escorregar.
 *
 * As duas coisas dependem da mesma pergunta — "o que esta sob este pixel" — e
 * por dez fases o programa nao sabia responder. O contrato marcava quatro
 * itens como parciais por causa disso.
 */
import { describe, expect, it } from 'vitest';
import { ALVO_MINIMO_PX, corpoSobOPonto, pontoNoPlanoDoPivo, type Alvo } from '@cena/selecao.ts';
import {
  aproximar,
  aproximarEm,
  criarCamera,
  direcaoDeVista,
  posicaoDaCamera,
  RAIO_MINIMO_UA,
} from '@cena/camera/cameraOrbital.ts';

const alvo = (chave: string, x: number, y: number, extra: Partial<Alvo> = {}): Alvo => ({
  chave,
  x,
  y,
  raioPx: 4,
  naFrente: true,
  ocluido: false,
  distanciaUa: 10,
  ...extra,
});

describe('o corpo sob o ponto', () => {
  it('acerta dentro do disco e erra fora do alcance', () => {
    const a = [alvo('terra', 100, 100, { raioPx: 30 })];
    expect(corpoSobOPonto(a, 100, 100)).toBe('terra');
    expect(corpoSobOPonto(a, 128, 100)).toBe('terra');
    expect(corpoSobOPonto(a, 140, 100)).toBeNull();
  });

  it('um corpo minusculo ainda tem alvo de 24 px de diametro', () => {
    // Mercurio na visao geral tem tres pixels de disco. Sem o piso, escolhe-lo
    // com o ponteiro exigiria precisao de cirurgiao, e a regra "todo gesto de
    // ponteiro tem caminho por teclado" viraria "so o teclado funciona".
    const a = [alvo('mercurio', 100, 100, { raioPx: 1.5 })];
    expect(ALVO_MINIMO_PX * 2).toBe(24); // o minimo do criterio 2.5.8
    expect(corpoSobOPonto(a, 111, 100)).toBe('mercurio');
    expect(corpoSobOPonto(a, 113, 100)).toBeNull();
  });

  it('ganha quem tem o CENTRO mais perto do clique, em fracao do proprio alvo', () => {
    // O criterio "o mais perto da camera ganha" parece certo e nao e: na
    // visao geral os quatro internos cabem dentro do disco do Sol mais o alvo
    // minimo, e clicar em cima da Terra escolhia o Sol — que por acaso estava
    // mais perto. Medido na tela antes desta regra existir.
    const a = [
      alvo('sol', 470, 300, { raioPx: 11.6, distanciaUa: 31.5 }),
      alvo('terra', 464, 290, { raioPx: 5.3, distanciaUa: 30.8 }),
    ];
    expect(corpoSobOPonto(a, 464, 290), 'cliquei no centro da Terra').toBe('terra');
    expect(corpoSobOPonto(a, 470, 300), 'cliquei no centro do Sol').toBe('sol');
  });

  it('entre dois centros a igual fracao, ganha o que esta na frente', () => {
    const a = [
      alvo('longe', 100, 100, { raioPx: 20, distanciaUa: 30 }),
      alvo('perto', 100, 100, { raioPx: 20, distanciaUa: 1 }),
    ];
    expect(corpoSobOPonto(a, 100, 100)).toBe('perto');
  });

  it('quem esta atras de outro corpo nao rouba o clique', () => {
    const a = [
      alvo('atras', 100, 100, { raioPx: 20, distanciaUa: 1, ocluido: true }),
      alvo('na frente', 100, 100, { raioPx: 20, distanciaUa: 30 }),
    ];
    expect(corpoSobOPonto(a, 100, 100)).toBe('na frente');
  });

  it('mas um clique onde SO ha corpo escondido nao vira um nada silencioso', () => {
    const a = [alvo('atras', 100, 100, { ocluido: true })];
    expect(corpoSobOPonto(a, 100, 100)).toBe('atras');
  });

  it('quem esta atras da camera nunca e clicavel', () => {
    // Em ortografica isso nao existia. Em perspectiva, ignorar `naFrente` faz
    // o corpo aparecer espelhado do outro lado da tela — e clicavel la.
    const a = [alvo('costas', 100, 100, { raioPx: 50, naFrente: false })];
    expect(corpoSobOPonto(a, 100, 100)).toBeNull();
  });

  it('clique no vazio devolve nulo', () => {
    expect(corpoSobOPonto([alvo('terra', 10, 10)], 800, 600)).toBeNull();
    expect(corpoSobOPonto([], 0, 0)).toBeNull();
  });
});

describe('o zoom ancorado no cursor', () => {
  const olhoEDirecao = (c: ReturnType<typeof criarCamera>) => ({
    olho: posicaoDaCamera(c),
    vista: direcaoDeVista(c),
  });

  it('o ponto sob o cursor continua sob o cursor', () => {
    // A propriedade inteira. Medida do jeito que se enxerga: onde a ancora cai
    // na tela, em coordenadas do plano da camera, antes e depois.
    const c = criarCamera({ raio: 10, azimute: 0.3, elevacao: 0.4 });
    const { olho, vista } = olhoEDirecao(c);
    // Um cursor fora do centro: 0,2 rad para o lado.
    const lado: [number, number, number] = [-Math.sin(c.azimute), Math.cos(c.azimute), 0];
    const dir: [number, number, number] = [
      vista[0] + 0.2 * lado[0],
      vista[1] + 0.2 * lado[1],
      vista[2] + 0.2 * lado[2],
    ];
    const n = Math.hypot(...dir);
    const unit: [number, number, number] = [dir[0] / n, dir[1] / n, dir[2] / n];

    const ancora = pontoNoPlanoDoPivo(olho, unit, vista, c.raio)!;
    expect(ancora).not.toBeNull();

    // O angulo entre a direcao de vista e a direcao da ancora, visto da
    // camera: e isso que decide em que pixel ela cai.
    const anguloAte = (cam: typeof c): number => {
      const o = posicaoDaCamera(cam);
      const v = direcaoDeVista(cam);
      const d: [number, number, number] = [ancora[0] - o[0], ancora[1] - o[1], ancora[2] - o[2]];
      const m = Math.hypot(...d);
      return Math.acos(Math.min(1, (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / m));
    };
    const antes = anguloAte(c);
    aproximarEm(c, 4, ancora);
    expect(anguloAte(c), 'a ancora saiu de onde estava na tela').toBeCloseTo(antes, 12);
  });

  it('o raio muda exatamente como no zoom sem ancora', () => {
    const comAncora = criarCamera({ raio: 8 });
    const sem = criarCamera({ raio: 8 });
    aproximarEm(comAncora, 2.5, [1, 2, 3]);
    aproximar(sem, 2.5);
    expect(comAncora.raio).toBe(sem.raio);
  });

  it('a direcao de vista NAO muda: o mundo nao gira enquanto se aproxima', () => {
    const c = criarCamera({ raio: 8, azimute: 1.1, elevacao: -0.3 });
    const antes = direcaoDeVista(c);
    aproximarEm(c, 3, [5, -2, 1]);
    expect(direcaoDeVista(c)).toEqual(antes);
  });

  it('no limite do zoom o pivo para de escorregar', () => {
    // Sem cortar o fator pelo raio efetivo, no fundo do zoom a imagem ficaria
    // parada e a cena andaria de lado sozinha, para sempre.
    const c = criarCamera({ raio: RAIO_MINIMO_UA });
    const pivo = [...c.pivo];
    aproximarEm(c, 10, [1, 1, 1]);
    expect(c.pivo).toEqual(pivo);
  });

  it('afastar desfaz aproximar, no pivo e no raio', () => {
    const c = criarCamera({ raio: 5, azimute: 0.7, elevacao: 0.2 });
    const pivo = [...c.pivo];
    const ancora: [number, number, number] = [0.4, -1.2, 0.05];
    aproximarEm(c, 3, ancora);
    aproximarEm(c, 1 / 3, ancora);
    expect(c.raio).toBeCloseTo(5, 12);
    c.pivo.forEach((v, i) => expect(v).toBeCloseTo(pivo[i]!, 12));
  });

  it('com o cursor quase paralelo ao plano, nao ha ancora — e isso e dito', () => {
    // A interseccao dispara para o infinito, e uma ancora a unidades
    // astronomicas de distancia jogaria a camera para fora do Sistema Solar.
    const vista: [number, number, number] = [0, 0, -1];
    const rasante: [number, number, number] = [1, 0, -0.05];
    expect(pontoNoPlanoDoPivo([0, 0, 10], rasante, vista, 10)).toBeNull();
    expect(pontoNoPlanoDoPivo([0, 0, 10], vista, vista, 10)).not.toBeNull();
  });
});
