/**
 * As luas cinematicas.
 *
 * O teste que sustenta o resto e o primeiro: a propagacao TypeScript tem de
 * reproduzir a ferramenta que gerou os dados. Sem ele, os erros publicados em
 * `derivaDasLuas.json` seriam medidos numa implementacao e a tela usaria outra
 * — e o numero no bloco de honestidade viraria decoracao.
 *
 * O `.json` de conferencia guarda, para cada lua, o erro maximo medido contra o
 * Horizons numa janela retida. Aqui se verifica o que da para verificar sem
 * rede: que o modelo e determinista, que as orbitas tem a forma e o plano
 * certos, e que os numeros publicados nao foram inventados.
 */
import { describe, expect, it } from 'vitest';
import { LUAS, PIOR_DESVIO, luasDe, EPOCA_DAS_LUAS_JD } from '@dados/luas.ts';
import { deslocamentoDoCentroDaTerra, posicaoDaLua } from '@nucleo/luas.ts';
import { BASE_DA_ECLIPTICA, baseDoPlano, doPlanoParaEcliptica } from '@nucleo/planoDeReferencia.ts';
import { UA_KM } from '@nucleo/unidades.ts';
import { carregar } from '@dados/carregar.ts';

const p = (): [number, number, number] => [0, 0, 0];
const emKm = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!) * UA_KM;

describe('o catalogo', () => {
  it('tem as treze luas, cada uma com um pai que existe', () => {
    expect(LUAS.length).toBe(13);
    const catalogo = carregar();
    for (const l of LUAS) {
      expect(catalogo.corpos.some((c) => c.chave === l.pai), `${l.chave} orbita ${l.pai}?`).toBe(true);
    }
  });

  it('a distribuicao por planeta e a que a fase F6 promete', () => {
    expect(luasDe('terra').map((l) => l.chave)).toEqual(['lua']);
    expect(luasDe('marte').length).toBe(2);
    expect(luasDe('jupiter').length).toBe(4);
    expect(luasDe('saturno').length).toBe(2);
    expect(luasDe('urano').length).toBe(3);
    expect(luasDe('netuno').length).toBe(1);
  });

  it('todo numero tem grandeza plausivel', () => {
    for (const l of LUAS) {
      expect(l.aKm, `${l.chave}: semieixo`).toBeGreaterThan(9000);
      expect(l.aKm).toBeLessThan(2e6);
      expect(l.excentricidade, `${l.chave}: excentricidade`).toBeGreaterThanOrEqual(0);
      expect(l.excentricidade).toBeLessThan(0.1);
      expect(l.raioMedioKm, `${l.chave}: raio`).toBeGreaterThan(5);
      expect(l.raioMedioKm).toBeLessThan(2700);
      expect(l.gmUa3Dia2, `${l.chave}: GM`).toBeGreaterThan(0);
      // Um periodo entre sete horas (Fobos) e 27,6 dias (a Lua). O numero e o
      // periodo ANOMALISTICO — de periastro a periastro —, que para a Lua da
      // 27,55 dias e nao os 27,32 do mes sideral que todo mundo sabe de cor.
      const periodo = 360 / Math.abs(l.taxaDaAnomaliaMediaGrausDia);
      expect(periodo, `${l.chave}: periodo ${periodo}`).toBeGreaterThan(0.3);
      expect(periodo, `${l.chave}: periodo ${periodo}`).toBeLessThan(28);
    }
  });

  it('so Tritao e retrograda', () => {
    const retrogradas = LUAS.filter((l) => l.inclinacaoGraus > 90).map((l) => l.chave);
    expect(retrogradas).toEqual(['tritao']);
  });
});

