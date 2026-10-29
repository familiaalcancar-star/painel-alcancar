#!/bin/sh
# Publica a pasta public/ no ramo gh-pages (GitHub Pages: https://familiaalcancar-star.github.io/painel-alcancar/).
# Uso: sh scripts/publicar-github-pages.sh   (depois de commitar as mudanças no main)
set -e
cd "$(dirname "$0")/.."
RAIZ=$(pwd); VERSAO=$(git rev-parse --short HEAD)
TMP=$(mktemp -d)
trap 'cd "$RAIZ"; git worktree remove --force "$TMP" 2>/dev/null || true' EXIT
# Parte sempre do gh-pages que está no GitHub (alguém pode ter publicado por outro lugar).
git fetch -q origin gh-pages
git worktree add -q --detach "$TMP" origin/gh-pages
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R public/. "$TMP"/
touch "$TMP/.nojekyll"
cd "$TMP"
git add -A
if git diff --cached --quiet; then echo "Nada novo para publicar."; exit 0; fi
git commit -q -m "Publicar site ($VERSAO)"
git push -q origin HEAD:gh-pages
echo "Publicado ($VERSAO)."
