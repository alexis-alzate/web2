import sharp from 'sharp';

type OgImageInput = {
  cover: Buffer;
  title: string;
  artist?: string;
  description?: string;
};

const escapeXml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const wrapWords = (value: string, maxLength: number, maxLines: number) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
      return;
    }

    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
};

export const buildReleaseOgImage = async ({
  cover,
  title,
  artist = 'ZAETTA',
  description = 'Música con propósito. Sonidos que trascienden.'
}: OgImageInput) => {
  const coverImage = await sharp(cover)
    .resize(470, 470, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 92 })
    .toBuffer();

  const titleLines = wrapWords(title, 17, 2);
  const descriptionLines = wrapWords(description, 31, 2);

  const titleText = titleLines
    .map((line, index) => `<text x="622" y="${266 + index * 62}" class="title">${escapeXml(line)}</text>`)
    .join('');

  const descriptionText = descriptionLines
    .map((line, index) => `<text x="622" y="${455 + index * 34}" class="desc">${escapeXml(line)}</text>`)
    .join('');

  const overlay = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" x2="1">
      <stop offset="0" stop-color="#020804" stop-opacity="0.42"/>
      <stop offset="0.55" stop-color="#020804" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#020804" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="9" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <style>
      .eyebrow { fill: #32ff6a; font: 700 22px Arial, sans-serif; letter-spacing: 8px; }
      .title { fill: #ffffff; font: 800 58px Arial, sans-serif; letter-spacing: -1px; }
      .artist { fill: #32ff6a; font: 800 28px Arial, sans-serif; letter-spacing: 8px; }
      .desc { fill: #d5ddd6; font: 400 28px Arial, sans-serif; }
      .domain { fill: #ffffff; font: 700 24px Arial, sans-serif; letter-spacing: 4px; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <rect x="60" y="68" width="520" height="520" rx="34" fill="#031007" opacity="0.7" stroke="#19ff62" stroke-opacity="0.34"/>
  <rect x="86" y="94" width="472" height="472" rx="20" fill="none" stroke="#f1d9a0" stroke-width="2" opacity="0.8"/>
  <text x="622" y="162" class="eyebrow" filter="url(#glow)">LUJO URBAN PRESENTA</text>
  ${titleText}
  <text x="622" y="386" class="artist">${escapeXml(artist)}</text>
  ${descriptionText}
  <text x="622" y="548" class="domain">LUJOURBAN.COM</text>
</svg>`);

  return sharp(cover)
    .resize(1200, 630, { fit: 'cover', position: 'center' })
    .blur(18)
    .modulate({ brightness: 0.42, saturation: 0.85 })
    .composite([
      { input: coverImage, left: 87, top: 95 },
      { input: overlay }
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
};
