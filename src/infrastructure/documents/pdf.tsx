import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { InvoiceRecord, Proposal, SiteSettings, WorkReport } from '@core/entities';
import { calculateProposalTotals } from '@core/entities';
import { Money } from '@core/value-objects/money';

/**
 * Helvetica, the PDF default, has no cedi sign, so every amount would render
 * as a gap. Noto Sans is bundled under the Open Font License and covers it.
 */
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
let fontsRegistered = false;

function registerFonts(): void {
  if (fontsRegistered) return;
  Font.register({
    family: 'Noto Sans',
    fonts: [
      { src: path.join(FONT_DIR, 'NotoSans-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(FONT_DIR, 'NotoSans-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
  // Long descriptions must break mid-word rather than overflow the cell.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

let logoData: Buffer | null | undefined;

/** Read once per process. react-pdf treats a bare path as a URL and fetches it. */
function logo(): Buffer | null {
  if (logoData === undefined) {
    try {
      logoData = readFileSync(path.join(process.cwd(), 'public', 'brand', 'mersam-mark.png'));
    } catch {
      logoData = null;
    }
  }
  return logoData;
}

const GOLD = '#8a671c';
const GOLD_LIGHT = '#f8eed4';
const INK = '#10141b';
const MUTED = '#5b6068';
const LINE = '#d7dbe2';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: INK,
    paddingTop: 34,
    paddingBottom: 56,
    paddingHorizontal: 36,
    lineHeight: 1.45,
  },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 82, height: 64, objectFit: 'contain' },
  brandName: { fontSize: 19, lineHeight: 1.2, fontWeight: 'bold', color: GOLD, letterSpacing: -0.4 },
  brandTag: { fontSize: 7.5, lineHeight: 1.35, color: MUTED },

  docTitle: { fontSize: 25, lineHeight: 1.2, fontWeight: 'bold', letterSpacing: 3, color: INK, textAlign: 'right' },
  docSub: { fontSize: 8, lineHeight: 1.35, color: MUTED, textAlign: 'right', marginTop: 3 },

  rule: { height: 2, backgroundColor: GOLD, marginTop: 10, marginBottom: 14 },
  thinRule: { height: 1, backgroundColor: LINE, marginVertical: 10 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18 },
  metaBlock: { flexGrow: 1, flexBasis: 0 },
  metaLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: MUTED,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: { fontSize: 9.5, lineHeight: 1.3, fontWeight: 'bold' },
  metaText: { fontSize: 8.5, color: MUTED },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: INK,
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  th: { fontSize: 6.8, fontWeight: 'bold', letterSpacing: 0.7, textTransform: 'uppercase' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  trAlt: { backgroundColor: '#fafbfc' },
  td: { fontSize: 8.5 },

  colNo: { width: 26 },
  colUnit: { width: 52 },
  colDesc: { flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  colQty: { width: 34, textAlign: 'right' },
  colPrice: { width: 72, textAlign: 'right' },
  colTotal: { width: 76, textAlign: 'right' },

  footerRow: { flexDirection: 'row', gap: 20, marginTop: 16 },
  termsBox: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.5,
    borderColor: LINE,
    borderRadius: 4,
    padding: 10,
  },
  boxTitle: {
    fontSize: 6.8,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: GOLD,
    marginBottom: 5,
  },
  termsLine: { fontSize: 7.8, color: MUTED, marginBottom: 3 },

  totalsBox: { width: 214 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  totalLabel: { fontSize: 8.5, color: MUTED },
  totalValue: { fontSize: 9, fontWeight: 'bold' },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: GOLD_LIGHT,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 9,
    marginTop: 6,
  },
  grandLabel: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.6 },
  grandValue: { fontSize: 13, lineHeight: 1.25, fontWeight: 'bold', color: GOLD },

  sectionHeading: { fontSize: 11, lineHeight: 1.3, fontWeight: 'bold', marginTop: 16, marginBottom: 5 },
  body: { fontSize: 9, color: '#2c3542', marginBottom: 5 },

  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 11,
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginTop: 6,
  },

  signRow: { flexDirection: 'row', gap: 26, marginTop: 26 },
  signCell: { flexGrow: 1, flexBasis: 0 },
  signLine: { borderBottomWidth: 0.8, borderBottomColor: INK, height: 30, marginBottom: 4 },
  signLabel: { fontSize: 7.5, color: MUTED },

  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

function longDate(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PageFooter({ settings, reference }: { settings: SiteSettings; reference: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.footerText}>
        {settings.companyName} | {settings.primaryPhone} | {settings.primaryEmail}
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `${reference}  |  Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function Letterhead({ settings, title, subtitle }: { settings: SiteSettings; title: string; subtitle?: string }) {
  return (
    <>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', gap: 11, alignItems: 'center' }}>
          {logo() && <Image src={{ data: logo()!, format: 'png' }} style={styles.logo} />}
          <View>
            <Text style={styles.brandTag}>{settings.legalName}</Text>
            <Text style={styles.brandTag}>
              {settings.city}, {settings.country}
            </Text>
            <Text style={styles.brandTag}>Tel: {settings.primaryPhone}</Text>
          </View>
        </View>
        <View>
          <Text style={styles.docTitle}>{title}</Text>
          {subtitle && <Text style={styles.docSub}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.rule} />
    </>
  );
}

/* ----------------------------------------------------------------- invoice */

export function InvoicePdf({
  invoice,
  settings,
}: {
  invoice: InvoiceRecord;
  settings: SiteSettings;
}) {
  registerFonts();
  const money = (minor: number) => Money.fromMinor(minor, invoice.currency).formatPlain();
  const terms = invoice.termsText.split('\n').filter(Boolean);
  const payment = invoice.paymentDetails.split('\n').filter(Boolean);

  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber}`}
      author={settings.companyName}
      subject={`Invoice for ${invoice.customerName}`}
    >
      <Page size="A4" style={styles.page}>
        <Letterhead settings={settings} title="INVOICE" subtitle={invoice.customerReference} />

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{longDate(invoice.issuedOn)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Customer ID</Text>
            <Text style={styles.metaValue}>{invoice.customerReference}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Due</Text>
            <Text style={styles.metaValue}>
              {invoice.dueOn ? longDate(invoice.dueOn) : 'On receipt'}
            </Text>
          </View>
        </View>

        <View style={styles.thinRule} />

        <View style={styles.metaRow}>
          <View style={{ flexGrow: 2, flexBasis: 0 }}>
            <Text style={styles.metaLabel}>Customer</Text>
            <Text style={[styles.metaValue, { fontSize: 11 }]}>{invoice.customerName}</Text>
            {invoice.customerAddress && (
              <Text style={styles.metaText}>{invoice.customerAddress}</Text>
            )}
            {invoice.customerPhone && <Text style={styles.metaText}>{invoice.customerPhone}</Text>}
            {invoice.customerEmail && <Text style={styles.metaText}>{invoice.customerEmail}</Text>}
          </View>
          <View style={{ flexGrow: 1, flexBasis: 0, alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text
              style={[
                styles.statusChip,
                invoice.status === 'paid'
                  ? { backgroundColor: '#e3f4ea', color: '#1f7a48' }
                  : invoice.status === 'overdue'
                    ? { backgroundColor: '#fbe7e6', color: '#a6322b' }
                    : { backgroundColor: GOLD_LIGHT, color: GOLD },
              ]}
            >
              {invoice.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colNo]}>No.</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
            <Text style={[styles.th, styles.colTotal]}>Total GHC</Text>
          </View>

          {invoice.lines.map((line, index) => (
            <View key={line.id} style={[styles.tr, index % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
              <Text style={[styles.td, styles.colNo]}>{index + 1}</Text>
              <Text style={[styles.td, styles.colUnit]}>{line.unitOfMeasure}</Text>
              <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.td, styles.colQty]}>
                {Number.isInteger(line.quantity) ? line.quantity : line.quantity.toFixed(2)}
              </Text>
              <Text style={[styles.td, styles.colPrice]}>{money(line.unitPriceMinor)}</Text>
              <Text style={[styles.td, styles.colTotal, { fontWeight: 'bold' }]}>
                {money(line.lineTotalMinor)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footerRow} wrap={false}>
          <View style={styles.termsBox}>
            <Text style={styles.boxTitle}>Terms of sale and other comments</Text>
            {terms.map((line, index) => (
              <Text key={index} style={styles.termsLine}>
                {line}
              </Text>
            ))}

            {payment.length > 0 && (
              <>
                <Text style={[styles.boxTitle, { marginTop: 9 }]}>Payment details</Text>
                {payment.map((line, index) => (
                  <Text key={index} style={styles.termsLine}>
                    {line}
                  </Text>
                ))}
              </>
            )}
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sub-total</Text>
              <Text style={styles.totalValue}>{money(invoice.subtotalMinor)}</Text>
            </View>

            {invoice.discountMinor > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Discount
                  {invoice.discountKind === 'percentage' ? ` (${invoice.discountValue}%)` : ''}
                </Text>
                <Text style={styles.totalValue}>-{money(invoice.discountMinor)}</Text>
              </View>
            )}

            {invoice.vatRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>VAT ({invoice.vatRate}%)</Text>
                <Text style={styles.totalValue}>{money(invoice.vatMinor)}</Text>
              </View>
            )}

            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandValue}>
                {invoice.currency} {money(invoice.totalMinor)}
              </Text>
            </View>

            {invoice.amountPaidMinor > 0 && (
              <>
                <View style={[styles.totalRow, { marginTop: 5 }]}>
                  <Text style={styles.totalLabel}>Amount paid</Text>
                  <Text style={styles.totalValue}>{money(invoice.amountPaidMinor)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { fontWeight: 'bold' }]}>Balance due</Text>
                  <Text style={[styles.totalValue, { fontSize: 10 }]}>
                    {money(invoice.balanceMinor)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {invoice.notes && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.boxTitle}>Notes</Text>
            <Text style={styles.termsLine}>{invoice.notes}</Text>
          </View>
        )}

        <PageFooter settings={settings} reference={`Invoice ${invoice.invoiceNumber}`} />
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------ work report */

export function WorkReportPdf({
  report,
  settings,
}: {
  report: WorkReport;
  settings: SiteSettings;
}) {
  registerFonts();
  const money = (minor: number) => Money.fromMinor(minor, report.currency).formatPlain();

  const stateColours: Record<string, { backgroundColor: string; color: string }> = {
    fully_paid: { backgroundColor: '#e3f4ea', color: '#1f7a48' },
    part_payment: { backgroundColor: '#fdf1dc', color: '#8a5d10' },
    unpaid: { backgroundColor: '#fbe7e6', color: '#a6322b' },
  };

  const stateLabels: Record<string, string> = {
    fully_paid: 'FULLY PAID',
    part_payment: 'PART PAYMENT RECEIVED',
    unpaid: 'PAYMENT OUTSTANDING',
  };

  const section = (number: number, heading: string, paragraphs: string[]) => (
    <View wrap={false}>
      <Text style={styles.sectionHeading}>
        {number}. {heading}
      </Text>
      {paragraphs
        .join('\n')
        .split('\n')
        .filter(Boolean)
        .map((line, index) => (
          <Text key={index} style={styles.body}>
            {line}
          </Text>
        ))}
    </View>
  );

  return (
    <Document
      title={`Work report ${report.reportNumber}`}
      author={settings.companyName}
      subject={`Work completion and payment report for ${report.clientName}`}
    >
      <Page size="A4" style={styles.page}>
        <Letterhead
          settings={settings}
          title="REPORT"
          subtitle="Work Completion and Payment"
        />

        <Text style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 2 }}>{report.title}</Text>
        <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 12 }}>
          {report.serviceCategory}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Report No.</Text>
            <Text style={styles.metaValue}>{report.reportNumber}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Client Name</Text>
            <Text style={styles.metaValue}>{report.clientName}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date of Work</Text>
            <Text style={styles.metaValue}>{longDate(report.dateOfWork)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Service Category</Text>
            <Text style={styles.metaValue}>{report.serviceCategory}</Text>
          </View>
        </View>

        <View style={styles.thinRule} />

        {section(1, 'Introduction', [report.introduction])}
        {section(2, 'Description of Work Performed', [report.workPerformed])}

        <View wrap={false}>
          <Text style={styles.sectionHeading}>3. Cost and Payment Breakdown</Text>

          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>
              Amount ({report.currency})
            </Text>
          </View>

          {report.costLines.map((line, index) => (
            <View key={line.id} style={[styles.tr, index % 2 === 1 ? styles.trAlt : {}]}>
              <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.td, { width: 110, textAlign: 'right' }]}>
                {money(line.amountMinor)}
              </Text>
            </View>
          ))}

          {[
            ['Total Cost of Work', report.totalCostMinor, true],
            ['Total Amount Paid', report.totalPaidMinor, false],
            ['Outstanding Balance', report.outstandingMinor, true],
          ].map(([label, value, bold]) => (
            <View key={label as string} style={[styles.tr, { backgroundColor: '#f4f5f7' }]}>
              <Text style={[styles.td, styles.colDesc, { fontWeight: bold ? 'bold' : 'normal' }]}>
                {label as string}
              </Text>
              <Text
                style={[
                  styles.td,
                  { width: 110, textAlign: 'right', fontWeight: bold ? 'bold' : 'normal' },
                ]}
              >
                {money(value as number)}
              </Text>
            </View>
          ))}
        </View>

        {section(4, 'Payment Confirmation', [report.paymentNote])}

        <Text
          style={[styles.statusChip, stateColours[report.paymentState] ?? stateColours.unpaid!]}
        >
          Payment Status: {stateLabels[report.paymentState] ?? 'UNKNOWN'}
        </Text>

        {section(5, 'Work Completion Confirmation', [report.completionNote])}
        {section(6, 'Appreciation', [report.appreciation])}

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signCell}>
            <Text style={styles.signLabel}>Prepared by</Text>
            <Text style={[styles.metaValue, { marginBottom: 6 }]}>{report.preparedBy}</Text>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Authorised Representative</Text>
          </View>
          <View style={styles.signCell}>
            <Text style={styles.signLabel}>Date of Report</Text>
            <Text style={[styles.metaValue, { marginBottom: 6 }]}>{longDate(report.reportDate)}</Text>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Signature</Text>
          </View>
        </View>

        <PageFooter settings={settings} reference={`Report ${report.reportNumber}`} />
      </Page>
    </Document>
  );
}