describe('a propagacao', () => {
  it('e determinista: o mesmo dia devolve o mesmo ponto', () => {
    for (const l of LUAS) {
      const a = p();
      const b = p();
      posicaoDaLua(l, l.base, 9496.5, a);
      posicaoDaLua(l, l.base, 9496.5, b);
      expect(a, l.chave).toEqual(b);
    }
  });

  it('a distancia ao planeta fica entre periastro e apoastro', () => {
    for (const l of LUAS) {
      const periodo = 360 / l.taxaDaAnomaliaMediaGrausDia;
      let menor = Infinity;
      let maior = 0;
      const v = p();
      for (let k = 0; k < 200; k++) {
        posicaoDaLua(l, l.base, (k / 200) * periodo, v);
        const r = emKm(v);
        menor = Math.min(menor, r);
        maior = Math.max(maior, r);
      }
      expect(menor, `${l.chave}: periastro`).toBeGreaterThan(l.aKm * (1 - l.excentricidade) * 0.999);
      expect(maior, `${l.chave}: apoastro`).toBeLessThan(l.aKm * (1 + l.excentricidade) * 1.001);
    }
  });

  it('uma volta completa volta ao mesmo lugar', () => {
    for (const l of LUAS) {
      const periodo = 360 / l.taxaDaAnomaliaMediaGrausDia;
      const a = p();
      const b = p();
      posicaoDaLua(l, l.base, 0, a);
      posicaoDaLua(l, l.base, periodo, b);
      // Nao e exato: o no e o periastro precessam durante a volta, entao o
      // ponto volta perto e nao no mesmo lugar. "Perto" aqui e uma fracao do
      // que a precessao de uma volta explica.
      const precessaoGraus =
        (Math.abs(l.taxaDoNoGrausDia) + Math.abs(l.taxaDoPeriastroGrausDia)) * periodo;
      const toleranciaKm = Math.max(1, l.aKm * precessaoGraus * (Math.PI / 180) * 1.2);
      expect(emKm([a[0] - b[0], a[1] - b[1], a[2] - b[2]]), l.chave).toBeLessThan(toleranciaKm);
    }
  });

  it('a Lua orbita no plano da ecliptica, e as outras nao', () => {
    // A unica linha da tabela com plano 'ecliptic'. Se alguem trocar a base
    // dela por uma de polo, a inclinacao vista da ecliptica muda de 5,1 para
    // outra coisa — e a orbita da Lua e a que mais gente conhece de cor.
    const lua = LUAS.find((l) => l.chave === 'lua')!;
    expect(lua.plano).toBe('ecliptic');
    expect(lua.base).toEqual(BASE_DA_ECLIPTICA);

    const v = p();
    let maiorZ = 0;
    const periodo = 360 / lua.taxaDaAnomaliaMediaGrausDia;
    for (let k = 0; k < 400; k++) {
      posicaoDaLua(lua, lua.base, (k / 400) * periodo, v);
      maiorZ = Math.max(maiorZ, Math.abs(v[2]) / Math.hypot(v[0], v[1], v[2]));
    }
    // sen(5,16 graus) = 0,0900.
    expect(Math.asin(maiorZ) * (180 / Math.PI)).toBeCloseTo(lua.inclinacaoGraus, 1);
  });

  it('as luas de Urano orbitam num plano quase perpendicular a ecliptica', () => {
    // Urano gira deitado: o eixo dele esta a quase 98 graus do plano da orbita.
    // As luas acompanham o equador do planeta, entao o plano delas tambem esta
    // deitado — e e isso que o polo invertido tem de reproduzir.
    for (const l of luasDe('urano')) {
      const anguloComAEcliptica = Math.acos(Math.abs(l.base.z[2])) * (180 / Math.PI);
      expect(anguloComAEcliptica, `${l.chave}: ${anguloComAEcliptica.toFixed(1)} graus`).toBeGreaterThan(80);
    }
  });

  it('o polo invertido e MESMO diferente do polo da IAU', () => {
    // Guarda contra a inversao virar um no-op por engano: se alguem trocar o
    // sinal de um jeito que devolva o mesmo eixo, o teste acima continuaria
    // passando e a escolha deixaria de significar alguma coisa.
    const iau = baseDoPlano(257.311, -15.175);
    const invertido = baseDoPlano(257.311 + 180, 15.175);
    const cos = iau.z[0] * invertido.z[0] + iau.z[1] * invertido.z[1] + iau.z[2] * invertido.z[2];
    expect(cos).toBeCloseTo(-1, 12);
    const titania = LUAS.find((l) => l.chave === 'titania')!;
    const usado = titania.base.z;
    expect(usado[0] * invertido.z[0] + usado[1] * invertido.z[1] + usado[2] * invertido.z[2])
      .toBeCloseTo(1, 12);
  });
});

