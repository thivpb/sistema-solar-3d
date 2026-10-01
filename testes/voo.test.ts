/**
 * O voo livre: a matematica da camera e a leitura das teclas.
 *
 * Duas coisas sao medidas aqui, e as duas ja quebraram numa versao anterior
 * deste arquivo:
 *
 *   1. **Voar move o pivo e NAO mexe no raio.** Sao gestos diferentes com donos
 *      diferentes, e confundi-los faria "andar para frente" bater no limite de
 *      zoom e parar numa parede invisivel.
 *   2. **A diagonal nao anda mais rapido que a reta.** Sem normalizar o rumo,
 *      W+A anda `raiz de 2` vezes mais depressa que W.
 */
import { describe, expect, it } from 'vitest';
import { criarCamera, posicaoDaCamera, direcaoDeVista, RAIO_MAXIMO_UA } from '../src/cena/camera/cameraOrbital.ts';
import {
  FATOR_DO_TURBO,
  FRACAO_DO_RAIO_POR_SEGUNDO,
  baseDaCamera,
  velocidadeDeVooUaPorS,
  voar,
} from '../src/cena/camera/voo.ts';
import { PARADO, TECLAS_DE_VOO, ligarVoo } from '../src/app/voo.ts';

const modulo = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);
const escalar = (a: readonly number[], b: readonly number[]): number =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe('a base da camera', () => {
  it('sao tres versores ortogonais entre si, em qualquer orientacao', () => {
    for (const azimute of [-Math.PI / 2, 0, 1.3, 3.0]) {
      for (const elevacao of [-1.4, -0.2, 0, 0.45, 1.4]) {
        const c = criarCamera({ azimute, elevacao });
        const [direita, cima, frente] = baseDaCamera(c);
        for (const v of [direita, cima, frente]) expect(modulo(v)).toBeCloseTo(1, 12);
        expect(escalar(direita, cima)).toBeCloseTo(0, 12);
        expect(escalar(direita, frente)).toBeCloseTo(0, 12);
        expect(escalar(cima, frente)).toBeCloseTo(0, 12);
      }
    }
  });

  it('a frente E a direcao de vista, e nao o contrario dela', () => {
    // Trocar o sinal aqui faria o W andar de re — um bug que nao aparece em
    // nenhuma conta, so no dedo de quem usa.
    const c = criarCamera({ azimute: 1.1, elevacao: -0.3 });
    const [, , frente] = baseDaCamera(c);
    const vista = direcaoDeVista(c);
    for (let k = 0; k < 3; k++) expect(frente[k]).toBeCloseTo(vista[k]!, 12);
  });
});

