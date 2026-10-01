#!/usr/bin/env python3
"""
Gera o arquivo de efemeride congelada usado pela simulacao.

Este script nao roda durante o uso normal do programa. Ele e uma das cinco
ferramentas que tocam a rede — as outras sao gerar_luas.mjs, conferir_luas.mjs,
gerar_estrelas.mjs e baixar_texturas.mjs —, e todas rodam uma vez, com o
resultado versionado.

**Veio do Sim_NewVer_1.0 sem uma linha alterada.** O JSON que ele produziu esta
copiado byte a byte, e `nucleo/efemeride.test.ts` compara a simulacao contra os
pontos de validacao que ele gravou. Esse teste e o unico do projeto que confere
contra uma fonte externa independente, e ele so vale se a configuracao testada
for a entregue: regerar o JSON invalida a comparacao ate que os pontos sejam
regerados junto. Ele baixa duas coisas do JPL:

  1. Os vetores de estado (posicao e velocidade) dos nove corpos na epoca
     escolhida, via a API do JPL Horizons.
  2. Os parametros gravitacionais GM, lidos do cabecalho ASCII da efemeride
     DE440/LE440.

O resultado e gravado em src/dados/ com toda a procedencia junto, e o programa
passa a funcionar offline a partir dali.

    python ferramentas/gerar_efemeride.py                  # epoca padrao
    python ferramentas/gerar_efemeride.py --epoca 2000-01-01
    python ferramentas/gerar_efemeride.py --validacao      # + pontos de conferencia

Por que estes centros: Horizons distingue o centro de um planeta (199, 299,
399...) do baricentro do sistema planetario dele (1, 2, 3...). Um sistema
planetario com luas se move, como um todo, praticamente como um ponto de massa
igual a soma das massas -- que e exatamente o que as constantes GM1..GM8 do
DE440 descrevem. Usar baricentro de sistema + GM de sistema e a combinacao
consistente, e e a mesma que o proprio JPL integra.
"""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta

HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
CABECALHO_DE440 = "https://ssd.jpl.nasa.gov/ftp/eph/planets/ascii/de440/header.440"

# chave interna -> (id do centro de massa usado na integracao,
#                   constante GM do cabecalho DE440,
#                   id do CENTRO do corpo, usado so para ler o raio fisico,
#                   nome exibido)
CORPOS = [
    ("sol",      "10", "GMS", "10",  "Sol"),
    ("mercurio", "1",  "GM1", "199", "Mercúrio"),
    ("venus",    "2",  "GM2", "299", "Vênus"),
    ("terra",    "3",  "GMB", "399", "Terra"),
    ("marte",    "4",  "GM4", "499", "Marte"),
    ("jupiter",  "5",  "GM5", "599", "Júpiter"),
    ("saturno",  "6",  "GM6", "699", "Saturno"),
    ("urano",    "7",  "GM7", "799", "Urano"),
    ("netuno",   "8",  "GM8", "899", "Netuno"),
]

EPOCA_PADRAO = "2026-01-01"


def _buscar(url, timeout=60):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def constantes_de440():
    """Le GM, AU, EMRAT e CLIGHT do cabecalho ASCII do DE440.

    O cabecalho traz os nomes no GROUP 1040 e os valores, na mesma ordem, no
    GROUP 1041. As GM vem em au^3/dia^2, que e a unidade que a simulacao usa.
    """
    txt = _buscar(CABECALHO_DE440)

    def grupo(n):
        m = re.search(r"GROUP\s+%d\s*\n(.*?)(?=GROUP|\Z)" % n, txt, re.S)
        if not m:
            raise RuntimeError(f"GROUP {n} nao encontrado no cabecalho DE440")
        return m.group(1).split()

    nomes, valores = grupo(1040), grupo(1041)
    qn, qv = int(nomes[0]), int(valores[0])
    nomes, valores = nomes[1:1 + qn], valores[1:1 + qv]
    if qn != qv:
        raise RuntimeError(f"cabecalho DE440 inconsistente: {qn} nomes, {qv} valores")

    return {n: float(v.replace("D", "E").replace("d", "E"))
            for n, v in zip(nomes, valores)}