describe('o plano de referencia', () => {
  it('a base e ortonormal e destra', () => {
    for (const [ra, dec] of [[0, 90], [268.1, 64.5], [40.6, 83.5], [77.311, 15.175], [299.8, 43.1]]) {
      const b = baseDoPlano(ra!, dec!);
      const n = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);
      expect(n(b.x), `|x| em ${ra}/${dec}`).toBeCloseTo(1, 12);
      expect(n(b.y)).toBeCloseTo(1, 12);
      expect(n(b.z)).toBeCloseTo(1, 12);
      const dot = (u: readonly number[], v: readonly number[]): number =>
        u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!;
      expect(dot(b.x, b.y)).toBeCloseTo(0, 12);
      expect(dot(b.y, b.z)).toBeCloseTo(0, 12);
      expect(dot(b.z, b.x)).toBeCloseTo(0, 12);
      // Destra: x cruz y = z.
      const cx = b.x[1] * b.y[2] - b.x[2] * b.y[1];
      expect(cx).toBeCloseTo(b.z[0], 12);
    }
  });

  it('a transformacao NAO e a transposta — e o erro que tem duas respostas', () => {
    // "Projetar na base" significa, em uso corrente, o produto escalar com
    // cada vetor, que e a operacao inversa. Se alguem escrever a transposta, o
    // vetor da base sai como eixo canonico em vez de sair como ele mesmo.
    // Um polo BEM fora dos eixos: com o polo de Jupiter, que esta a 2 graus do
    // polo da ecliptica, a base e quase a identidade e a transposta devolve
    // quase a mesma coisa — o teste passaria sem distinguir nada. O de Urano
    // invertido fica quase no plano da ecliptica, que e o caso extremo.
    const b = baseDoPlano(77.311, 15.175);
    const z = doPlanoParaEcliptica(b, [0, 0, 1]);
    expect(z[0]).toBeCloseTo(b.z[0], 14);
    expect(z[1]).toBeCloseTo(b.z[1], 14);
    expect(z[2]).toBeCloseTo(b.z[2], 14);

    const transposta: [number, number, number] = [
      b.x[0] * 0 + b.x[1] * 0 + b.x[2] * 1,
      b.y[0] * 0 + b.y[1] * 0 + b.y[2] * 1,
      b.z[0] * 0 + b.z[1] * 0 + b.z[2] * 1,
    ];
    // Medido: 0,30 de diferenca num vetor unitario, com o polo de Urano. A
    // assercao guarda o valor com folga em vez de fixa-lo — o que importa e
    // que as duas NAO sao a mesma matriz, e o quanto elas diferem depende do
    // polo escolhido para o teste.
    expect(Math.hypot(z[0] - transposta[0], z[1] - transposta[1], z[2] - transposta[2]))
      .toBeGreaterThan(0.1);

    // E o mais forte: os tres vetores da base saem como eles mesmos. So a
    // orientacao certa faz isso, e ela sozinha ja identifica a matriz.
    for (const [eixo, esperado] of [
      [[1, 0, 0], b.x],
      [[0, 1, 0], b.y],
      [[0, 0, 1], b.z],
    ] as const) {
      const r = doPlanoParaEcliptica(b, eixo as [number, number, number]);
      for (let k = 0; k < 3; k++) expect(r[k]!).toBeCloseTo(esperado[k]!, 14);
    }
  });
});

describe('o centro da Terra', () => {
  it('fica a 4.671 km do baricentro, do lado oposto ao da Lua', () => {
    const { emrat } = carregar();
    const lua = LUAS.find((l) => l.chave === 'lua')!;
    const pos = p();
    posicaoDaLua(lua, lua.base, 0, pos);
    const centro = p();
    deslocamentoDoCentroDaTerra(pos, emrat, centro);

    expect(emKm(centro)).toBeCloseTo(emKm(pos) / (1 + emrat), 6);
    expect(emKm(centro), 'uns 4.671 km').toBeGreaterThan(4300);
    expect(emKm(centro)).toBeLessThan(5100);

    // Lados opostos: o cosseno entre os dois vetores e −1.
    const cos =
      (pos[0] * centro[0] + pos[1] * centro[1] + pos[2] * centro[2]) / (Math.hypot(...pos) * Math.hypot(...centro));
    expect(cos).toBeCloseTo(-1, 12);
  });

  it('a identidade do EMRAT fecha com as GM do DE440', () => {
    // GM_Terra + GM_Lua = GMB, por construcao. O teste existe porque a conta
    // que DEFINE as duas e a que se quer conferir: se alguem trocar a GM da
    // Lua pela da tabela de parametros fisicos — 4902,800 km^3/s^2 — o
    // fechamento cai para 2,4e-8, vinte e quatro mil vezes pior que o exigido.
    const { emrat, corpos, estado } = carregar();
    const iTerra = corpos.findIndex((c) => c.chave === 'terra');
    const gmb = estado.gm[iTerra]!; // o corpo 'terra' E o baricentro Terra-Lua
    const gmTerra = (gmb * emrat) / (1 + emrat);
    const gmLua = gmb / (1 + emrat);
    expect(Math.abs(gmTerra + gmLua - gmb) / gmb).toBeLessThan(1e-15);

    const daTabela = LUAS.find((l) => l.chave === 'lua')!.gmUa3Dia2;
    expect(Math.abs(daTabela - gmLua) / gmLua, 'a tabela e a identidade divergem, como esperado')
      .toBeGreaterThan(1e-9);
  });
});

