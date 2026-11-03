import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { NotFoundError, ValidationError } from '@core/errors';
import { contentDeps, repositories } from '@infra/deps';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { buildInvoiceDocx } from '@infra/documents/docx';
import { InvoicePdf } from '@infra/documents/pdf';
import { route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Rendering a long invoice is heavier than a normal request.
export const maxDuration = 60;

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const GET = route(
  async (request: Request, context: { params: Promise<{ id: string; format: string }> }) => {
    await requirePrincipal('viewer');
    const { id: rawId, format } = await context.params;
    const id = uuidSchema.parse(rawId);

    if (format !== 'pdf' && format !== 'docx') {
      throw new ValidationError('Invoices can be downloaded as pdf or docx');
    }

    const invoice = await repositories().invoices.findById(id);
    if (!invoice) throw new NotFoundError('Invoice', id);
    const settings = await getSiteSettings(contentDeps());

    const filename = `MerSam-Invoice-${invoice.invoiceNumber}.${format}`;
    const body =
      format === 'pdf'
        ? await renderToBuffer(<InvoicePdf invoice={invoice} settings={settings} />)
        : await buildInvoiceDocx(invoice, settings);

    // `inline` lets a PDF preview in the browser; Word always downloads.
    const disposition = format === 'pdf' ? 'inline' : 'attachment';

    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': format === 'pdf' ? 'application/pdf' : DOCX_TYPE,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
);
