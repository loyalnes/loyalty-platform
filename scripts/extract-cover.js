#!/usr/bin/env node
// Usage: node scripts/extract-cover.js <slug> <url>
// Estrae l'immagine principale e la salva in ~/Downloads/<slug>.<ext>.

const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function extractCover(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoverExtractor/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const html = await res.text();
  const baseUrl = res.url || pageUrl;

  const imgRegex = /<img\b[^>]*>/gi;
  const imgs = html.match(imgRegex) || [];
  const score = (tag) => {
    let s = 0;
    if (/\b(hero|header|banner|cover|main|jumbotron|masthead)\b/i.test(tag)) s += 10;
    if (/\bmobile\b/i.test(tag) || /\bd-lg-none\b/i.test(tag) || /_mobile\./i.test(tag)) s += 20;
    if (/\bd-none\s+d-lg-block\b/i.test(tag) || /_desktop\./i.test(tag)) s -= 5;
    if (/\bclass=["'][^"']*\b(w-100|img-fluid)\b/i.test(tag)) s += 3;
    if (/\b(logo|icon|sprite|pixel|spinner|loader)\b/i.test(tag)) s -= 8;
    return s;
  };
  const bestImg = imgs.map((tag) => ({ tag, s: score(tag) })).sort((a, b) => b.s - a.s)[0];
  if (bestImg && bestImg.s >= 20) {
    const src =
      (bestImg.tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] ||
      (bestImg.tag.match(/\bdata-src=["']([^"']+)["']/i) || [])[1];
    if (src && !/^data:/i.test(src)) return new URL(src, baseUrl).href;
  }

  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of metaPatterns) {
    const m = html.match(re);
    if (m) return new URL(m[1], baseUrl).href;
  }

  const ranked = imgs.map((tag) => ({ tag, s: score(tag) })).sort((a, b) => b.s - a.s);
  for (const { tag } of ranked) {
    const src =
      (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] ||
      (tag.match(/\bdata-src=["']([^"']+)["']/i) || [])[1];
    if (src && !/^data:/i.test(src)) return new URL(src, baseUrl).href;
  }
  return null;
}

const [slug, url] = process.argv.slice(2);
if (!slug || !url) {
  console.error('Usage: node scripts/extract-cover.js <slug> <url>');
  process.exit(1);
}

(async () => {
  const img = await extractCover(url);
  if (!img) { console.error('No cover image found'); process.exit(2); }
  const res = await fetch(img, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  const extFromCt = ct.includes('jpeg') ? '.jpg'
    : ct.includes('png') ? '.png'
    : ct.includes('webp') ? '.webp'
    : ct.includes('gif') ? '.gif'
    : ct.includes('svg') ? '.svg' : '';
  const ext = extFromCt || path.extname(new URL(img).pathname) || '.jpg';
  const dir = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${slug}${ext}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(`Saved: ${out}\nFrom:  ${img}`);
})().catch((err) => { console.error(err.message); process.exit(1); });
