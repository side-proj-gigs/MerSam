import { buildMatrix, renderQrSvg, type QrTheme } from './render';

export interface WallpaperInput {
  name: string;
  jobTitle: string;
  company: string;
  phone: string | null;
  url: string;
  theme?: QrTheme;
  /** Device pixel dimensions. The default suits a modern tall phone. */
  width?: number;
  height?: number;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });
}

/**
 * A lock screen that doubles as a business card.
 *
 * The layout is driven by where a phone puts its own furniture: the clock and
 * notifications own the top third, so the brand sits just under them, the QR
 * takes the optical centre where a thumb naturally points a scanner, and the
 * contact details sit above the unlock affordance at the bottom. Depth comes
 * from layered radial light, a soft ring system and a glass panel behind the
 * code rather than from a drop shadow pretending to be 3D.
 */
export async function renderWallpaperSvg(input: WallpaperInput): Promise<string> {
  const {
    name,
    jobTitle,
    company,
    phone,
    url,
    theme = 'dark',
    width = 1290,
    height = 2796,
  } = input;

  const matrix = await buildMatrix(url);
  const qrSize = Math.round(width * 0.56);
  // Always opaque: the code carries its own quiet zone and its own background,
  // so nothing behind it can reduce the contrast a scanner depends on.
  const qrSvg = renderQrSvg(matrix, { theme, size: qrSize, withLogoSlot: true });

  // Strip the wrapper so the code can be placed inside this document.
  const inner = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const viewBox = /viewBox="0 0 (\d+(?:\.\d+)?) /.exec(qrSvg)?.[1] ?? '33';
  const grid = Number(viewBox);

  const qrX = (width - qrSize) / 2;
  const qrY = height * 0.47;
  const panelPadding = Math.round(qrSize * 0.1);

  const dark = theme !== 'light';
  const ink = dark ? '#ffffff' : '#10141b';
  const muted = dark ? '#c7cedb' : '#5b6068';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(name)} contact wallpaper">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${dark ? '#0b0e13' : '#f5f7fa'}"/>
      <stop offset="52%" stop-color="${dark ? '#10141b' : '#ffffff'}"/>
      <stop offset="100%" stop-color="${dark ? '#07090c' : '#e4e8ef'}"/>
    </linearGradient>

    <radialGradient id="glowGold" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#c9a227" stop-opacity="${dark ? 0.42 : 0.26}"/>
      <stop offset="100%" stop-color="#c9a227" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="glowAqua" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#1e9cb3" stop-opacity="${dark ? 0.34 : 0.2}"/>
      <stop offset="100%" stop-color="#1e9cb3" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="goldText" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0%" stop-color="#8a671c"/>
      <stop offset="30%" stop-color="#f0dca8"/>
      <stop offset="60%" stop-color="#c9a227"/>
      <stop offset="100%" stop-color="#e3c479"/>
    </linearGradient>

    <linearGradient id="panel" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="${dark ? '#ffffff' : '#ffffff'}" stop-opacity="${dark ? 0.1 : 0.95}"/>
      <stop offset="100%" stop-color="${dark ? '#ffffff' : '#ffffff'}" stop-opacity="${dark ? 0.03 : 0.78}"/>
    </linearGradient>

    <linearGradient id="panelEdge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0dca8" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="#c9a227" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#8a671c" stop-opacity="0.75"/>
    </linearGradient>

    <filter id="soften" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${Math.round(width * 0.012)}"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Layered light, which is what gives the flat canvas its depth. -->
  <ellipse cx="${width * 0.2}" cy="${height * 0.2}" rx="${width * 0.78}" ry="${height * 0.26}" fill="url(#glowGold)"/>
  <ellipse cx="${width * 0.86}" cy="${height * 0.74}" rx="${width * 0.7}" ry="${height * 0.24}" fill="url(#glowAqua)"/>

  <!-- Concentric ripples, as though the droplet in the logo had just landed. -->
  <g stroke="#c9a227" fill="none" opacity="${dark ? 0.16 : 0.2}">
    ${[0.34, 0.52, 0.72, 0.95, 1.2]
      .map(
        (scale, index) =>
          `<circle cx="${width / 2}" cy="${qrY + qrSize / 2}" r="${qrSize * scale}" stroke-width="${2.5 - index * 0.35}"/>`,
      )
      .join('\n    ')}
  </g>

  <!-- Brand block, clear of the clock. -->
  <g transform="translate(${width / 2}, ${height * 0.205})" text-anchor="middle">
    <g transform="translate(0, -${width * 0.085}) scale(${width / 560})">
      <g transform="translate(-24, -34)">
        <path d="M24 2 C24 2 44 24.5 44 37 A20 20 0 0 1 4 37 C4 24.5 24 2 24 2 Z"
              fill="url(#goldText)" opacity="0.95"/>
        <ellipse cx="17.5" cy="31" rx="4.4" ry="6.2" fill="#ffffff" opacity="0.45"
                 transform="rotate(-22 17.5 31)"/>
      </g>
    </g>
    <text font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(width * 0.082)}"
          font-weight="700" fill="url(#goldText)" letter-spacing="-1">${escapeXml(company)}</text>
    <text y="${Math.round(width * 0.052)}" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(width * 0.0225)}" fill="${muted}" letter-spacing="${width * 0.006}"
          font-weight="600">WATER ENGINEERING</text>
  </g>

  <!-- Glass panel behind the code, with a lit top edge. -->
  <g>
    <rect x="${qrX - panelPadding}" y="${qrY - panelPadding}"
          width="${qrSize + panelPadding * 2}" height="${qrSize + panelPadding * 2}"
          rx="${Math.round(width * 0.062)}" fill="#000000" opacity="${dark ? 0.35 : 0.12}"
          filter="url(#soften)"/>
    <rect x="${qrX - panelPadding}" y="${qrY - panelPadding}"
          width="${qrSize + panelPadding * 2}" height="${qrSize + panelPadding * 2}"
          rx="${Math.round(width * 0.062)}" fill="${theme === 'dark' ? '#f8f6f1' : '#ffffff'}"/>
    <rect x="${qrX - panelPadding}" y="${qrY - panelPadding}"
          width="${qrSize + panelPadding * 2}" height="${qrSize + panelPadding * 2}"
          rx="${Math.round(width * 0.062)}" fill="url(#panel)" opacity="0.35"/>
    <rect x="${qrX - panelPadding + 1.5}" y="${qrY - panelPadding + 1.5}"
          width="${qrSize + panelPadding * 2 - 3}" height="${qrSize + panelPadding * 2 - 3}"
          rx="${Math.round(width * 0.06)}" fill="none" stroke="url(#panelEdge)" stroke-width="3"/>
  </g>

  <!-- The code itself, scaled from its own module grid into place. -->
  <g transform="translate(${qrX}, ${qrY}) scale(${qrSize / grid})">
    ${inner}
  </g>

  <!-- Identity and contact, above the unlock affordance. -->
  <g transform="translate(${width / 2}, ${qrY + qrSize + panelPadding * 2 + width * 0.085})" text-anchor="middle">
    <text font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(width * 0.058)}"
          font-weight="700" fill="${ink}">${escapeXml(name)}</text>
    <text y="${Math.round(width * 0.048)}" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(width * 0.027)}" fill="#c9a227" font-weight="600">${escapeXml(jobTitle)}</text>
    ${
      phone
        ? `<text y="${Math.round(width * 0.095)}" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(width * 0.026)}" fill="${muted}">${escapeXml(phone)}</text>`
        : ''
    }
  </g>

  <g transform="translate(${width / 2}, ${height * 0.925})" text-anchor="middle">
    <rect x="-${width * 0.26}" y="-${width * 0.035}" width="${width * 0.52}" height="${width * 0.07}"
          rx="${width * 0.035}" fill="${dark ? '#ffffff' : '#10141b'}" opacity="0.08"/>
    <text y="${width * 0.009}" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(width * 0.023)}" fill="${muted}" letter-spacing="${width * 0.002}"
          font-weight="600">SCAN TO SAVE MY DETAILS</text>
  </g>
</svg>`;
}