def raio_horizons(id_centro):
    """Raio medio volumetrico do corpo, em km, lido da ficha do Horizons.

    Usa o id do centro do planeta (199, 299, ...), nao o do baricentro: raio e
    propriedade do corpo fisico. Serve so para a interface poder dizer o
    tamanho real e explicar o quanto o desenho esta ampliado.
    """
    consulta = [("format", "text"), ("COMMAND", f"'{id_centro}'"),
                ("OBJ_DATA", "'YES'"), ("MAKE_EPHEM", "'NO'")]
    txt = _buscar(HORIZONS + "?" + urllib.parse.urlencode(consulta))
    m = re.search(r"Vol\.\s*[Mm]ean\s*[Rr]adius[^=\n]*=\s*([0-9]+\.?[0-9]*)", txt)
    if not m:
        raise RuntimeError(f"raio medio nao encontrado na ficha de {id_centro}")
    return float(m.group(1))


def estado_horizons(id_corpo, epoca_iso):
    """Vetor de estado baricentrico de um corpo, em UA e UA/dia.

    Referencial: eclíptica e equinocio de J2000, sistema ICRF, origem no
    baricentro do Sistema Solar. Escala de tempo TDB. VEC_CORR='NONE' pede o
    estado geometrico, sem correcao de tempo-luz -- que e o que um integrador
    precisa.
    """
    consulta = [
        ("format", "text"), ("COMMAND", f"'{id_corpo}'"), ("OBJ_DATA", "'NO'"),
        ("MAKE_EPHEM", "'YES'"), ("EPHEM_TYPE", "'VECTORS'"),
        ("CENTER", "'500@0'"), ("REF_PLANE", "'ECLIPTIC'"),
        ("REF_SYSTEM", "'ICRF'"), ("VEC_TABLE", "'2'"), ("OUT_UNITS", "'AU-D'"),
        ("TLIST", f"'{epoca_iso}'"), ("TLIST_TYPE", "'CAL'"),
        ("VEC_CORR", "'NONE'"), ("CSV_FORMAT", "'YES'"),
    ]
    txt = _buscar(HORIZONS + "?" + urllib.parse.urlencode(consulta))
    if "$$SOE" not in txt:
        raise RuntimeError(f"Horizons nao devolveu vetores para {id_corpo}:\n{txt[:400]}")

    campos = [c.strip() for c in
              txt.split("$$SOE")[1].split("$$EOE")[0].strip().split(",")]
    jd = float(campos[0])
    pos = [float(v) for v in campos[2:5]]
    vel = [float(v) for v in campos[5:8]]

    fonte = re.search(r"Target body name:.*?\{source:\s*([A-Za-z0-9]+)\}", txt)
    return jd, pos, vel, (fonte.group(1) if fonte else "desconhecida")