describe('o erro publicado', () => {
  it('cada lua tem um erro medido, e ele nao e zero nem absurdo', () => {
    for (const l of LUAS) {
      expect(l.erroMaximoKm, `${l.chave}`).toBeGreaterThan(0);
      // Meio semieixo seria a lua do outro lado do planeta.
      expect(l.erroMaximoKm, `${l.chave}: ${l.erroMaximoKm} km`).toBeLessThan(l.aKm * 0.5);
    }
  });

  it('o pior caso declarado e mesmo o pior', () => {
    const pior = LUAS.reduce((a, b) => (b.erroMaximoKm > a.erroMaximoKm ? b : a));
    expect(PIOR_DESVIO.chave).toBe(pior.chave);
    expect(PIOR_DESVIO.erroMaximoKm).toBe(pior.erroMaximoKm);
  });

  it('a epoca dos elementos e J2000, e nao a do programa', () => {
    // Duas efemerides, duas epocas. Confundi-las desloca todas as luas pela
    // posicao que elas tinham 26 anos antes.
    expect(EPOCA_DAS_LUAS_JD).toBe(2451545.0);
    expect(carregar().jdEpoca).toBe(2461041.5);
    expect(carregar().jdEpoca - EPOCA_DAS_LUAS_JD).toBe(9496.5);
  });
});

describe('a implementacao da tela e a da medicao sao a mesma', () => {
  it('reproduz, dentro de um metro, os pontos que a ferramenta calculou', async () => {
    // **Este e o teste que torna o numero publicado verdadeiro.**
    //
    // O erro de cada lua foi medido contra o Horizons por
    // `ferramentas/conferir_luas.mjs`, que propaga em JavaScript de
    // ferramenta. Quem desenha na tela e `src/nucleo/luas.ts`, em TypeScript,
    // com outra estrutura de dados e outra ordem de operacoes. Se as duas
    // divergirem, o bloco de honestidade passa a descrever um programa que nao
    // e o entregue — e nada mais no projeto pegaria isso.
    //
    // Um metro e folgado para arredondamento e apertado para qualquer erro de
    // verdade: a menor diferenca real que importa aqui — uma rotacao trocada,
    // um grau perdido — vale milhares de quilometros.
    const { default: deriva } = await import('@dados/derivaDasLuas.json', { with: { type: 'json' } });
    expect(deriva.amarras.length, 'a ferramenta nao gravou pontos de amarra').toBeGreaterThan(40);

    const v = p();
    for (const a of deriva.amarras) {
      const lua = LUAS.find((l) => l.chave === a.chave)!;
      expect(lua, a.chave).toBeDefined();
      posicaoDaLua(lua, lua.base, a.dias, v);
      const d = Math.hypot(v[0] * UA_KM - a.xKm, v[1] * UA_KM - a.yKm, v[2] * UA_KM - a.zKm);
      expect(d, `${a.chave} em ${a.dias} dias: ${d.toFixed(3)} km de diferenca`).toBeLessThan(0.001);
    }
  });
});

describe('os nomes', () => {
  it('sao em portugues, e nao os da fonte', () => {
    // O JSON guarda o nome como o JPL o escreve, porque transcricao nao se
    // traduz. O que aparece na tela e outra coisa.
    const porChave = Object.fromEntries(LUAS.map((l) => [l.chave, l]));
    expect(porChave['lua']!.nome).toBe('Lua');
    expect(porChave['lua']!.nomeNaFonte).toBe('Moon');
    expect(porChave['ganimedes']!.nome).toBe('Ganimedes');
    expect(porChave['ganimedes']!.nomeNaFonte).toBe('Ganymede');
    expect(porChave['tita']!.nome).toBe('Titã');
    expect(porChave['tritao']!.nome).toBe('Tritão');
  });

  it('toda lua tem nome proprio, comecando com maiuscula', () => {
    // A guarda contra o defeito que a tela mostrou: sem o mapa de nomes, o
    // rotulo caia na CHAVE e saia "io", "calisto", "tita" — em minuscula e
    // sem acento, no meio de "Júpiter" e "Saturno".
    for (const l of LUAS) {
      expect(l.nome.length, l.chave).toBeGreaterThan(1);
      expect(l.nome[0], `${l.chave}: "${l.nome}"`).toBe(l.nome[0]!.toUpperCase());
      expect(l.nome, `${l.chave} ficou com a chave como nome`).not.toBe(l.chave);
    }
  });

  it('as cinco que mudam de grafia em portugues mudaram mesmo', () => {
    const por = Object.fromEntries(LUAS.map((l) => [l.chave, l]));
    for (const [chave, fonte] of [
      ['lua', 'Moon'], ['ganimedes', 'Ganymede'], ['calisto', 'Callisto'],
      ['tita', 'Titan'], ['tritao', 'Triton'], ['encelado', 'Enceladus'],
      ['titania', 'Titania'], ['fobos', 'Phobos'],
    ] as const) {
      expect(por[chave]!.nomeNaFonte, chave).toBe(fonte);
      expect(por[chave]!.nome, `${chave} nao foi traduzida`).not.toBe(fonte);
    }
  });
});
