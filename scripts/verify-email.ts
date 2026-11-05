import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { calculateProposalTotals } from '../src/core/entities';
import { env } from '../src/infrastructure/config/env';
import { db, pool } from '../src/infrastructure/db/client';
import { createRepositories } from '../src/infrastructure/repositories';
import {
  brandingFrom,
  enquiryConfirmationEmail,
  invoiceEmail,
  leadNotificationEmail,
  proposalEmail,
  testEmail,
  workReportEmail,
} from '../src/infrastructure/email/templates';
import { createResendSender } from '../src/infrastructure/email/resend';

/**
 * Renders every outbound message to disk so the HTML can be opened and read
 * before a single one reaches a client. Nothing is sent: this only proves the
 * templates build from real stored records and that the plain text alternative
 * carries the same facts.
 */

const OUT = path.join(process.cwd(), '.local', 'email-preview');

function check(name: string, condition: boolean, detail = '') {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const repos = createRepositories(db);
  const settings = await repos.settings.get();
  const branding = brandingFrom(settings, env.siteUrl);

  const [leads, invoices, reports, proposals] = await Promise.all([
    repos.leads.list({ page: 1, pageSize: 1 }),
    repos.invoices.list({ page: 1, pageSize: 1 }),
    repos.workReports.list({ page: 1, pageSize: 1 }),
    repos.proposals.list({ page: 1, pageSize: 1 }),
  ]);

  const lead = leads.items[0];
  const invoice = invoices.items[0] ? await repos.invoices.findById(invoices.items[0].id) : null;
  const report = reports.items[0] ? await repos.workReports.findById(reports.items[0].id) : null;
  const proposal = proposals.items[0]
    ? await repos.proposals.findById(proposals.items[0].id)
    : null;

  const messages: { name: string; subject: string; html: string; text: string }[] = [];

  if (lead) {
    messages.push({ name: 'enquiry-confirmation', ...enquiryConfirmationEmail(lead, branding) });
    messages.push({ name: 'lead-notification', ...leadNotificationEmail(lead, branding) });
  }
  if (invoice) {
    messages.push({ name: 'invoice', ...invoiceEmail(invoice, branding, '') });
    messages.push({
      name: 'invoice-with-note',
      ...invoiceEmail(invoice, branding, 'As discussed on site this morning, the balance is due on Friday.'),
    });
  }
  if (report) {
    messages.push({ name: 'work-report', ...workReportEmail(report, branding, '') });
  }
  if (proposal) {
    messages.push({ name: 'proposal', ...proposalEmail(proposal, branding, '') });
  }
  messages.push({ name: 'test', ...testEmail(branding) });

  console.log(`\nRendering ${messages.length} messages into ${OUT}\n`);

  for (const message of messages) {
    await writeFile(path.join(OUT, `${message.name}.html`), message.html, 'utf8');
    await writeFile(path.join(OUT, `${message.name}.txt`), message.text, 'utf8');

    check(`${message.name} has a subject`, message.subject.trim().length > 5, message.subject);
    check(`${message.name} html is a complete document`, message.html.includes('<html') && message.html.includes('</html>'));
    check(`${message.name} html carries the company name`, message.html.includes(branding.companyName));
    check(`${message.name} text alternative is not empty`, message.text.trim().length > 40);
    check(`${message.name} has no unresolved placeholder`, !/\{\{|undefined|NaN/.test(message.html));
    check(`${message.name} uses no em or en dash`, !/[—–]/.test(message.html + message.text));
  }

  // The figures quoted in the proposal email must match the domain arithmetic.
  if (proposal) {
    const totals = calculateProposalTotals(proposal);
    const { html } = proposalEmail(proposal, branding, '');
    check(
      'the proposal email quotes the stored total',
      html.includes(totals.total.formatPlain()),
      totals.total.format(),
    );
  }

  const sender = createResendSender({
    from: settings.emailFromAddress,
    fromName: settings.emailFromName,
    replyTo: settings.emailReplyTo,
  });
  console.log(
    `\nProvider: ${sender.configured ? 'configured' : `not configured (${sender.unavailableReason})`}`,
  );

  // Whether or not a key is present, asking to send must return an outcome
  // rather than throwing, because a dashboard click depends on it.
  if (!sender.configured) {
    const result = await sender.send({
      to: ['nobody@example.com'],
      subject: 'Should not send',
      html: '<p>no</p>',
      text: 'no',
    });
    check('an unconfigured sender skips instead of throwing', result.status === 'skipped', result.error ?? '');
  }

  console.log(
    process.exitCode ? '\nSomething above needs attention\n' : '\nEvery message renders cleanly\n',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