describe('voar', () => {
  it('move o pivo E o olho pelo MESMO vetor, sem mexer no raio nem nos angulos', () => {
    const c = criarCamera({ pivo: [1, 2, 0.3], raio: 4, azimute: 0.7, elevacao: 0.2 });
    const olhoAntes = posicaoDaCamera(c);
    const pivoAntes: [number, number, number] = [...c.pivo];
    const anguloAntes = { azimute: c.azimute, elevacao: c.elevacao, raio: c.raio };

    voar(c, 0.5, -0.2, 0.1);

    const olhoDepois = posicaoDaCamera(c);
    for (let k = 0; k < 3; k++) {
      expect(olhoDepois[k]! - olhoAntes[k]!).toBeCloseTo(c.pivo[k]! - pivoAntes[k]!, 12);
    }
    expect(c.raio).toBe(anguloAntes.raio);
    expect(c.azimute).toBe(anguloAntes.azimute);
    expect(c.elevacao).toBe(anguloAntes.elevacao);
  });

  it('andar para frente aproxima do que esta a frente, e nao do que esta atras', () => {
    // A camera fica em (8,0,0) olhando para o pivo em (10,0,0) — `posicaoDaCamera`
    // soma `raio * direcao(azimute)`, e com azimute = pi essa direcao e -X.
    // Entao a frente e +X, e este teste mede a distancia a um ponto que esta
    // adiante do pivo, em vez de olhar a coordenada crua: um sinal trocado na
    // base passaria por uma comparacao de coordenada em metade das orientacoes.
    const c = criarCamera({ pivo: [10, 0, 0], raio: 2, azimute: Math.PI, elevacao: 0 });
    const adiante: [number, number, number] = [30, 0, 0];
    const distancia = (): number => Math.hypot(...posicaoDaCamera(c).map((v, k) => v - adiante[k]!));
    const antes = distancia();
    voar(c, 1, 0, 0);
    expect(distancia()).toBeCloseTo(antes - 1, 12);
  });

  it('nao deixa o pivo sair da redoma', () => {
    const c = criarCamera({ pivo: [0, 0, 0], raio: 1, azimute: 0, elevacao: 0 });
    voar(c, -1e6, 0, 0);
    expect(modulo(c.pivo)).toBeLessThanOrEqual(RAIO_MAXIMO_UA + 1e-9);
    // E a direcao sobrevive ao corte: quem voou para um lado continua daquele
    // lado, so que preso na casca.
    expect(c.pivo[0]).toBeGreaterThan(0);
  });

  it('um rumo nulo nao mexe em nada', () => {
    const c = criarCamera({ pivo: [3, 4, 5] });
    voar(c, 0, 0, 0);
    expect(c.pivo).toEqual([3, 4, 5]);
  });
});

describe('a velocidade escrita na tela', () => {
  it('e proporcional ao raio, para aproximar ser desacelerar', () => {
    const perto = criarCamera({ raio: 0.01 });
    const longe = criarCamera({ raio: 31.5 });
    expect(velocidadeDeVooUaPorS(perto, false)).toBeCloseTo(0.01 * FRACAO_DO_RAIO_POR_SEGUNDO, 12);
    expect(velocidadeDeVooUaPorS(longe, false) / velocidadeDeVooUaPorS(perto, false)).toBeCloseTo(3150, 9);
  });

  it('o turbo multiplica pelo fator declarado, e nao por um numero solto', () => {
    const c = criarCamera({ raio: 2 });
    expect(velocidadeDeVooUaPorS(c, true)).toBeCloseTo(velocidadeDeVooUaPorS(c, false) * FATOR_DO_TURBO, 12);
  });
});

// ── As teclas ───────────────────────────────────────────────────────────────

/** Um alvo de eventos de mentira, que e tudo que `ligarVoo` precisa. */
function bancada(ativo = true): { alvo: EventTarget; voo: ReturnType<typeof ligarVoo> } {
  const alvo = new EventTarget();
  return { alvo, voo: ligarVoo(alvo, { ativo: () => ativo }) };
}

