import fs from 'node:fs';
import * as cheerio from 'cheerio';

const r = await fetch('https://meowdb.com/msclassic/quest-tracker/all', { headers: { 'user-agent': 'maple-widget/0.1 (fixture)' } });
if (!r.ok) throw new Error(`HTTP ${r.status}`);
const $ = cheerio.load(await r.text());
// a página intercala linhas de detalhe (1 célula) entre as quests (8 células): descarta-as
const rows = $('table').first().find('tr').toArray().filter((tr) => $(tr).children().length > 1);
const keep = rows.slice(0, 41).map((tr) => $.html(tr)).join('\n');
fs.mkdirSync('tests/fixtures/guides', { recursive: true });
fs.writeFileSync('tests/fixtures/guides/quest-database.html',
  `<!doctype html><html><body><main><h1>Quest Database</h1><table>${keep}</table></main></body></html>`);
console.log('ok:', rows.length - 1, 'quests na página; 40 guardadas');
