import fs from 'node:fs';
import path from 'node:path';
import { decodeJpeg, crop, toPngBuffer } from '../src/capture/image';
import { DEFAULT_REGIONS } from '../src/capture/hud';

// uso: npx tsx scripts/crop.ts tests/fixtures/screens/Maple_A_261021_220733.jpg
const file = process.argv[2];
const img = decodeJpeg(fs.readFileSync(file));
fs.mkdirSync('out', { recursive: true });
for (const [name, r] of Object.entries(DEFAULT_REGIONS)) {
  const out = path.join('out', `crop-${name}.png`);
  fs.writeFileSync(out, toPngBuffer(crop(img, r)));
  console.log(out);
}