const tecla = (tipo: 'keydown' | 'keyup', key: string, shiftKey = false): Event => {
  const ev = new Event(tipo, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  ev['key'] = key;
  ev['shiftKey'] = shiftKey;
  // `target` nao entra: ele e so-leitura, e `dispatchEvent` o preenche sozinho
  // com o alvo. O que chega la e um EventTarget sem `tagName`, que e
  // exatamente o caso "nao e campo de texto" que o modulo trata.
  return ev;
};

describe('as teclas de voo', () => {
  it('W anda para frente e S para tras, e os dois juntos param', () => {
    const { alvo, voo } = bancada();
    alvo.dispatchEvent(tecla('keydown', 'w'));
    expect(voo.rumo().frente).toBe(1);
    alvo.dispatchEvent(tecla('keydown', 's'));
    expect(voo.rumo().frente).toBe(0);
    alvo.dispatchEvent(tecla('keyup', 'w'));
    expect(voo.rumo().frente).toBe(-1);
    voo.desligar();
  });

  it('maiuscula e minuscula sao a mesma tecla — Shift muda o `key`', () => {
    const { alvo, voo } = bancada();
    alvo.dispatchEvent(tecla('keydown', 'W', true));
    expect(voo.rumo()).toMatchObject({ frente: 1, turbo: true });
    // E o `keyup` chega em MINUSCULA quando o Shift ja foi solto. Sem
    // normalizar os dois, a tecla ficaria presa para sempre.
    alvo.dispatchEvent(tecla('keyup', 'w'));
    expect(voo.rumo().frente).toBe(0);
    voo.desligar();
  });

  it('a diagonal NAO anda mais rapido que a reta', () => {
    const { alvo, voo } = bancada();
    alvo.dispatchEvent(tecla('keydown', 'w'));
    const reta = voo.rumo();
    alvo.dispatchEvent(tecla('keydown', 'd'));
    alvo.dispatchEvent(tecla('keydown', 'e'));
    const diagonal = voo.rumo();
    const m = (r: typeof reta): number => Math.hypot(r.frente, r.direita, r.cima);
    expect(m(reta)).toBeCloseTo(1, 12);
    expect(m(diagonal)).toBeCloseTo(1, 12);
    voo.desligar();
  });

  it('fora do modo nao ha rumo, mesmo com tecla apertada', () => {
    const alvo = new EventTarget();
    let ligado = true;
    const voo = ligarVoo(alvo, { ativo: () => ligado });
    alvo.dispatchEvent(tecla('keydown', 'w'));
    expect(voo.rumo().frente).toBe(1);
    ligado = false;
    expect(voo.rumo()).toEqual(PARADO);
    voo.desligar();
  });

  it('`soltar` larga tudo — e o que salva de sair da janela com o dedo no W', () => {
    const { alvo, voo } = bancada();
    alvo.dispatchEvent(tecla('keydown', 'w'));
    alvo.dispatchEvent(tecla('keydown', 'a'));
    // Com duas teclas o rumo e normalizado, entao `frente` vale 1/raiz(2) e nao
    // 1. O que importa aqui e que ele NAO esteja parado antes do `soltar`.
    expect(voo.rumo()).not.toEqual(PARADO);
    voo.soltar();
    expect(voo.rumo()).toEqual(PARADO);
    voo.desligar();
  });

  it('Cmd e Ctrl nao voam: sao atalhos do navegador', () => {
    const alvo = new EventTarget();
    const voo = ligarVoo(alvo, { ativo: () => true });
    const ev = tecla('keydown', 'w') as Event & Record<string, unknown>;
    ev['metaKey'] = true;
    alvo.dispatchEvent(ev);
    expect(voo.rumo()).toEqual(PARADO);
    voo.desligar();
  });

  it('`consome` cobre exatamente as seis teclas, e so dentro do modo', () => {
    const { voo } = bancada();
    for (const k of Object.keys(TECLAS_DE_VOO)) expect(voo.consome(k)).toBe(true);
    for (const k of ['f', 'i', 'l', 'v', 't', 'r', 'c', 'Escape', ' ']) {
      expect(voo.consome(k)).toBe(false);
    }
    voo.desligar();

    const fora = ligarVoo(new EventTarget(), { ativo: () => false });
    expect(fora.consome('w')).toBe(false);
    fora.desligar();
  });

  it('nenhuma tecla de voo colide com um atalho de uma letra', async () => {
    // Esta e a guarda que tirou o `D` da ficha completa. Se alguem acrescentar
    // um atalho em `w`, `a`, `s`, `d`, `q` ou `e`, ele passaria a fazer duas
    // coisas diferentes conforme o modo — e o projeto exige que a tabela de
    // atalhos seja ensinavel.
    const { ATALHOS } = await import('../src/app/atalhos.ts');
    for (const atalho of ATALHOS) {
      for (const t of atalho.teclas) {
        if (t.meta === true) continue; // Cmd+Z nao disputa com o voo
        expect(TECLAS_DE_VOO[t.tecla.toLowerCase()]).toBeUndefined();
      }
    }
  });
});
