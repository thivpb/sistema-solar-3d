"""Servidor de reserva, para quando a maquina tem Python e nao tem Node.

Por que nao serve `python3 -m http.server`: ele nao envia os cabecalhos
Cross-Origin-Opener-Policy e Cross-Origin-Embedder-Policy, nao conhece os tipos
`.ktx2` e `.wasm`, e nao tem o PUT das preferencias nem a batida que encerra o
programa quando a aba fecha. Tres coisas que o programa espera do servidor.

O comportamento e o mesmo de servidor.mjs, de proposito: quem usa nao deve notar
qual dos dois esta de pe.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AQUI = Path(__file__).resolve().parent.parent
PASTA_PUBLICA = AQUI / "dist"
ARQUIVO_PREFERENCIAS = AQUI / "preferencias.json"

PORTA_PREFERIDA = 8731
ENDERECO = "127.0.0.1"
SILENCIO_ATE_SAIR_S = 30.0
TAMANHO_MAXIMO_PREFERENCIAS = 64 * 1024

SEM_NAVEGADOR = "--sem-navegador" in sys.argv

CABECALHOS_FIXOS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-cache",
}

_temporizador: threading.Timer | None = None
_trava = threading.Lock()


def adiar_saida() -> None:
    """Sem batida da pagina por 30 s, o processo sai. E o que faz fechar a aba encerrar tudo."""
    global _temporizador
    with _trava:
        if _temporizador is not None:
            _temporizador.cancel()
        _temporizador = threading.Timer(SILENCIO_ATE_SAIR_S, _sair)
        _temporizador.daemon = True
        _temporizador.start()


def _sair() -> None:
    print("\nA pagina foi fechada. Encerrando o programa.")
    os._exit(0)


def _eh_objeto_de_preferencias(corpo: bytes) -> bool:
    """Nao basta ser JSON valido: tem de ser um OBJETO.

    `42` e `"qualquer coisa"` sao JSON validos, e gravar um deles deixaria o carregador de
    preferencias recebendo um numero onde espera um objeto na proxima abertura. O projeto
    antigo ja tinha a regra certa escrita: "Preferencia e conveniencia, nao pode virar motivo
    de tela de erro." Barrar na gravacao e mais barato que tratar na leitura.

    Esta funcao e a gemea de `ehObjetoDePreferencias` em servidor.mjs. As duas tem de concordar:
    quem usa o programa nao deve notar qual dos dois servidores esta de pe.
    """
    try:
        valor = json.loads(corpo)
    except ValueError:
        return False
    return isinstance(valor, dict)


class Manipulador(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".ktx2": "image/ktx2",
        ".bin": "application/octet-stream",
        ".wasm": "application/wasm",
        ".woff2": "font/woff2",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PASTA_PUBLICA), **kwargs)

    def end_headers(self) -> None:
        for chave, valor in CABECALHOS_FIXOS.items():
            self.send_header(chave, valor)
        super().end_headers()

    def log_message(self, formato: str, *args) -> None:
        """Silencio. Uma linha por arquivo servido enterraria o endereco impresso no inicio."""

    def _responder(self, codigo: int, tipo: str | None, corpo: bytes) -> None:
        self.send_response(codigo)
        if tipo:
            self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        if corpo:
            self.wfile.write(corpo)

    def do_GET(self) -> None:  # noqa: N802 — nome exigido por BaseHTTPRequestHandler
        if self.path == "/_batida":
            adiar_saida()
            return self._responder(204, None, b"")
        if self.path == "/preferencias.json":
            try:
                conteudo = ARQUIVO_PREFERENCIAS.read_bytes()
                json.loads(conteudo)  # corrompido vira padrao, nao vira tela de erro
            except (OSError, ValueError):
                conteudo = b"{}"
            return self._responder(200, "application/json; charset=utf-8", conteudo)
        if not PASTA_PUBLICA.is_dir():
            return self._responder(200, "text/html; charset=utf-8", PAGINA_SEM_BUILD)
        return super().do_GET()

    def do_PUT(self) -> None:  # noqa: N802
        if self.path != "/preferencias.json":
            return self._responder(405, None, b"")
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho > TAMANHO_MAXIMO_PREFERENCIAS:
            return self._responder(413, "application/json", b'{"erro":"grande demais"}')
        corpo = self.rfile.read(tamanho)
        if not _eh_objeto_de_preferencias(corpo):
            return self._responder(
                400, "application/json", b'{"erro":"esperava um objeto json"}'
            )
        ARQUIVO_PREFERENCIAS.write_bytes(corpo)
        return self._responder(204, None, b"")


PAGINA_SEM_BUILD = (
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8">'
    "<title>Sistema Solar — falta construir</title>"
    "<body style=\"background:#0c0e16;color:#e8eaf0;font:17px/1.6 system-ui,sans-serif\">"
    "<h1>Falta construir o programa</h1><p>A pasta <code>dist/</code> nao existe, e sem Node "
    "nao da para construi-la nesta maquina. Peca a pasta de entrega, que ja vem com ela pronta."
    "</p></body></html>"
).encode("utf-8")


def abrir_navegador(url: str) -> None:
    if SEM_NAVEGADOR:
        return
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", url])
        else:
            webbrowser.open(url)
    except OSError:
        print(f"Abra no navegador: {url}")


def main() -> None:
    # Sem isto, o stdout do Python fica em buffer de bloco quando a saida e redirecionada, e o
    # endereco impresso abaixo so aparece quando o buffer enche — ou seja, nunca. Essa mensagem
    # e a unica interface de quem abriu pelo lancador, entao ela tem de sair na hora.
    sys.stdout.reconfigure(line_buffering=True)

    try:
        servidor = ThreadingHTTPServer((ENDERECO, PORTA_PREFERIDA), Manipulador)
    except OSError:
        print(
            f"A porta {PORTA_PREFERIDA} esta ocupada. Subindo numa porta livre.\n"
            "O endereco desta vez sera diferente do de costume; suas preferencias continuam\n"
            "guardadas, porque ficam em preferencias.json e nao no navegador."
        )
        servidor = ThreadingHTTPServer((ENDERECO, 0), Manipulador)

    url = f"http://{ENDERECO}:{servidor.server_address[1]}/"
    print(f"\n  O Sistema Solar esta aberto no navegador: {url}")
    print("  Feche a aba para encerrar o programa. Esta janela pode ficar como esta.\n")
    abrir_navegador(url)
    adiar_saida()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
