import QRCode from 'qrcode';

/**
 * Off-the-shelf QR images are black squares on white. These are drawn from the
 * raw matrix instead, so the modules can carry the brand gradient, the finder
 * eyes can be rounded, and the droplet can sit in the middle, while the quiet
 * zone and error correction stay exactly where the specification wants them.
 *
 * Error correction is set to H (30% recoverable), which is what makes the
 * centre cut-out safe: the logo covers well under the recoverable area.
 */
export interface QrMatrix {
  size: number;
  get(x: number, y: number): boolean;
}

export async function buildMatrix(text: string): Promise<QrMatrix> {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  return {
    size,
    get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && Boolean(data[y * size + x]),
  };
}

function isFinder(x: number, y: number, size: number): boolean {
  const inBox = (originX: number, originY: number) =>
    x >= originX && x < originX + 7 && y >= originY && y < originY + 7;
  return inBox(0, 0) || inBox(size - 7, 0) || inBox(0, size - 7);
}

/**
 * Every theme is dark modules on a light tile. Inverting a QR is legal in the
 * specification but a meaningful share of scanners, including OpenCV and
 * several stock Android camera apps, refuse to read one, so a "dark" theme
 * here means a code that sits well on a dark page, not a code made of light.
 */
export type QrTheme = 'light' | 'dark' | 'gold';

/**
 * Both the outer ring and the 3x3 core of a finder pattern have to read as
 * dark, because a scanner locates the pattern by the 1:1:3:1:1 run of
 * dark-light-dark-light-dark across it. A bright brand colour in the core
 * inverts that middle run and the code stops being found at all, so the brand
 * appears there only in its deepest steps.
 */
interface ThemeColours {
  moduleFrom: string;
  moduleTo: string;
  /** Must be dark. */
  eye: string;
  /** Must also be dark. */
  eyeCore: string;
  background: string;
  logoRing: string;
}

const THEMES: Record<QrTheme, ThemeColours> = {
  light: {
    moduleFrom: '#1f2632',
    moduleTo: '#10141b',
    eye: '#10141b',
    eyeCore: '#6b4f1c',
    background: '#ffffff',
    logoRing: '#ffffff',
  },
  // For dark surroundings. The ground stays pure white, because every point of
  // contrast lost at binarisation is a scan that fails in poor light.
  dark: {
    moduleFrom: '#1f2632',
    moduleTo: '#07090c',
    eye: '#10141b',
    eyeCore: '#1b667b',
    background: '#ffffff',
    logoRing: '#ffffff',
  },
  // Gold modules, stepped a long way down the ramp. A mid gold looks better on
  // screen and reads far worse through a camera, so the deep bronze wins.
  gold: {
    moduleFrom: '#6b4f1c',
    moduleTo: '#3a2b11',
    eye: '#10141b',
    eyeCore: '#6b4f1c',
    background: '#ffffff',
    logoRing: '#ffffff',
  },
};

export interface QrOptions {
  theme?: QrTheme;
  /** Rendered edge length in pixels, excluding nothing: the quiet zone is inside. */
  size?: number;
  /** Leaves a clear circle in the middle for a logo. */
  withLogoSlot?: boolean;
  transparent?: boolean;
}

/**
 * Renders the matrix as a standalone SVG string.
 *
 * Styling a QR code is mostly an exercise in not breaking it. Two rules drive
 * what follows, both learned by testing the output through a real decoder
 * rather than by eye:
 *
 *  - Modules must stay contiguous. Drawing them as separated dots leaves gaps
 *    along the timing patterns, which is how a decoder measures the module
 *    pitch; lose those and the code stops reading even though it looks fine.
 *    So a module is a full-width rounded square that meets its neighbours.
 *  - Finder patterns must keep their 7:5:3 proportions and their contrast.
 *    They are drawn as solid nested shapes, softened at the corners only.
 */
export function renderQrSvg(matrix: QrMatrix, options: QrOptions = {}): string {
  const { theme = 'light', size = 512, withLogoSlot = true, transparent = false } = options;
  const colours = THEMES[theme];

  const quietZone = 4;
  const grid = matrix.size + quietZone * 2;
  const parts: string[] = [];

  const centre = matrix.size / 2;
  // Radius of the cleared circle, in modules. Kept well inside what the H
  // error-correction level can recover.
  const logoRadius = withLogoSlot ? matrix.size * 0.1 : 0;

  for (let y = 0; y < matrix.size; y += 1) {
    for (let x = 0; x < matrix.size; x += 1) {
      if (!matrix.get(x, y)) continue;
      if (isFinder(x, y, matrix.size)) continue;

      if (withLogoSlot) {
        const dx = x + 0.5 - centre;
        const dy = y + 0.5 - centre;
        if (Math.sqrt(dx * dx + dy * dy) < logoRadius + 0.75) continue;
      }

      const px = x + quietZone;
      const py = y + quietZone;
      // Full width, so adjacent modules merge into continuous runs, with a
      // small corner radius for the softer look.
      parts.push(`<rect x="${px}" y="${py}" width="1" height="1" rx="0.26"/>`);
    }
  }

  /**
   * One finder pattern, drawn as solid nested squares at true proportions.
   * The corner radius is capped at 1 module: rounder than that and OpenCV's
   * run-length detector stops recognising the 1:1:3:1:1 signature, which was
   * measured rather than guessed.
   */
  const eye = (originX: number, originY: number): string => {
    const x = originX + quietZone;
    const y = originY + quietZone;
    return `
      <rect x="${x}" y="${y}" width="7" height="7" rx="1" fill="${colours.eye}"/>
      <rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="0.6" fill="${colours.background}"/>
      <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.4" fill="${colours.eyeCore}"/>
    `;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${grid} ${grid}" role="img" aria-label="QR code">
  <defs>
    <linearGradient id="qr-modules" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colours.moduleFrom}"/>
      <stop offset="100%" stop-color="${colours.moduleTo}"/>
    </linearGradient>
  </defs>
  ${transparent ? '' : `<rect width="${grid}" height="${grid}" rx="1.6" fill="${colours.background}"/>`}
  <g fill="url(#qr-modules)">${parts.join('')}</g>
  ${eye(0, 0)}
  ${eye(matrix.size - 7, 0)}
  ${eye(0, matrix.size - 7)}
  ${
    withLogoSlot
      ? `<g transform="translate(${grid / 2}, ${grid / 2})">
      <circle r="${logoRadius + 0.7}" fill="${colours.logoRing}"/>
      <circle r="${logoRadius + 0.1}" fill="none" stroke="${colours.eyeCore}" stroke-width="0.34"/>
      <g transform="scale(${logoRadius / 26}) translate(-24, -30)">
        <path d="M24 2 C24 2 44 24.5 44 37 A20 20 0 0 1 4 37 C4 24.5 24 2 24 2 Z"
              fill="${colours.eyeCore}"/>
        <ellipse cx="18" cy="31" rx="4.6" ry="6.4" fill="#ffffff" opacity="0.5"
                 transform="rotate(-22 18 31)"/>
      </g>
    </g>`
      : ''
  }
</svg>`;
}

/** Convenience wrapper: text in, finished SVG out. */
export async function qrSvgFor(text: string, options?: QrOptions): Promise<string> {
  return renderQrSvg(await buildMatrix(text), options);
}
