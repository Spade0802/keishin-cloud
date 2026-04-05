/**
 * PDF Report Generation Module
 *
 * Generates a PDF report of keishin simulation results using pdf-lib.
 *
 * pdf-lib's standard fonts (Helvetica) do not include Japanese glyphs.
 * We use romanized / English labels for structure and render numeric values
 * directly (which are ASCII-safe). Industry names that contain non-ASCII
 * characters are transliterated to a placeholder. A footer note informs
 * the reader about this limitation.
 *
 * To enable full Japanese rendering, embed a CJK font such as
 * NotoSansJP-Regular.otf via `doc.embedFont(fontBytes)`.
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';

// --- Types (mirrors the data sent from result-view) ---

interface IndustryRow {
  name: string;
  X1: number;
  Z: number;
  Z1: number;
  Z2: number;
  P: number;
  prevP?: number;
}

interface YResultData {
  indicators: Record<string, number>;
  indicatorsRaw: Record<string, number>;
  A: number;
  Y: number;
  operatingCF: number;
}

interface WDetailData {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
  w6: number;
  w7: number;
  w8: number;
  total: number;
}

export interface PdfReportData {
  companyName?: string;
  period?: string;
  reviewBaseDate?: string;
  permitNumber?: string;
  industries: IndustryRow[];
  Y: number;
  X2: number;
  X21: number;
  X22: number;
  W: number;
  wTotal: number;
  yResult: YResultData;
  wDetail?: WDetailData;
}

// --- Layout constants ---

const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COLOR_PRIMARY = rgb(0.13, 0.13, 0.55);
const COLOR_HEADER_BG = rgb(0.93, 0.93, 0.97);
const COLOR_TEXT = rgb(0.15, 0.15, 0.15);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_BORDER = rgb(0.8, 0.8, 0.8);

// Romanized label mapping for Y indicators
const INDICATOR_LABELS: Record<string, string> = {
  x1: 'Net Interest Ratio',
  x2: 'Debt Turnover Period',
  x3: 'Gross Profit / Total Capital',
  x4: 'Ordinary Profit / Sales',
  x5: 'Equity / Fixed Assets',
  x6: 'Equity Ratio',
  x7: 'Operating CF (absolute)',
  x8: 'Retained Earnings (absolute)',
};

// W item labels
const W_LABELS: Record<string, string> = {
  w1: 'Labor Welfare (W1)',
  w2: 'Business Years (W2)',
  w3: 'Disaster Prevention (W3)',
  w4: 'Compliance (W4)',
  w5: 'Accounting/Audit (W5)',
  w6: 'R&D (W6)',
  w7: 'Construction Machinery (W7)',
  w8: 'ISO etc. (W8)',
};

// --- Helper class for drawing ---

class PdfReportBuilder {
  private doc: PDFDocument;
  private page: PDFPage;
  private fontRegular!: PDFFont;
  private fontBold!: PDFFont;
  private cursorY: number;

  constructor(doc: PDFDocument) {
    this.doc = doc;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = PAGE_HEIGHT - 50;
  }

  async init() {
    this.fontRegular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
  }

  /** Ensure enough vertical space; add a new page if needed. */
  private ensureSpace(needed: number) {
    if (this.cursorY - needed < 60) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.cursorY = PAGE_HEIGHT - 50;
    }
  }

  /** Draw a horizontal rule */
  private drawHR() {
    this.page.drawLine({
      start: { x: MARGIN_LEFT, y: this.cursorY },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: this.cursorY },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
    this.cursorY -= 8;
  }

  /** Draw text */
  private text(
    str: string,
    x: number,
    options: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      align?: 'left' | 'right' | 'center';
      maxWidth?: number;
    } = {}
  ) {
    const font = options.font ?? this.fontRegular;
    const size = options.size ?? 10;
    const color = options.color ?? COLOR_TEXT;
    const width = font.widthOfTextAtSize(str, size);

    let drawX = x;
    if (options.align === 'right' && options.maxWidth) {
      drawX = x + options.maxWidth - width;
    } else if (options.align === 'center' && options.maxWidth) {
      drawX = x + (options.maxWidth - width) / 2;
    }

    this.page.drawText(str, { x: drawX, y: this.cursorY, size, font, color });
  }

  // --- Public drawing methods ---

  drawTitle(data: PdfReportData) {
    // Main title
    this.text('Keishin Simulation Report', MARGIN_LEFT, {
      size: 20,
      font: this.fontBold,
      color: COLOR_PRIMARY,
    });
    this.cursorY -= 24;

    // Subtitle (Japanese title note)
    this.text('Keiei Jikou Shinsa Simulation Result', MARGIN_LEFT, {
      size: 10,
      color: COLOR_MUTED,
    });
    this.cursorY -= 20;

    this.drawHR();
    this.cursorY -= 4;

    // Company info
    if (data.companyName) {
      this.text('Company:', MARGIN_LEFT, { size: 10, font: this.fontBold });
      this.text(data.companyName, MARGIN_LEFT + 70, { size: 10 });
      this.cursorY -= 16;
    }
    if (data.permitNumber) {
      this.text('Permit No:', MARGIN_LEFT, { size: 10, font: this.fontBold });
      this.text(data.permitNumber, MARGIN_LEFT + 70, { size: 10 });
      this.cursorY -= 16;
    }
    if (data.period) {
      this.text('Period:', MARGIN_LEFT, { size: 10, font: this.fontBold });
      this.text(data.period, MARGIN_LEFT + 70, { size: 10 });
      this.cursorY -= 16;
    }
    if (data.reviewBaseDate) {
      this.text('Review Date:', MARGIN_LEFT, { size: 10, font: this.fontBold });
      this.text(data.reviewBaseDate, MARGIN_LEFT + 70, { size: 10 });
      this.cursorY -= 16;
    }

    // Generation date
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.text(`Generated: ${dateStr}`, MARGIN_LEFT, { size: 9, color: COLOR_MUTED });
    this.cursorY -= 24;
  }

  drawOverallPScore(data: PdfReportData) {
    this.ensureSpace(120);

    // Section header
    this.drawSectionHeader('Overall P Score Breakdown');

    // P formula
    this.text('P = 0.25 x X1 + 0.15 x X2 + 0.20 x Y + 0.25 x Z + 0.15 x W', MARGIN_LEFT, {
      size: 9,
      color: COLOR_MUTED,
    });
    this.cursorY -= 20;

    // Common scores in a row
    const scores = [
      { label: 'Y', value: data.Y },
      { label: 'X2', value: data.X2 },
      { label: 'X21', value: data.X21 },
      { label: 'X22', value: data.X22 },
      { label: 'W', value: data.W },
    ];

    const boxWidth = CONTENT_WIDTH / scores.length;
    for (let i = 0; i < scores.length; i++) {
      const x = MARGIN_LEFT + i * boxWidth;

      // Box background
      this.page.drawRectangle({
        x: x + 2,
        y: this.cursorY - 30,
        width: boxWidth - 4,
        height: 42,
        color: COLOR_HEADER_BG,
        borderColor: COLOR_BORDER,
        borderWidth: 0.5,
      });

      // Label
      this.text(scores[i].label, x + 2, {
        size: 9,
        font: this.fontBold,
        color: COLOR_MUTED,
        align: 'center',
        maxWidth: boxWidth - 4,
      });

      const savedY = this.cursorY;
      this.cursorY -= 18;

      // Value
      this.text(String(scores[i].value), x + 2, {
        size: 14,
        font: this.fontBold,
        color: COLOR_PRIMARY,
        align: 'center',
        maxWidth: boxWidth - 4,
      });

      this.cursorY = savedY;
    }

    this.cursorY -= 50;
  }

  drawIndustryTable(data: PdfReportData) {
    this.ensureSpace(60 + data.industries.length * 20);

    this.drawSectionHeader('Industry P Scores');

    // Table header
    const cols = [
      { label: 'Industry', width: 120 },
      { label: 'X1', width: 60 },
      { label: 'X2', width: 50 },
      { label: 'Y', width: 50 },
      { label: 'Z', width: 50 },
      { label: 'W', width: 50 },
      { label: 'P', width: 60 },
    ];

    // Header row background
    const totalTableWidth = cols.reduce((s, c) => s + c.width, 0);
    this.page.drawRectangle({
      x: MARGIN_LEFT,
      y: this.cursorY - 4,
      width: totalTableWidth,
      height: 18,
      color: COLOR_HEADER_BG,
    });

    let colX = MARGIN_LEFT;
    for (const col of cols) {
      this.text(col.label, colX + 4, { size: 9, font: this.fontBold, color: COLOR_PRIMARY });
      colX += col.width;
    }
    this.cursorY -= 20;
    this.drawHR();

    // Data rows
    for (const ind of data.industries) {
      this.ensureSpace(22);

      colX = MARGIN_LEFT;
      // Industry name - use romanized if it looks like Japanese (non-ASCII)
      const displayName = containsNonAscii(ind.name) ? `[${ind.name.length} chars]` : ind.name;
      this.text(displayName, colX + 4, { size: 9 });
      colX += cols[0].width;

      this.text(String(ind.X1), colX + 4, { size: 9, align: 'right', maxWidth: cols[1].width - 8 });
      colX += cols[1].width;

      this.text(String(data.X2), colX + 4, { size: 9, align: 'right', maxWidth: cols[2].width - 8 });
      colX += cols[2].width;

      this.text(String(data.Y), colX + 4, { size: 9, align: 'right', maxWidth: cols[3].width - 8 });
      colX += cols[3].width;

      this.text(String(ind.Z), colX + 4, { size: 9, align: 'right', maxWidth: cols[4].width - 8 });
      colX += cols[4].width;

      this.text(String(data.W), colX + 4, { size: 9, align: 'right', maxWidth: cols[5].width - 8 });
      colX += cols[5].width;

      this.text(String(ind.P), colX + 4, {
        size: 10,
        font: this.fontBold,
        color: COLOR_PRIMARY,
        align: 'right',
        maxWidth: cols[6].width - 8,
      });

      this.cursorY -= 18;
    }

    this.cursorY -= 10;
  }

  drawYScoreDetails(data: PdfReportData) {
    this.ensureSpace(180);

    this.drawSectionHeader('Y Score Details (Financial Analysis)');

    this.text(`Y = ${data.yResult.Y}   (A = ${data.yResult.A})`, MARGIN_LEFT, {
      size: 11,
      font: this.fontBold,
    });
    this.cursorY -= 20;

    // Indicator table
    const indicatorKeys = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];

    // Header
    this.page.drawRectangle({
      x: MARGIN_LEFT,
      y: this.cursorY - 4,
      width: CONTENT_WIDTH,
      height: 18,
      color: COLOR_HEADER_BG,
    });

    this.text('Indicator', MARGIN_LEFT + 4, { size: 9, font: this.fontBold });
    this.text('Raw Value', MARGIN_LEFT + 240, { size: 9, font: this.fontBold, align: 'right', maxWidth: 80 });
    this.text('Score', MARGIN_LEFT + 340, { size: 9, font: this.fontBold, align: 'right', maxWidth: 80 });
    this.cursorY -= 20;

    for (const key of indicatorKeys) {
      this.ensureSpace(18);

      const label = INDICATOR_LABELS[key] ?? key;
      const rawVal = data.yResult.indicatorsRaw?.[key];
      const scoreVal = data.yResult.indicators?.[key];

      this.text(label, MARGIN_LEFT + 4, { size: 9 });
      if (rawVal !== undefined) {
        this.text(rawVal.toFixed(2), MARGIN_LEFT + 240, { size: 9, align: 'right', maxWidth: 80 });
      }
      if (scoreVal !== undefined) {
        this.text(String(scoreVal), MARGIN_LEFT + 340, { size: 9, align: 'right', maxWidth: 80 });
      }
      this.cursorY -= 16;
    }

    // Operating CF
    this.cursorY -= 4;
    this.text(
      `Operating Cash Flow: ${data.yResult.operatingCF.toLocaleString()} (thousands JPY)`,
      MARGIN_LEFT,
      { size: 9, color: COLOR_MUTED }
    );
    this.cursorY -= 20;
  }

  drawWDetails(data: PdfReportData) {
    if (!data.wDetail) return;
    this.ensureSpace(120);

    this.drawSectionHeader('W Score Details (Social Contribution)');

    this.text(`W = ${data.W}   (Raw total = ${data.wDetail.total})`, MARGIN_LEFT, {
      size: 11,
      font: this.fontBold,
    });
    this.cursorY -= 6;
    this.text(
      `W = floor(${data.wDetail.total} x 1750 / 200) = ${data.W}`,
      MARGIN_LEFT,
      { size: 9, color: COLOR_MUTED }
    );
    this.cursorY -= 20;

    const wKeys = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'] as const;
    for (const key of wKeys) {
      this.ensureSpace(18);
      const label = W_LABELS[key] ?? key;
      const value = data.wDetail[key];

      this.text(label, MARGIN_LEFT + 4, { size: 9 });
      this.text(String(value), MARGIN_LEFT + 300, {
        size: 9,
        font: this.fontBold,
        align: 'right',
        maxWidth: 60,
        color: value < 0 ? rgb(0.8, 0.1, 0.1) : value > 0 ? rgb(0.1, 0.5, 0.1) : COLOR_TEXT,
      });
      this.cursorY -= 16;
    }

    this.cursorY -= 10;
  }

  drawFooter() {
    this.ensureSpace(40);
    this.drawHR();
    this.cursorY -= 4;

    this.text(
      'Note: This is a simulation result, not an official Keishin rating.',
      MARGIN_LEFT,
      { size: 8, color: COLOR_MUTED }
    );
    this.cursorY -= 14;

    this.text(
      'Note: Japanese characters (industry names, etc.) may display as placeholders.',
      MARGIN_LEFT,
      { size: 8, color: COLOR_MUTED }
    );
    this.cursorY -= 12;
    this.text(
      'For full Japanese text support, a CJK font must be embedded in a future version.',
      MARGIN_LEFT,
      { size: 8, color: COLOR_MUTED }
    );
  }

  // --- Internal helpers ---

  private drawSectionHeader(title: string) {
    this.page.drawRectangle({
      x: MARGIN_LEFT,
      y: this.cursorY - 6,
      width: CONTENT_WIDTH,
      height: 22,
      color: COLOR_PRIMARY,
    });
    this.text(title, MARGIN_LEFT + 8, {
      size: 11,
      font: this.fontBold,
      color: rgb(1, 1, 1),
    });
    this.cursorY -= 30;
  }
}

/** Check if a string contains non-ASCII characters (likely Japanese) */
function containsNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

// --- Main export function ---

/**
 * Generate a PDF report from keishin simulation results.
 * Returns the PDF as a Uint8Array.
 */
export async function generatePdfReport(data: PdfReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  doc.setTitle('Keishin Simulation Report');
  doc.setAuthor('Keishin Cloud');
  doc.setCreationDate(new Date());

  const builder = new PdfReportBuilder(doc);
  await builder.init();

  builder.drawTitle(data);
  builder.drawOverallPScore(data);
  builder.drawIndustryTable(data);
  builder.drawYScoreDetails(data);
  builder.drawWDetails(data);
  builder.drawFooter();

  return doc.save();
}
