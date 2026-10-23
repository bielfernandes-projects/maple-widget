# Fixtures locais (não versionadas)

Os testes `hud-*.test.ts`, `cached-reader.test.ts` (parte do HudReader real) e parte de `parser.test.ts` usam arquivos que **não estão no repositório**, por serem conteúdo de terceiros:

- `screens/` — screenshots do **seu** jogo (`Maple_A_*.jpg`, da pasta `appdata` do MapleStory) + `expected.json` com os valores esperados de cada um.
- `guides/` — páginas do meowdb salvas localmente: rode `node scripts/fetch-fixtures.mjs`.

Sem esses arquivos, os testes que dependem deles são **pulados** (não falham). Todo o resto roda com dados sintéticos.
