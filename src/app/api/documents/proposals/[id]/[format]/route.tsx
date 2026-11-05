import React from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { NotFoundError, ValidationError } from '@core/errors';
import { contentDeps, repositories } from '@infra/deps';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { buildProposalDocx } from '@infra/documents/docx';
import { ProposalPdf } from '@infra/documents/pdf';
import { route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const GET = route(
  async (request: Request, context: { params: Promise<{ id: string; format: string }> }) => {
    await requirePrincipal('viewer');
    const { id: rawId, format } = await context.params;
    const id = uuidSchema.parse(rawId);

    if (format !== 'pdf' && format !== 'docx') {
      throw new ValidationError('Proposals can be downloaded as pdf or docx');
    }

    const proposal = await repositories().proposals.findById(id);
    if (!proposal) throw new NotFoundError('Proposal', id);
    const settings = await getSiteSettings(contentDeps());

    const safeNumber = proposal.proposalNumber.replace(/\//g, '-');
    const filename = `MerSam-Proposal-${safeNumber}.${format}`;
    const body =
      format === 'pdf'
        ? await renderToBuffer(<ProposalPdf proposal={proposal} settings={settings} />)
        : await buildProposalDocx(proposal, settings);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': format === 'pdf' ? 'application/pdf' : DOCX_TYPE,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `${format === 'pdf' ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
);
