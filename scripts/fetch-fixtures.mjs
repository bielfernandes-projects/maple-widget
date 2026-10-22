import fs from 'node:fs';
const base = 'https://meowdb.com/msclassic/guides/';
const slugs = ['best-grind-maps-every-level', 'exp-table-level-1-to-100', 'beginners-guide-first-steps-in-maple-world'];
fs.mkdirSync('tests/fixtures/guides', { recursive: true });
for (const s of slugs) {
  const r = await fetch(base + s, { headers: { 'user-agent': 'Mozilla/5.0 maple-widget-fixtures' } });
  if (!r.ok) throw new Error(`${s}: HTTP ${r.status}`);
  fs.writeFileSync(`tests/fixtures/guides/${s}.html`, await r.text());
  console.log('ok', s);
}
