import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { NotFoundError } from '@core/errors';
import type { DocumentRenderer } from '@app-layer/ports';
import { createRepositories } from '../repositories';
import { db } from '../db/client';
import { InvoicePdf, ProposalPdf, WorkReportPdf } from './pdf';

/**
 * Turns a stored record into the bytes of its PDF.
 *
 * It exists so a use case that emails an invoice can ask for the attachment
 * without knowing anything about how a PDF is produced. The use case depends
 * on the port; this is the only place react-pdf is named.
 */

/** A filename a person would recognise in their downloads folder. */
function safeName(parts: string[], extension: string): string {
  return `${parts.map((part) => part.replace(/[^a-z0-9]+/gi, '-')).join('-')}.${extension}`;
}

export const documentRenderer: DocumentRenderer = {
  async invoicePdf(invoiceId) {
    const repos = createRepositories(db);
    const invoice = await repos.invoices.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice', invoiceId);

    const settings = await repos.settings.get();
    return {
      filename: safeName(['MerSam', 'Invoice', invoice.invoiceNumber], 'pdf'),
      content: await renderToBuffer(<InvoicePdf invoice={invoice} settings={settings} />),
    };
  },

  async workReportPdf(reportId) {
    const repos = createRepositories(db);
    const report = await repos.workReports.findById(reportId);
    if (!report) throw new NotFoundError('Work report', reportId);

    const settings = await repos.settings.get();
    return {
      filename: safeName(['MerSam', 'Work-Report', report.reportNumber], 'pdf'),
      content: await renderToBuffer(<WorkReportPdf report={report} settings={settings} />),
    };
  },

  async proposalPdf(proposalId) {
    const repos = createRepositories(db);
    const proposal = await repos.proposals.findById(proposalId);
    if (!proposal) throw new NotFoundError('Proposal', proposalId);

    const settings = await repos.settings.get();
    return {
      filename: safeName(['MerSam', 'Proposal', proposal.proposalNumber], 'pdf'),
      content: await renderToBuffer(<ProposalPdf proposal={proposal} settings={settings} />),
    };
  },
};
