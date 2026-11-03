import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
} from 'docx';
import type { InvoiceRecord, SiteSettings, WorkReport } from '@core/entities';
import { Money } from '@core/value-objects/money';

const GOLD = '8A671C';
const INK = '10141B';
const MUTED = '5B6068';
const LINE = 'D7DBE2';
const GOLD_TINT = 'F8EED4';
const ROW_TINT = 'FAFBFC';

const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const HAIRLINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE };

const FULL_WIDTH = { size: 100, type: WidthType.PERCENTAGE } as const;

function logoBytes(): Buffer | null {
  try {
    return readFileSync(path.join(process.cwd(), 'public', 'brand', 'mersam-mark.png'));
  } catch {
    // A missing logo must not stop the office getting its document.
    return null;
  }
}

function longDate(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function text(
  content: string,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    caps?: boolean;
    spacingAfter?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.align,
    spacing: { after: options.spacingAfter ?? 60 },
    children: [
      new TextRun({
        text: content,
        bold: options.bold,
        // docx sizes are in half-points.
        size: (options.size ?? 9) * 2,
        color: options.color ?? INK,
        allCaps: options.caps,
        font: 'Calibri',
      }),
    ],
  });
}

function label(content: string): Paragraph {
  return text(content, { size: 6.5, bold: true, color: MUTED, caps: true, spacingAfter: 20 });
}

function cell(
  children: Paragraph[],
  options: {
    width?: number;
    shading?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    borders?: boolean;
  } = {},
): TableCell {
  const border = options.borders === false ? NO_BORDER : HAIRLINE;
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading
      ? { type: ShadingType.CLEAR, fill: options.shading, color: 'auto' }
      : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    borders: { top: border, bottom: border, left: border, right: border },
    children,
  });
}

function headerCell(content: string, align?: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell {
  return cell([text(content, { bold: true, size: 7.5, color: 'FFFFFF', caps: true, align })], {
    shading: INK,
  });
}

/** Logo plus company block, shared by both documents. */
function letterhead(settings: SiteSettings, title: string, subtitle?: string): (Paragraph | Table)[] {
  const logo = logoBytes();

  return [
    new Table({
      width: FULL_WIDTH,
      borders: {
        top: NO_BORDER,
        bottom: NO_BORDER,
        left: NO_BORDER,
        right: NO_BORDER,
        insideHorizontal: NO_BORDER,
        insideVertical: NO_BORDER,
      },
      rows: [
        new TableRow({
          children: [
            cell(
              [
                ...(logo
                  ? [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new ImageRun({
                            data: new Uint8Array(logo),
                            type: 'png',
                            transformation: { width: 104, height: 81 },
                          }),
                        ],
                      }),
                    ]
                  : []),
                text(settings.legalName, { size: 8, bold: true, color: GOLD, spacingAfter: 10 }),
                text(`${settings.city}, ${settings.country}`, { size: 7.5, color: MUTED, spacingAfter: 10 }),
                text(`Tel: ${settings.primaryPhone}`, { size: 7.5, color: MUTED, spacingAfter: 10 }),
                text(settings.primaryEmail, { size: 7.5, color: MUTED }),
              ],
              { width: 58, borders: false },
            ),
            cell(
              [
                text(title, { bold: true, size: 24, align: AlignmentType.RIGHT, spacingAfter: 20 }),
                ...(subtitle
                  ? [text(subtitle, { size: 8, color: MUTED, align: AlignmentType.RIGHT })]
                  : []),
              ],
              { width: 42, borders: false },
            ),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
      children: [],
    }),
  ];
}

function metaTable(entries: { label: string; value: string }[]): Table {
  return new Table({
    width: FULL_WIDTH,
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: entries.map((entry) =>
          cell([label(entry.label), text(entry.value, { bold: true, size: 9.5 })], {
            width: Math.floor(100 / entries.length),
            borders: false,
          }),
        ),
      }),
    ],
  });
}

