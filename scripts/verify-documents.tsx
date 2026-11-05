import 'dotenv/config';
import React from 'react';
import { writeFileSync } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import { createRepositories } from '../src/infrastructure/repositories';
import { db, pool } from '../src/infrastructure/db/client';
import {
  buildInvoiceDocx,
  buildProposalDocx,
  buildWorkReportDocx,
} from '../src/infrastructure/documents/docx';
import { InvoicePdf, ProposalPdf, WorkReportPdf } from '../src/infrastructure/documents/pdf';

const OUT = process.argv[2] ?? '.';

async function main() {
  const repos = createRepositories(db);
  const settings = await repos.settings.get();

  const invoice = await repos.invoices.findByNumber('161026');
  if (!invoice) throw new Error('seed invoice 161026 not found');
  const report = await repos.workReports.findByNumber('MS/2026/001');
  if (!report) throw new Error('seed report MS/2026/001 not found');
  const proposal = await repos.proposals.findByNumber('PRO/2026/001');
  if (!proposal) throw new Error('sample proposal PRO/2026/001 not found, run scripts/seed-proposal.ts');

  const files: [string, Buffer][] = [
    ['invoice.pdf', await renderToBuffer(<InvoicePdf invoice={invoice} settings={settings} />)],
    ['invoice.docx', await buildInvoiceDocx(invoice, settings)],
    ['report.pdf', await renderToBuffer(<WorkReportPdf report={report} settings={settings} />)],
    ['report.docx', await buildWorkReportDocx(report, settings)],
    ['proposal.pdf', await renderToBuffer(<ProposalPdf proposal={proposal} settings={settings} />)],
    ['proposal.docx', await buildProposalDocx(proposal, settings)],
  ];

  for (const [name, buffer] of files) {
    writeFileSync(`${OUT}/${name}`, buffer);
    console.log(`${name.padEnd(14)} ${buffer.byteLength.toLocaleString()} bytes`);
  }

  console.log(`invoice total   ${invoice.totalMinor / 100}`);
  console.log(`report total    ${report.totalCostMinor / 100}  paid ${report.totalPaidMinor / 100}`);
  console.log(
    `proposal total  ${proposal.totalMinor / 100}  optional extras ${
      proposal.items.filter((item) => item.isOptional).reduce((sum, item) => sum + item.lineTotalMinor, 0) / 100
    }`,
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
