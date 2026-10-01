#!/usr/bin/env bash
# Abre o Sistema Solar. Mesmo papel do run.sh da versao em Python: se faltar alguma coisa,
# ele mesmo resolve, para que ninguem precise usar o terminal depois da primeira vez.
#
# A pasta de entrega ja vem com dist/ pronto. Neste caso nada e instalado nem construido:
# basta um servidor local. Se a maquina nem Node tiver, o fallback em Python assume.
set -euo pipefail
cd "$(dirname "$0")"

tem() { command -v "$1" >/dev/null 2>&1; }

# Quando o programa e aberto pelo Finder (duplo clique no .app), ele NAO herda o PATH do
# terminal: nao passa pelo .zshrc, e portanto nao passa pelo nvm. Numa maquina onde o Node
# foi instalado por nvm — como a de quem escreveu isto — `command -v node` falha ali e o
# programa "simplesmente nao abre", sem dizer por que.
#
# Entao, antes de desistir do Node, procuramos nos lugares onde ele costuma estar. A ordem
# e do mais especifico para o mais generico, e a versao mais nova do nvm ganha.
if ! tem node; then
  for pasta in \
    "$HOME/.nvm/versions/node"/*/bin \
    "$HOME/.volta/bin" \
    /opt/homebrew/bin \
    /usr/local/bin
  do
    [ -x "$pasta/node" ] || continue
    PATH="$pasta:$PATH"
  done
  export PATH
fi

if tem node; then
  if [[ ! -d node_modules && ! -d dist ]]; then
    echo "Primeira execucao: instalando as bibliotecas. Isto leva um ou dois minutos."
    npm install
  fi
  if [[ ! -d dist ]]; then
    echo "Construindo o programa."
    npm run build
  fi
  exec node servidor.mjs "$@"
fi

if [[ -d dist ]] && tem python3; then
  echo "Node nao encontrado. Usando o servidor de reserva em Python."
  exec python3 ferramentas/servidor.py "$@"
fi

echo "Nao foi possivel abrir o programa." >&2
echo >&2
if [[ -d dist ]]; then
  echo "A pasta dist/ existe, mas nao ha nem Node nem Python 3 nesta maquina." >&2
  echo "Instale um dos dois: https://nodejs.org  ou  https://python.org" >&2
else
  echo "Falta o Node para construir o programa: https://nodejs.org" >&2
fi
exit 1