function documentFooter(settings: SiteSettings): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
        spacing: { before: 120 },
        children: [
          new TextRun({
            text: `${settings.companyName}  |  ${settings.primaryPhone}  |  ${settings.primaryEmail}`,
            size: 14,
            color: MUTED,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

const PAGE = {
  margin: { top: 720, bottom: 720, left: 720, right: 720 },
} as const;

/* ----------------------------------------------------------------- invoice */

export async function buildInvoiceDocx(
  invoice: InvoiceRecord,
  settings: SiteSettings,
): Promise<Buffer> {
  const money = (minor: number) => Money.fromMinor(minor, invoice.currency).formatPlain();

  const lineRows = invoice.lines.map(
    (line, index) =>
      new TableRow({
        children: [
          cell([text(String(index + 1), { size: 8.5 })], {
            width: 6,
            shading: index % 2 === 1 ? ROW_TINT : undefined,
          }),
          cell([text(line.unitOfMeasure, { size: 8.5 })], {
            width: 11,
            shading: index % 2 === 1 ? ROW_TINT : undefined,
          }),
          cell([text(line.description, { size: 8.5 })], {
            width: 43,
            shading: index % 2 === 1 ? ROW_TINT : undefined,
          }),
          cell(
            [
              text(
                Number.isInteger(line.quantity) ? String(line.quantity) : line.quantity.toFixed(2),
                { size: 8.5, align: AlignmentType.RIGHT },
              ),
            ],
            { width: 8, shading: index % 2 === 1 ? ROW_TINT : undefined },
          ),
          cell([text(money(line.unitPriceMinor), { size: 8.5, align: AlignmentType.RIGHT })], {
            width: 15,
            shading: index % 2 === 1 ? ROW_TINT : undefined,
          }),
          cell(
            [text(money(line.lineTotalMinor), { size: 8.5, bold: true, align: AlignmentType.RIGHT })],
            { width: 17, shading: index % 2 === 1 ? ROW_TINT : undefined },
          ),
        ],
      }),
  );

  const totalRow = (
    heading: string,
    value: string,
    options: { bold?: boolean; tint?: boolean } = {},
  ) =>
    new TableRow({
      children: [
        cell([text(heading, { size: 9, bold: options.bold, color: options.bold ? INK : MUTED })], {
          width: 60,
          shading: options.tint ? GOLD_TINT : undefined,
        }),
        cell(
          [
            text(value, {
              size: options.bold ? 11 : 9,
              bold: true,
              align: AlignmentType.RIGHT,
              color: options.tint ? GOLD : INK,
            }),
          ],
          { width: 40, shading: options.tint ? GOLD_TINT : undefined },
        ),
      ],
    });

  const document = new Document({
    creator: settings.companyName,
    title: `Invoice ${invoice.invoiceNumber}`,
    description: `Invoice for ${invoice.customerName}`,
    sections: [
      {
        properties: { page: PAGE },
        footers: { default: documentFooter(settings) },
        children: [
          ...letterhead(settings, 'INVOICE', invoice.customerReference),

          metaTable([
            { label: 'Date', value: longDate(invoice.issuedOn) },
            { label: 'Invoice No.', value: invoice.invoiceNumber },
            { label: 'Customer ID', value: invoice.customerReference },
            { label: 'Due', value: invoice.dueOn ? longDate(invoice.dueOn) : 'On receipt' },
          ]),

          new Paragraph({ spacing: { after: 160 }, children: [] }),

          label('Customer'),
          text(invoice.customerName, { bold: true, size: 12 }),
          ...[invoice.customerAddress, invoice.customerPhone, invoice.customerEmail]
            .filter((value): value is string => Boolean(value))
            .map((value) => text(value, { size: 8.5, color: MUTED })),

          new Paragraph({ spacing: { after: 200 }, children: [] }),

          new Table({
            width: FULL_WIDTH,
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  headerCell('No.'),
                  headerCell('Unit'),
                  headerCell('Description'),
                  headerCell('Qty', AlignmentType.RIGHT),
                  headerCell('Unit price GHC', AlignmentType.RIGHT),
                  headerCell('Total GHC', AlignmentType.RIGHT),
                ],
              }),
              ...lineRows,
            ],
          }),

          new Paragraph({ spacing: { after: 220 }, children: [] }),

          new Table({
            width: { size: 52, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.RIGHT,
            rows: [
              totalRow('Sub-total', money(invoice.subtotalMinor)),
              ...(invoice.discountMinor > 0
                ? [totalRow('Discount', `-${money(invoice.discountMinor)}`)]
                : []),
              ...(invoice.vatRate > 0
                ? [totalRow(`VAT (${invoice.vatRate}%)`, money(invoice.vatMinor))]
                : []),
              totalRow('TOTAL', `${invoice.currency} ${money(invoice.totalMinor)}`, {
                bold: true,
                tint: true,
              }),
              ...(invoice.amountPaidMinor > 0
                ? [
                    totalRow('Amount paid', money(invoice.amountPaidMinor)),
                    totalRow('Balance due', money(invoice.balanceMinor), { bold: true }),
                  ]
                : []),
            ],
          }),

          new Paragraph({ spacing: { after: 240 }, children: [] }),

          text('Terms of sale and other comments', {
            bold: true,
            size: 7.5,
            color: GOLD,
            caps: true,
          }),
          ...invoice.termsText
            .split('\n')
            .filter(Boolean)
            .map((line) => text(line, { size: 8, color: MUTED })),

          new Paragraph({ spacing: { after: 160 }, children: [] }),

          text('Payment details', { bold: true, size: 7.5, color: GOLD, caps: true }),
          ...invoice.paymentDetails
            .split('\n')
            .filter(Boolean)
            .map((line) => text(line, { size: 8, color: MUTED })),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

/* ------------------------------------------------------------ work report */

const STATE_LABELS: Record<string, string> = {
  fully_paid: 'FULLY PAID',
  part_payment: 'PART PAYMENT RECEIVED',
  unpaid: 'PAYMENT OUTSTANDING',
};

export async function buildWorkReportDocx(
  report: WorkReport,
  settings: SiteSettings,
): Promise<Buffer> {
  const money = (minor: number) => Money.fromMinor(minor, report.currency).formatPlain();

  const heading = (number: number, title: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 260, after: 90 },
      children: [
        new TextRun({ text: `${number}. ${title}`, bold: true, size: 22, color: INK, font: 'Calibri' }),
      ],
    });

  const body = (content: string) =>
    content
      .split('\n')
      .filter(Boolean)
      .map((line) => text(line, { size: 9.5, color: '2C3542', spacingAfter: 100 }));

  const summaryRow = (heading: string, value: string, bold = false) =>
    new TableRow({
      children: [
        cell([text(heading, { size: 9.5, bold })], { width: 70, shading: 'F4F5F7' }),
        cell([text(value, { size: 9.5, bold, align: AlignmentType.RIGHT })], {
          width: 30,
          shading: 'F4F5F7',
        }),
      ],
    });

  const document = new Document({
    creator: settings.companyName,
    title: `Work report ${report.reportNumber}`,
    description: `Work completion and payment report for ${report.clientName}`,
    sections: [
      {
        properties: { page: PAGE },
        footers: { default: documentFooter(settings) },
        children: [
          ...letterhead(settings, 'REPORT', 'Work Completion and Payment'),

          text(report.title, { bold: true, size: 15, spacingAfter: 20 }),
          text(report.serviceCategory, { size: 9.5, color: MUTED, spacingAfter: 200 }),

          new Table({
            width: FULL_WIDTH,
            rows: [
              new TableRow({
                children: [
                  cell([text('Report No.', { bold: true, size: 9 })], { width: 35, shading: ROW_TINT }),
                  cell([text(report.reportNumber, { size: 9 })], { width: 65 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([text('Client Name', { bold: true, size: 9 })], { width: 35, shading: ROW_TINT }),
                  cell([text(report.clientName, { size: 9 })], { width: 65 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([text('Date of Work', { bold: true, size: 9 })], { width: 35, shading: ROW_TINT }),
                  cell([text(longDate(report.dateOfWork), { size: 9 })], { width: 65 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([text('Service Category', { bold: true, size: 9 })], {
                    width: 35,
                    shading: ROW_TINT,
                  }),
                  cell([text(report.serviceCategory, { size: 9 })], { width: 65 }),
                ],
              }),
            ],
          }),

          heading(1, 'Introduction'),
          ...body(report.introduction),

          heading(2, 'Description of Work Performed'),
          ...body(report.workPerformed),

          heading(3, 'Cost and Payment Breakdown'),
          new Table({
            width: FULL_WIDTH,
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  headerCell('Description'),
                  headerCell(`Amount (${report.currency})`, AlignmentType.RIGHT),
                ],
              }),
              ...report.costLines.map(
                (line, index) =>
                  new TableRow({
                    children: [
                      cell([text(line.description, { size: 9 })], {
                        width: 70,
                        shading: index % 2 === 1 ? ROW_TINT : undefined,
                      }),
                      cell([text(money(line.amountMinor), { size: 9, align: AlignmentType.RIGHT })], {
                        width: 30,
                        shading: index % 2 === 1 ? ROW_TINT : undefined,
                      }),
                    ],
                  }),
              ),
              summaryRow('Total Cost of Work', money(report.totalCostMinor), true),
              summaryRow('Total Amount Paid', money(report.totalPaidMinor)),
              summaryRow('Outstanding Balance', money(report.outstandingMinor), true),
            ],
          }),

          heading(4, 'Payment Confirmation'),
          ...body(report.paymentNote),

          new Table({
            width: { size: 56, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  cell(
                    [
                      text(
                        `Payment Status:  ${STATE_LABELS[report.paymentState] ?? 'UNKNOWN'}`,
                        { bold: true, size: 10.5, color: report.paymentState === 'fully_paid' ? '1F7A48' : GOLD },
                      ),
                    ],
                    { shading: report.paymentState === 'fully_paid' ? 'E3F4EA' : GOLD_TINT },
                  ),
                ],
              }),
            ],
          }),

          heading(5, 'Work Completion Confirmation'),
          ...body(report.completionNote),

          heading(6, 'Appreciation'),
          ...body(report.appreciation),

          new Paragraph({ spacing: { after: 320 }, children: [] }),

          new Table({
            width: FULL_WIDTH,
            rows: [
              new TableRow({
                children: [
                  cell([text('Prepared by', { bold: true, size: 9 })], { width: 40, shading: ROW_TINT }),
                  cell([text(report.preparedBy, { size: 9 })], { width: 60 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([text('Authorised Representative', { bold: true, size: 9 })], {
                    width: 40,
                    shading: ROW_TINT,
                  }),
                  cell([text(report.authorisedRepresentative ?? ' ', { size: 9 })], { width: 60 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([text('Signature', { bold: true, size: 9 })], { width: 40, shading: ROW_TINT }),
                  cell([new Paragraph({ spacing: { after: 280 }, children: [] })], { width: 60 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([text('Date of Report', { bold: true, size: 9 })], {
                    width: 40,
                    shading: ROW_TINT,
                  }),
                  cell([text(longDate(report.reportDate), { size: 9 })], { width: 60 }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
