import fs from 'node:fs';
import path from 'node:path';

// Screenshots do jogo e cópias de páginas do meowdb NÃO ficam no repositório (direitos autorais e privacidade).
// Sem elas, os testes que dependem delas são pulados; `node scripts/fetch-fixtures.mjs` baixa as páginas, e os
// screenshots precisam ser seus (veja tests/fixtures/README.md).
const has = (p: string) => fs.existsSync(path.join(__dirname, 'fixtures', p));
export const TEM = { screens: has('screens/expected.json'), guides: has('guides/quest-database.html') };
