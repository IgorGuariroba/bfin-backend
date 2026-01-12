#!/bin/bash

# Script para versionamento automático baseado em conventional commits
# Analisa commits desde a última tag e determina o tipo de bump (major, minor, patch)

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Analisando commits para determinar nova versão...${NC}"

# Buscar última tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo -e "📌 Última tag: ${YELLOW}${LAST_TAG}${NC}"

# Remover o 'v' prefix para trabalhar com a versão
CURRENT_VERSION=${LAST_TAG#v}

# Separar versão em major, minor, patch
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Buscar commits desde a última tag
if [ "$LAST_TAG" == "v0.0.0" ]; then
  # Se não há tag, pegar todos os commits
  COMMITS=$(git log --pretty=format:"%s" HEAD)
else
  # Pegar commits desde a última tag
  COMMITS=$(git log --pretty=format:"%s" "${LAST_TAG}..HEAD")
fi

# Verificar se há commits
if [ -z "$COMMITS" ]; then
  echo -e "${YELLOW}⚠️  Nenhum commit novo desde a última tag${NC}"
  echo -e "Versão atual: ${GREEN}${LAST_TAG}${NC}"
  echo "version=${LAST_TAG#v}" >> $GITHUB_OUTPUT
  echo "new_tag=${LAST_TAG}" >> $GITHUB_OUTPUT
  echo "should_publish=false" >> $GITHUB_OUTPUT
  exit 0
fi

echo -e "\n📝 Commits desde a última tag:"
echo "$COMMITS" | head -10
if [ $(echo "$COMMITS" | wc -l) -gt 10 ]; then
  echo "... e mais $(( $(echo "$COMMITS" | wc -l) - 10 )) commits"
fi

# Determinar tipo de bump
BUMP_TYPE="patch"

# Verificar BREAKING CHANGES (major)
if echo "$COMMITS" | grep -qE "^(feat|fix|chore|refactor|perf|style|test|docs|build|ci)(\(.+\))?!:|BREAKING CHANGE:"; then
  BUMP_TYPE="major"
  echo -e "\n${RED}💥 BREAKING CHANGE detectado!${NC}"
fi

# Verificar feat (minor) - apenas se não for major
if [ "$BUMP_TYPE" != "major" ] && echo "$COMMITS" | grep -qE "^feat(\(.+\))?:"; then
  BUMP_TYPE="minor"
  echo -e "\n${GREEN}✨ Nova feature detectada!${NC}"
fi

# Verificar fix (patch) é o padrão
if [ "$BUMP_TYPE" == "patch" ] && echo "$COMMITS" | grep -qE "^fix(\(.+\))?:"; then
  echo -e "\n${YELLOW}🐛 Bug fix detectado!${NC}"
fi

# Incrementar versão baseado no tipo
case $BUMP_TYPE in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEW_TAG="v${NEW_VERSION}"

echo -e "\n${GREEN}🎯 Nova versão determinada: ${NEW_TAG}${NC}"
echo -e "   Tipo de bump: ${YELLOW}${BUMP_TYPE}${NC}"
echo -e "   ${LAST_TAG} → ${NEW_TAG}"

# Output para GitHub Actions
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "version=${NEW_VERSION}" >> $GITHUB_OUTPUT
  echo "new_tag=${NEW_TAG}" >> $GITHUB_OUTPUT
  echo "bump_type=${BUMP_TYPE}" >> $GITHUB_OUTPUT
  echo "should_publish=true" >> $GITHUB_OUTPUT
  echo "previous_tag=${LAST_TAG}" >> $GITHUB_OUTPUT
fi

# Output para uso local
echo "${NEW_VERSION}"
