import * as cheerio from 'cheerio';
import type { ParsedGuide } from '../types';

const TIP_RE = /ability points|skill points|\bAP\b|\bSP\b|skill build|AP allocation|SP allocation/i;
const RANGE_RE = /levels?\s*(\d+)\s*(?:[-–—~]|to)\s*(\d+)/i;
const TIP_MAX = 1500;
const num = (s: string) => parseInt((s.replace(/,/g, '').match(/\d+/) ?? ['0'])[0], 10);
const faixa = (s: string): [number, number] | undefined => {
  const m = s.match(RANGE_RE);
  return m ? [+m[1], +m[2]] : undefined;
};

export function parseGuide(html: string, url: string): ParsedGuide {
  const $ = cheerio.load(html);
  const abs = (s?: string) => {
    try { return s ? new URL(s, url).toString() : undefined; } catch { return undefined; }
  };
  const origin = new URL(url).origin;
  const out: ParsedGuide = {
    title: $('h1').first().text().trim() || $('title').text().trim(),
    maps: [], quests: [], expRows: [], tips: [],
  };
  const root = $('main').length ? $('main').first() : $('body');

  let h2 = '';
  let range: [number, number] | undefined;
  let tipLen = 0;
  let tip: { title: string; lines: string[]; range?: [number, number] } | null = null;
  const flushTip = () => {
    if (tip && tip.lines.length) {
      out.tips.push({
        kind: /skill|\bSP\b/i.test(tip.title) ? 'sp' : 'ap',
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
      if (TIP_RE.test(h2)) { tip = { title: h2, lines: [], range }; tipLen = 0; }
      return;
    }
    if (tag === 'table') { parseTable(node); return; }
    if (!tip || node.closest('table').length) return;
    if (tag === 'li' && node.find('p').length) return; // evita duplicar texto de <li><p>
    if (tipLen >= TIP_MAX) return;
    const t = node.text().trim();
    if (!t) return;
    tip.lines.push(t);
    tipLen += t.length + 1;
    if (tipLen >= TIP_MAX) tip.lines = [tip.lines.join('\n').slice(0, TIP_MAX) + '…'];
  });
  flushTip();
  return out;

  function parseTable(table: cheerio.Cheerio<any>) {
    const rows = table.find('tr').toArray();
    if (rows.length < 2) return;
    const heads = $(rows[0]).children('th,td').toArray().map((c) => $(c).text().trim().toLowerCase());
    const col = (f: (h: string) => boolean) => heads.findIndex(f);
    const iMap = col((h) => h === 'map'), iExpHr = col((h) => h.startsWith('max exp'));
    const iQuest = col((h) => h === 'quest'), iLv = col((h) => h === 'lv' || h.startsWith('level')), iExp = col((h) => h === 'exp');
    const iLevel = col((h) => h === 'level'), iNext = col((h) => h === 'exp to next');

    for (const tr of rows.slice(1)) {
      const row = $(tr);
      const cells = row.children('th,td').toArray().map((c) => $(c));
      const txt = (i: number) => (i >= 0 ? (cells[i]?.text().trim() ?? '') : '');

      if (iMap >= 0 && iExpHr >= 0) {
        if (!range || !txt(iMap) || !num(txt(iExpHr))) continue;
        const iMob = col((h) => h.includes('mob'));
        const mobCell = cells[iMob];
        const spriteSrc = mobCell?.find('img').first().attr('src') ?? row.find('img').first().attr('src');
        const spriteId = spriteSrc?.match(/mob_(\d+)\.png/)?.[1];
        const mobId = spriteId ?? row.find('a[href]').toArray().map((a) => $(a).attr('href') ?? '')
          .map((h) => h.match(/\/(?:monsters?|mobs?)(?:-db)?\/(\d+)/)?.[1]).find(Boolean);
        const img = abs(spriteSrc);
        out.maps.push({
          name: txt(iMap), street: txt(col((h) => h === 'street')), maxExpHr: num(txt(iExpHr)),
          mob: {
            name: txt(iMob).replace(/\s*\(.*?\)\s*$/, ''), id: mobId,
            iconUrl: img ?? (mobId ? `${origin}/msclassic/monsters/anim/${mobId.padStart(7, '0')}.stand.webp` : undefined),
          },
          why: txt(col((h) => h === 'why')), levelMin: range[0], levelMax: range[1], sourceUrl: url,
        });
      } else if (iQuest >= 0 && iLv >= 0 && iExp >= 0 && iNext < 0) {
        if (!txt(iQuest)) continue;
        const linkId = row.find('a[href]').toArray().map((a) => $(a).attr('href') ?? '')
          .map((h) => h.match(/quest-tracker\/(\d+)/)?.[1]).find(Boolean);
        const ctlId = row.find('[aria-controls^="quest-"]').first().attr('aria-controls')?.match(/quest-(\d+)/)?.[1];
        const rc = cells[col((h) => h.startsWith('reward'))];
        const items = rc ? rc.find('li').toArray().map((l) => $(l).text().trim()).filter(Boolean) : [];
        const parts = rc && !items.length ? (rc.html() ?? '').split(/<br\s*\/?>/i).map((s) => cheerio.load(s).text().trim()).filter(Boolean) : [];
        const reward = items.length ? items.join(', ') : parts.length > 1 ? parts.join(', ') : txt(col((h) => h.startsWith('reward')));
        const name = txt(iQuest).replace(/^\+\s*/, '').trim();
        if (!name) continue;
        const iNpc = heads.map((h) => h === 'from' || h === 'start npc').lastIndexOf(true);
        const npc = txt(iNpc);
        const area = txt(col((h) => h === 'area'));
        out.quests.push({
          id: linkId ?? ctlId ?? `${name}|${npc}|${num(txt(iLv))}|${num(txt(iExp))}`, name, npc, area: area || undefined,
          level: num(txt(iLv)), exp: num(txt(iExp)), reward: reward === '-' ? '' : reward,
          iconUrl: abs(row.find('img').first().attr('src')), sourceUrl: url,
        });
      } else if (iLevel >= 0 && iNext >= 0) {
        const level = num(txt(iLevel)), toNext = num(txt(iNext));
        if (level > 0 && toNext > 0 && !out.expRows.some((r) => r.level === level)) out.expRows.push({ level, toNext });
      }
    }
  }
}
