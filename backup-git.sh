#!/bin/bash
# Backup automático do GitHub

cd /opt/nexbot || exit  # entra no diretório do projeto

COMMIT_MSG="Backup automático $(date '+%Y-%m-%d %H:%M:%S')"

git add .
git commit -m "$COMMIT_MSG" 2>/dev/null  # ignora caso não haja mudanças
git push origin main

echo "Backup concluído! Commit enviado: $COMMIT_MSG"

