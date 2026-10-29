#!/bin/sh
# Publica a pasta public/ no ramo gh-pages (GitHub Pages: https://familiaalcancar-star.github.io/painel-alcancar/).
# Uso: sh scripts/publicar-github-pages.sh   (depois de commitar as mudanças no main)
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
# Parte sempre do gh-pages que está no GitHub (alguém pode ter publicado por outro lugar).
git fetch -q origin gh-pages 2>/dev/null && git branch -f gh-pages origin/gh-pages 2>/dev/null || true
git worktree add -f "$TMP" gh-pages 2>/dev/null || { git worktree add --detach "$TMP"; (cd "$TMP" && git checkout --orphan gh-pages && git rm -rqf .); }
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R public/. "$TMP"/
touch "$TMP/.nojekyll"
cd "$TMP"
git add -A
git commit -q -m "Publicar site ($(git -C "$OLDPWD" rev-parse --short HEAD))" || echo "Nada novo para publicar."
git push -q -u origin gh-pages
cd - >/dev/null
git worktree remove --force "$TMP"
