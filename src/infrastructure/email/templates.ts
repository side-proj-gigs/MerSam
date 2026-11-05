import type { InvoiceRecord, Lead, Proposal, SiteSettings, WorkReport } from '@core/entities';
import { Money } from '@core/value-objects/money';

/**
 * Email templates are written as table-based HTML with inline styles, because
 * that is the only thing every mail client agrees on. There is no flexbox, no
 * grid, and no external stylesheet: Outlook ignores all three.
 *
 * Every message also ships a plain text alternative. Some clients prefer it,
 * some people insist on it, and spam filters treat its absence as a signal.
 */

const GOLD = '#8a671c';
const GOLD_LIGHT = '#c9a227';
const INK = '#10141b';
const MUTED = '#5b6068';
const BORDER = '#e6eaf1';
const SURFACE = '#f5f7fa';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Turns stored copy into paragraphs, escaping as it goes. */
function paragraphs(text: string, colour = INK): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${colour};">${escapeHtml(
          block,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');
}

export interface Branding {
  companyName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  siteUrl: string;
  signature: string | null;
}

/**
 * The city and the country are usually already typed into the address lines,
 * so a plain join reads "Kanda, Accra, Ghana, Accra, Ghana". Anything already
 * spelled out earlier in the address is dropped.
 */
function joinAddress(parts: readonly (string | null | undefined)[]): string {
  const kept: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    if (kept.join(', ').toLowerCase().includes(value.toLowerCase())) continue;
    kept.push(value);
  }
  return kept.join(', ');
}

export function brandingFrom(settings: SiteSettings, siteUrl: string): Branding {
  return {
    companyName: settings.companyName,
    tagline: settings.tagline,
    phone: settings.primaryPhone,
    email: settings.primaryEmail,
    address: joinAddress([...settings.addressLines, settings.city, settings.country]),
    siteUrl,
    signature: settings.emailSignature,
  };
}

interface ShellOptions {
  branding: Branding;
  preheader: string;
  heading: string;
  body: string;
  callToAction?: { label: string; href: string };
}