def gerar(epoca_iso, anos_validacao=()):
    print(f"Lendo constantes GM do cabecalho DE440 ...", flush=True)
    const = constantes_de440()

    gm = {}
    for chave, _, nome_gm, _, _ in CORPOS:
        if nome_gm not in const:
            raise RuntimeError(f"constante {nome_gm} ausente no cabecalho DE440")
        gm[chave] = const[nome_gm]

    print("Lendo raios fisicos nas fichas do Horizons ...", flush=True)
    raios = {chave: raio_horizons(id_centro)
             for chave, _, _, id_centro, _ in CORPOS}

    print(f"Buscando vetores de estado no Horizons para {epoca_iso} ...", flush=True)
    corpos, jd_epoca, fontes = {}, None, set()
    for chave, id_h, _, id_centro, nome in CORPOS:
        jd, pos, vel, fonte = estado_horizons(id_h, epoca_iso)
        fontes.add(fonte)
        if jd_epoca is None:
            jd_epoca = jd
        elif jd != jd_epoca:
            raise RuntimeError(
                f"{nome} voltou em JD {jd}, diferente de {jd_epoca}. "
                "Todos os corpos precisam sair da MESMA epoca.")
        corpos[chave] = {"nome": nome, "id_horizons": id_h,
                         "id_horizons_centro": id_centro,
                         "gm_au3_dia2": gm[chave],
                         "raio_km": raios[chave],
                         "posicao_ua": pos,
                         "velocidade_ua_dia": vel}
        print(f"  {nome:<9} r = {sum(c*c for c in pos) ** 0.5:9.6f} UA", flush=True)

    dados = {
        "_leia_isto": (
            "Gerado por ferramentas/gerar_efemeride.py. Nao edite a mao: "
            "regenere. Os valores vem do JPL e nao devem ser arredondados."
        ),
        "procedencia": {
            "vetores_de_estado": {
                "fonte": "JPL Horizons API (ssd.jpl.nasa.gov/api/horizons.api)",
                "efemeride_citada_pelo_horizons": sorted(fontes),
                "centro": "baricentro do Sistema Solar (500@0)",
                "referencial": "ecliptica e equinocio de J2000, ICRF",
                "correcao": "VEC_CORR=NONE (estado geometrico)",
            },
            "raios_fisicos": {
                "fonte": "ficha de corpo do JPL Horizons (OBJ_DATA), raio medio volumetrico",
                "nota": ("lido do centro do planeta (199, 299, ...), nao do "
                         "baricentro. Usado so para informar o tamanho real; "
                         "a tela desenha os planetas ampliados."),
            },
            "parametros_gravitacionais": {
                "fonte": "cabecalho ASCII da efemeride DE440/LE440",
                "url": CABECALHO_DE440,
                "constantes": "GMS, GM1, GM2, GMB, GM4..GM8",
                "nota": ("DE441 e a integracao de longo alcance do mesmo modelo "
                         "dinamico do DE440; as constantes sao consistentes."),
            },
            "epoca": {"calendario_tdb": epoca_iso, "jd_tdb": jd_epoca},
            "escala_de_tempo": "TDB",
            "unidades": {"posicao": "UA", "velocidade": "UA/dia",
                         "gm": "UA^3/dia^2", "tempo": "dia"},
            "convencao_de_centros": (
                "Sol = corpo 10. Demais = baricentro do sistema planetario "
                "(ids 1..8) com a GM do sistema. 'Terra' e o baricentro "
                "Terra-Lua (id 3, GMB = GM_Terra + GM_Lua): o centro da Terra "
                "orbita esse ponto a cerca de 4670 km."
            ),
        },
        "constantes_de440": {
            "AU_km": const["AU"], "EMRAT": const["EMRAT"],
            "CLIGHT_km_s": const["CLIGHT"], "DENUM": const["DENUM"],
        },
        "ordem": [c[0] for c in CORPOS],
        "corpos": corpos,
        "validacao": {},
    }

    for anos in anos_validacao:
        alvo = (date.fromisoformat(epoca_iso) + timedelta(days=round(anos * 365.25))).isoformat()
        print(f"Buscando referencia de validacao em {alvo} ({anos:+} anos) ...", flush=True)
        ref = {}
        for chave, id_h, _, _, _ in CORPOS:
            jd, pos, vel, _ = estado_horizons(id_h, alvo)
            ref[chave] = {"posicao_ua": pos, "velocidade_ua_dia": vel}
        dados["validacao"][str(anos)] = {
            "calendario_tdb": alvo, "jd_tdb": jd,
            "dias_desde_a_epoca": jd - jd_epoca, "corpos": ref,
        }

    return dados


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--epoca", default=EPOCA_PADRAO, help="data TDB (YYYY-MM-DD)")
    p.add_argument("--saida", default=None, help="caminho do JSON de saida")
    p.add_argument("--validacao", action="store_true",
                   help="inclui pontos de referencia em -100, -10, +1, +10 e +100 anos")
    a = p.parse_args()

    anos = (-100, -10, 1, 10, 100) if a.validacao else ()
    try:
        dados = gerar(a.epoca, anos)
    except Exception as e:                                   # noqa: BLE001
        print(f"\nFalhou: {e}", file=sys.stderr)
        print("Nada foi gravado. O arquivo existente continua valido.", file=sys.stderr)
        return 1

    saida = a.saida or f"src/dados/efemeride_{a.epoca}.json"
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"\nGravado em {saida}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