/* -------------------------------------------------------------- proposal */

/**
 * A proposal reads as a letter first and a price list second, which is the
 * order a client reads it in. The salutation, the opening and the closing
 * frame a scope table that is grouped by section when the office has used
 * sections, and optional items are listed apart from the headline figure so
 * that adding one stays a decision rather than a surprise.
 */
export function ProposalPdf({
  proposal,
  settings,
}: {
  proposal: Proposal;
  settings: SiteSettings;
}) {
  registerFonts();
  const money = (minor: number) => Money.fromMinor(minor, proposal.currency).formatPlain();

  const totals = calculateProposalTotals({
    items: proposal.items,
    currency: proposal.currency,
    discountKind: proposal.discountKind,
    discountValue: proposal.discountValue,
    vatRate: proposal.vatRate,
  });

  const included = proposal.items.filter((item) => !item.isOptional);
  const optional = proposal.items.filter((item) => item.isOptional);

  // Items keep their given order; a section heading is printed the first time
  // it appears, so the office controls grouping purely through the ordering.
  const rows: { kind: 'section' | 'item'; key: string; value: string; item?: (typeof included)[number] }[] = [];
  let currentSection: string | null = null;
  included.forEach((item, index) => {
    if (item.section && item.section !== currentSection) {
      currentSection = item.section;
      rows.push({ kind: 'section', key: `s-${index}`, value: item.section });
    }
    rows.push({ kind: 'item', key: item.id, value: item.title, item });
  });

  const paragraphsOf = (value: string) =>
    value
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

  return (
    <Document
      title={`Proposal ${proposal.proposalNumber}`}
      author={settings.companyName}
      subject={`${proposal.title} for ${proposal.clientName}`}
    >
      <Page size="A4" style={styles.page}>
        <Letterhead settings={settings} title="PROPOSAL" subtitle={proposal.proposalNumber} />

        <View style={styles.metaRow}>
          <View style={{ flexGrow: 2, flexBasis: 0 }}>
            <Text style={styles.metaLabel}>Prepared for</Text>
            <Text style={[styles.metaValue, { fontSize: 11 }]}>
              {proposal.clientCompany || proposal.clientName}
            </Text>
            {proposal.clientCompany && <Text style={styles.metaText}>{proposal.clientName}</Text>}
            {proposal.clientAddress && <Text style={styles.metaText}>{proposal.clientAddress}</Text>}
            {proposal.clientPhone && <Text style={styles.metaText}>{proposal.clientPhone}</Text>}
            {proposal.clientEmail && <Text style={styles.metaText}>{proposal.clientEmail}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{longDate(proposal.issuedOn)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Valid until</Text>
            <Text style={styles.metaValue}>
              {proposal.validUntil ? longDate(proposal.validUntil) : 'On request'}
            </Text>
          </View>
        </View>

        <View style={styles.thinRule} />

        <Text style={{ fontSize: 15, lineHeight: 1.25, fontWeight: 'bold', marginBottom: 10 }}>
          {proposal.title}
        </Text>

        <Text style={[styles.body, { marginBottom: 8 }]}>{proposal.salutation},</Text>
        {paragraphsOf(proposal.introduction).map((block, index) => (
          <Text key={index} style={styles.body}>
            {block}
          </Text>
        ))}

        {proposal.scopeIntro.trim().length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Scope of works</Text>
            {paragraphsOf(proposal.scopeIntro).map((block, index) => (
              <Text key={index} style={styles.body}>
                {block}
              </Text>
            ))}
          </>
        )}

        <View style={{ marginTop: 10 }}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colDesc]}>Item</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
            <Text style={[styles.th, styles.colTotal]}>Amount GHC</Text>
          </View>

          {rows.map((row, index) =>
            row.kind === 'section' ? (
              <View key={row.key} style={[styles.tr, { backgroundColor: GOLD_LIGHT }]} wrap={false}>
                <Text style={[styles.td, { fontWeight: 'bold', fontSize: 8 }]}>
                  {row.value.toUpperCase()}
                </Text>
              </View>
            ) : (
              <View
                key={row.key}
                style={[styles.tr, index % 2 === 1 ? styles.trAlt : {}]}
                wrap={false}
              >
                <View style={styles.colDesc}>
                  <Text style={[styles.td, { fontWeight: 'bold' }]}>{row.item!.title}</Text>
                  {row.item!.description.length > 0 && (
                    <Text style={[styles.td, { color: MUTED, fontSize: 7.8 }]}>
                      {row.item!.description}
                    </Text>
                  )}
                </View>
                <Text style={[styles.td, styles.colQty]}>
                  {Number.isInteger(row.item!.quantity)
                    ? row.item!.quantity
                    : row.item!.quantity.toFixed(2)}
                </Text>
                <Text style={[styles.td, styles.colPrice]}>{money(row.item!.unitPriceMinor)}</Text>
                <Text style={[styles.td, styles.colTotal, { fontWeight: 'bold' }]}>
                  {money(row.item!.lineTotalMinor)}
                </Text>
              </View>
            ),
          )}
        </View>

        <View style={styles.footerRow} wrap={false}>
          <View style={styles.termsBox}>
            <Text style={styles.boxTitle}>Payment terms</Text>
            {proposal.paymentTerms
              .split('\n')
              .filter(Boolean)
              .map((line, index) => (
                <Text key={index} style={styles.termsLine}>
                  {line}
                </Text>
              ))}

            <Text style={[styles.boxTitle, { marginTop: 9 }]}>Terms and conditions</Text>
            {proposal.termsText
              .split('\n')
              .filter(Boolean)
              .map((line, index) => (
                <Text key={index} style={styles.termsLine}>
                  {line}
                </Text>
              ))}
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sub-total</Text>
              <Text style={styles.totalValue}>{money(totals.subtotal.minorUnits)}</Text>
            </View>

            {!totals.discount.isZero() && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Discount
                  {proposal.discountKind === 'percentage' ? ` (${proposal.discountValue}%)` : ''}
                </Text>
                <Text style={styles.totalValue}>-{money(totals.discount.minorUnits)}</Text>
              </View>
            )}

            {!totals.vat.isZero() && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>VAT ({proposal.vatRate}%)</Text>
                <Text style={styles.totalValue}>{money(totals.vat.minorUnits)}</Text>
              </View>
            )}

            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandValue}>
                {proposal.currency} {money(totals.total.minorUnits)}
              </Text>
            </View>

            {optional.length > 0 && (
              <Text style={[styles.termsLine, { marginTop: 6, textAlign: 'right' }]}>
                Optional extras below are not included in this total.
              </Text>
            )}
          </View>
        </View>

        {optional.length > 0 && (
          <View wrap={false}>
            <Text style={styles.sectionHeading}>Optional extras</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colDesc]}>Item</Text>
              <Text style={[styles.th, styles.colTotal]}>Amount GHC</Text>
            </View>
            {optional.map((item, index) => (
              <View key={item.id} style={[styles.tr, index % 2 === 1 ? styles.trAlt : {}]}>
                <View style={styles.colDesc}>
                  <Text style={[styles.td, { fontWeight: 'bold' }]}>{item.title}</Text>
                  {item.description.length > 0 && (
                    <Text style={[styles.td, { color: MUTED, fontSize: 7.8 }]}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Text style={[styles.td, styles.colTotal, { fontWeight: 'bold' }]}>
                  {money(item.lineTotalMinor)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {paragraphsOf(proposal.closing).length > 0 && (
          <View style={{ marginTop: 16 }} wrap={false}>
            {paragraphsOf(proposal.closing).map((block, index) => (
              <Text key={index} style={styles.body}>
                {block}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signCell}>
            {/* Fixed height so both signature rules land on the same line,
                whether or not a job title is set. */}
            <View style={{ height: 30 }}>
              <Text style={styles.signLabel}>Prepared by</Text>
              <Text style={[styles.metaValue, { marginBottom: 1 }]}>{proposal.preparedBy}</Text>
              {proposal.preparedByRole && (
                <Text style={styles.signLabel}>{proposal.preparedByRole}</Text>
              )}
            </View>
            <View style={[styles.signLine, { marginTop: 14 }]} />
            <Text style={styles.signLabel}>Signature</Text>
          </View>
          <View style={styles.signCell}>
            <View style={{ height: 30 }}>
              <Text style={styles.signLabel}>Accepted for and on behalf of</Text>
              <Text style={[styles.metaValue, { marginBottom: 1 }]}>
                {proposal.clientCompany || proposal.clientName}
              </Text>
            </View>
            <View style={[styles.signLine, { marginTop: 14 }]} />
            <Text style={styles.signLabel}>Signature and date</Text>
          </View>
        </View>

        <PageFooter settings={settings} reference={`Proposal ${proposal.proposalNumber}`} />
      </Page>
    </Document>
  );
}