/** The frame every message shares: gold rule, content, contact footer. */
function shell({ branding, preheader, heading, body, callToAction }: ShellOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">

        <tr><td style="height:4px;background:${GOLD};line-height:4px;font-size:0;">&nbsp;</td></tr>

        <tr><td style="padding:26px 30px 6px;">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:${GOLD};letter-spacing:-0.4px;">${escapeHtml(branding.companyName)}</p>
          <p style="margin:3px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">Water Engineering</p>
        </td></tr>

        <tr><td style="padding:18px 30px 0;">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;color:${INK};font-weight:normal;">${escapeHtml(heading)}</h1>
        </td></tr>

        <tr><td style="padding:0 30px;font-family:Helvetica,Arial,sans-serif;">
          ${body}
        </td></tr>

        ${
          callToAction
            ? `<tr><td style="padding:10px 30px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${GOLD};border-radius:9px;">
              <a href="${escapeHtml(callToAction.href)}" style="display:inline-block;padding:12px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(callToAction.label)}</a>
            </td>
          </tr></table>
        </td></tr>`
            : ''
        }

        ${
          branding.signature
            ? `<tr><td style="padding:16px 30px 0;font-family:Helvetica,Arial,sans-serif;">
          ${paragraphs(branding.signature, MUTED)}
        </td></tr>`
            : ''
        }

        <tr><td style="padding:24px 30px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};">
            <tr><td style="padding-top:16px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">
              <strong style="color:${INK};">${escapeHtml(branding.companyName)}</strong><br />
              ${escapeHtml(branding.address)}<br />
              <a href="tel:${escapeHtml(branding.phone.replace(/\s/g, ''))}" style="color:${GOLD_LIGHT};text-decoration:none;">${escapeHtml(branding.phone)}</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:${escapeHtml(branding.email)}" style="color:${GOLD_LIGHT};text-decoration:none;">${escapeHtml(branding.email)}</a>
              &nbsp;&middot;&nbsp;
              <a href="${escapeHtml(branding.siteUrl)}" style="color:${GOLD_LIGHT};text-decoration:none;">${escapeHtml(branding.siteUrl.replace(/^https?:\/\//, ''))}</a>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A two column figure table, used for totals on money-bearing messages. */
function figures(rows: { label: string; value: string; strong?: boolean }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid ${BORDER};border-radius:10px;">
    ${rows
      .map(
        (row, index) => `<tr>
      <td style="padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${
        row.strong ? INK : MUTED
      };${row.strong ? 'font-weight:bold;' : ''}${index > 0 ? `border-top:1px solid ${BORDER};` : ''}">${escapeHtml(row.label)}</td>
      <td align="right" style="padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:${
        row.strong ? '16px' : '14px'
      };color:${row.strong ? GOLD : INK};font-weight:bold;${index > 0 ? `border-top:1px solid ${BORDER};` : ''}">${escapeHtml(row.value)}</td>
    </tr>`,
      )
      .join('')}
  </table>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* ------------------------------------------------- enquiry confirmation */

export function enquiryConfirmationEmail(lead: Lead, branding: Branding): RenderedEmail {
  const firstName = lead.fullName.split(/\s+/)[0] ?? lead.fullName;
  const urgent = lead.urgency === 'emergency' || lead.urgency === 'urgent';

  const body = `
    ${paragraphs(
      `Hello ${firstName},\n\nThank you for getting in touch with ${branding.companyName}. We have your enquiry and one of our engineers will call you back${
        urgent ? ' as a priority, given you marked this as urgent' : ''
      }.`,
    )}
    ${figures([
      { label: 'Your reference', value: lead.reference, strong: true },
      { label: 'Service', value: lead.serviceName ?? 'To be confirmed' },
      { label: 'We will call', value: lead.phone },
    ])}
    <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">What you told us</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;background:${SURFACE};border-radius:10px;">
      <tr><td style="padding:14px 16px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${INK};">${escapeHtml(
        lead.message,
      ).replace(/\n/g, '<br />')}</td></tr>
    </table>
    ${paragraphs(
      urgent
        ? `If this cannot wait, call us directly on ${branding.phone}. The line is staffed around the clock for emergencies.`
        : `If anything changes in the meantime, reply to this message or call us on ${branding.phone}.`,
      MUTED,
    )}`;

  const text = [
    `Hello ${firstName},`,
    '',
    `Thank you for getting in touch with ${branding.companyName}. We have your enquiry and one of our engineers will call you back.`,
    '',
    `Your reference: ${lead.reference}`,
    `Service: ${lead.serviceName ?? 'To be confirmed'}`,
    `We will call: ${lead.phone}`,
    '',
    'What you told us:',
    lead.message,
    '',
    `If anything changes, reply to this message or call ${branding.phone}.`,
    '',
    branding.companyName,
    branding.address,
  ].join('\n');

  return {
    subject: `We have your enquiry, ${lead.reference}`,
    html: shell({
      branding,
      preheader: `Your reference is ${lead.reference}. An engineer will call you back.`,
      heading: 'Thank you, we have your enquiry',
      body,
    }),
    text,
  };
}

/* ------------------------------------------------------ lead notification */

export function leadNotificationEmail(lead: Lead, branding: Branding): RenderedEmail {
  const body = `
    ${paragraphs(`A new enquiry came in through the website.`)}
    ${figures([
      { label: 'Reference', value: lead.reference },
      { label: 'Name', value: lead.fullName },
      { label: 'Phone', value: lead.phone },
      { label: 'Email', value: lead.email ?? 'Not given' },
      { label: 'Location', value: lead.location || 'Not given' },
      { label: 'Service', value: lead.serviceName ?? 'Not specified' },
      { label: 'Urgency', value: lead.urgency.replace(/_/g, ' '), strong: true },
    ])}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;background:${SURFACE};border-radius:10px;">
      <tr><td style="padding:14px 16px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${INK};">${escapeHtml(
        lead.message,
      ).replace(/\n/g, '<br />')}</td></tr>
    </table>`;

  return {
    subject: `New enquiry ${lead.reference} from ${lead.fullName}`,
    html: shell({
      branding,
      preheader: `${lead.fullName}, ${lead.phone}, ${lead.serviceName ?? 'service not specified'}`,
      heading: 'New enquiry from the website',
      body,
      callToAction: { label: 'Open in the dashboard', href: `${branding.siteUrl}/admin/enquiries` },
    }),
    text: [
      'A new enquiry came in through the website.',
      '',
      `Reference: ${lead.reference}`,
      `Name: ${lead.fullName}`,
      `Phone: ${lead.phone}`,
      `Email: ${lead.email ?? 'Not given'}`,
      `Service: ${lead.serviceName ?? 'Not specified'}`,
      `Urgency: ${lead.urgency.replace(/_/g, ' ')}`,
      '',
      lead.message,
      '',
      `${branding.siteUrl}/admin/enquiries`,
    ].join('\n'),
  };
}

/* ------------------------------------------------------------- invoice */

export function invoiceEmail(
  invoice: InvoiceRecord,
  branding: Branding,
  note: string,
): RenderedEmail {
  const money = (minor: number) => Money.fromMinor(minor, invoice.currency).format();
  const settled = invoice.balanceMinor === 0;

  const body = `
    ${paragraphs(
      note ||
        `Dear ${invoice.customerName},\n\nPlease find invoice ${invoice.invoiceNumber} attached as a PDF.`,
    )}
    ${figures([
      { label: 'Invoice number', value: invoice.invoiceNumber },
      { label: 'Date of issue', value: invoice.issuedOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ...(invoice.dueOn
        ? [{ label: 'Payment due', value: invoice.dueOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }]
        : []),
      { label: settled ? 'Total, settled in full' : 'Balance due', value: money(settled ? invoice.totalMinor : invoice.balanceMinor), strong: true },
    ])}
    ${
      invoice.paymentDetails
        ? `<p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">How to pay</p>
    ${paragraphs(invoice.paymentDetails, MUTED)}`
        : ''
    }
    ${paragraphs(`Any questions about this invoice, reply to this message or call ${branding.phone}.`, MUTED)}`;

  return {
    subject: `Invoice ${invoice.invoiceNumber} from ${branding.companyName}`,
    html: shell({
      branding,
      preheader: settled
        ? `Invoice ${invoice.invoiceNumber}, settled in full.`
        : `Invoice ${invoice.invoiceNumber}, ${money(invoice.balanceMinor)} due.`,
      heading: `Invoice ${invoice.invoiceNumber}`,
      body,
    }),
    text: [
      note || `Dear ${invoice.customerName},`,
      '',
      `Please find invoice ${invoice.invoiceNumber} attached.`,
      '',
      `Invoice number: ${invoice.invoiceNumber}`,
      settled
        ? `Total, settled in full: ${money(invoice.totalMinor)}`
        : `Balance due: ${money(invoice.balanceMinor)}`,
      '',
      invoice.paymentDetails,
      '',
      `Questions? Call ${branding.phone}.`,
      '',
      branding.companyName,
    ].join('\n'),
  };
}

/* --------------------------------------------------------- work report */

export function workReportEmail(
  report: WorkReport,
  branding: Branding,
  note: string,
): RenderedEmail {
  const money = (minor: number) => Money.fromMinor(minor, report.currency).format();
  const settled = report.outstandingMinor === 0;

  const body = `
    ${paragraphs(
      note ||
        `Dear ${report.clientName},\n\nPlease find the completion and payment report for the work carried out on ${report.dateOfWork.toLocaleDateString(
          'en-GB',
          { day: 'numeric', month: 'long', year: 'numeric' },
        )} attached as a PDF.`,
    )}
    ${figures([
      { label: 'Report number', value: report.reportNumber },
      { label: 'Service', value: report.serviceCategory },
      { label: 'Total cost of work', value: money(report.totalCostMinor) },
      { label: 'Amount received', value: money(report.totalPaidMinor) },
      {
        label: settled ? 'Account settled in full' : 'Outstanding balance',
        value: settled ? money(0) : money(report.outstandingMinor),
        strong: true,
      },
    ])}
    ${paragraphs(`Thank you for choosing ${branding.companyName}.`, MUTED)}`;

  return {
    subject: `Work completion report ${report.reportNumber}`,
    html: shell({
      branding,
      preheader: `${report.serviceCategory}, ${settled ? 'settled in full' : `${money(report.outstandingMinor)} outstanding`}.`,
      heading: report.title,
      body,
    }),
    text: [
      note || `Dear ${report.clientName},`,
      '',
      `Please find report ${report.reportNumber} attached.`,
      '',
      `Service: ${report.serviceCategory}`,
      `Total cost of work: ${money(report.totalCostMinor)}`,
      `Amount received: ${money(report.totalPaidMinor)}`,
      settled ? 'Account settled in full.' : `Outstanding balance: ${money(report.outstandingMinor)}`,
      '',
      `Thank you for choosing ${branding.companyName}.`,
    ].join('\n'),
  };
}

/* ------------------------------------------------------------ proposal */

export function proposalEmail(
  proposal: Proposal,
  branding: Branding,
  note: string,
): RenderedEmail {
  const money = (minor: number) => Money.fromMinor(minor, proposal.currency).format();

  // Quoted beside the total rather than inside it, so the headline figure in
  // the inbox is the same one printed on the PDF.
  const optionalMinor = proposal.items
    .filter((item) => item.isOptional)
    .reduce((sum, item) => sum + item.lineTotalMinor, 0);

  const body = `
    ${paragraphs(
      note ||
        `${proposal.salutation},\n\nThank you for the opportunity to quote. Our proposal, ${proposal.title}, is attached as a PDF and the headline figures are below.`,
    )}
    ${figures([
      { label: 'Proposal number', value: proposal.proposalNumber },
      { label: 'Prepared for', value: proposal.clientCompany ?? proposal.clientName },
      ...(proposal.validUntil
        ? [
            {
              label: 'Valid until',
              value: proposal.validUntil.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            },
          ]
        : []),
      { label: 'Total', value: money(proposal.totalMinor), strong: true },
      ...(optionalMinor > 0
        ? [{ label: 'Optional extras, priced separately', value: money(optionalMinor) }]
        : []),
    ])}
    ${
      proposal.paymentTerms
        ? `<p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Payment terms</p>
    ${paragraphs(proposal.paymentTerms, MUTED)}`
        : ''
    }
    ${paragraphs(
      `To go ahead, reply to this message or call us on ${branding.phone}. We are happy to walk through any part of it with you first.`,
      MUTED,
    )}`;

  return {
    subject: `Proposal ${proposal.proposalNumber}, ${proposal.title}`,
    html: shell({
      branding,
      preheader: `${proposal.title}, ${money(proposal.totalMinor)}.`,
      heading: proposal.title,
      body,
    }),
    text: [
      note || `${proposal.salutation},`,
      '',
      `Our proposal for ${proposal.title} is attached.`,
      '',
      `Proposal number: ${proposal.proposalNumber}`,
      `Total: ${money(proposal.totalMinor)}`,
      ...(optionalMinor > 0 ? [`Optional extras, priced separately: ${money(optionalMinor)}`] : []),
      ...(proposal.validUntil
        ? [`Valid until: ${proposal.validUntil.toLocaleDateString('en-GB')}`]
        : []),
      '',
      proposal.paymentTerms,
      '',
      `To go ahead, reply to this message or call ${branding.phone}.`,
      '',
      branding.companyName,
    ].join('\n'),
  };
}

/* ---------------------------------------------------------------- test */

export function testEmail(branding: Branding): RenderedEmail {
  return {
    subject: `Email is working for ${branding.companyName}`,
    html: shell({
      branding,
      preheader: 'Your email configuration is working.',
      heading: 'Email is working',
      body: paragraphs(
        'This is a test from your dashboard. If you are reading it, invoices, reports, proposals and enquiry confirmations will all send correctly.',
      ),
    }),
    text: `This is a test from your ${branding.companyName} dashboard. If you are reading it, email is configured correctly.`,
  };
}
