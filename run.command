#!/usr/bin/env bash
# Duplo clique no Finder. O macOS so faz isso com arquivos .command.
cd "$(dirname "$0")"
exec ./run.sh "$@"
