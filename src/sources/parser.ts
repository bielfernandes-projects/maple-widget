import * as cheerio from 'cheerio';
import type { ParsedGuide } from '../types';

const TIP_RE = /ability points|skill points|\bAP\b|\bSP\b|\bbuild\b/i;
const num = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
const faixa = (s: string): [number, number] => {
  const m = s.match(/level\s*(\d+)\s*[-–]\s*(\d+)/i);
  return m ? [+m[1], +m[2]] : [1, 100];
};

export function parseGuide(html: string, url: string): ParsedGuide {
  const $ = cheerio.load(html);
  const abs = (s?: string) => (s ? new URL(s, url).toString() : undefined);
  const origin = new URL(url).origin;
  const out: ParsedGuide = {
    title: $('h1').first().text().trim() || $('title').text().trim(),
    maps: [], quests: [], expRows: [], tips: [],
  };
  const root = $('main').length ? $('main').first() : $('body');

  let h2 = '';
  let range: [number, number] = [1, 100];
  let tip: { title: string; lines: string[]; range?: [number, number] } | null = null;
  const flushTip = () => {
    if (tip && tip.lines.length) {
      out.tips.push({
        kind: /skill points|\bSP\b/i.test(tip.title) ? 'sp' : 'ap',
        guide: out.title, title: tip.title, text: tip.lines.join('\n'),
        levelMin: tip.range?.[0], levelMax: tip.range?.[1], sourceUrl: url,
      });
    }
    tip = null;
  };

  root.find('h2, table, p, li').each((_, el) => {
    const node = $(el);
    const tag = (node.prop('tagName') as string).toLowerCase();
    if (tag === 'h2') {
      flushTip();
      h2 = node.text().trim();
      range = faixa(h2);
      if (TIP_RE.test(h2)) tip = { title: h2, lines: [], range: /level\s*\d+/i.test(h2) ? range : undefined };
      return;
    }
    if (tag === 'table') { parseTable(node); return; }
    if (!tip || node.closest('table').length) return;
    if (tag === 'li' && node.find('p').length) return; // evita duplicar texto de <li><p>
    const t = node.text().trim();
    if (t) tip.lines.push(t);
  });
  flushTip();
  return out;

  function parseTable(table: cheerio.Cheerio<any>) {
    const rows = table.find('tr').toArray();
    if (rows.length < 2) return;
    const heads = $(rows[0]).children('th,td').toArray().map((c) => $(c).text().trim().toLowerCase());
    const col = (f: (h: string) => boolean) => heads.findIndex(f);
    const iMap = col((h) => h === 'map'), iExpHr = col((h) => h.startsWith('max exp'));
    const iQuest = col((h) => h === 'quest'), iLv = col((h) => h === 'lv'), iExp = col((h) => h === 'exp');
    const iLevel = col((h) => h === 'level'), iNext = col((h) => h === 'exp to next');

    for (const tr of rows.slice(1)) {
      const row = $(tr);
      const cells = row.children('th,td').toArray().map((c) => $(c));
      const txt = (i: number) => (i >= 0 ? (cells[i]?.text().trim() ?? '') : '');

      if (iMap >= 0 && iExpHr >= 0) {
        const iMob = col((h) => h.includes('mob'));
        const mobCell = cells[iMob];
        const mobId = row.find('a[href]').toArray().map((a) => $(a).attr('href') ?? '')
          .map((h) => h.match(/\/(?:monsters?|mobs?)(?:-db)?\/(\d+)/)?.[1]).find(Boolean);
        const img = abs(mobCell?.find('img').attr('src'));
        out.maps.push({
          name: txt(iMap), street: txt(col((h) => h === 'street')), maxExpHr: num(txt(iExpHr)),
          mob: {
            name: txt(iMob).replace(/\s*\(.*?\)\s*$/, ''), id: mobId,
            iconUrl: img ?? (mobId ? `${origin}/msclassic/monsters/anim/${mobId.padStart(7, '0')}.stand.webp` : undefined),
          },
          why: txt(col((h) => h === 'why')), levelMin: range[0], levelMax: range[1], sourceUrl: url,
        });
      } else if (iQuest >= 0 && iLv >= 0 && iExp >= 0) {
        const id = row.find('a[href]').toArray().map((a) => $(a).attr('href') ?? '')
          .map((h) => h.match(/quest-tracker\/(\d+)/)?.[1]).find(Boolean);
        const reward = txt(col((h) => h === 'reward'));
        out.quests.push({
          id: id ?? txt(iQuest), name: txt(iQuest), npc: txt(col((h) => h === 'from')),
          level: num(txt(iLv)), exp: num(txt(iExp)), reward: reward === '-' ? '' : reward,
          iconUrl: abs(row.find('img').first().attr('src')), sourceUrl: url,
        });
      } else if (iLevel >= 0 && iNext >= 0) {
        const level = num(txt(iLevel)), toNext = num(txt(iNext));
        if (level > 0 && toNext > 0) out.expRows.push({ level, toNext });
      }
    }
  }
}
