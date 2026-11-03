import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { NotFoundError, ValidationError } from '@core/errors';
import { contentDeps, repositories } from '@infra/deps';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { buildWorkReportDocx } from '@infra/documents/docx';
import { WorkReportPdf } from '@infra/documents/pdf';
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
      throw new ValidationError('Reports can be downloaded as pdf or docx');
    }

    const report = await repositories().workReports.findById(id);
    if (!report) throw new NotFoundError('Work report', id);
    const settings = await getSiteSettings(contentDeps());

    const safeNumber = report.reportNumber.replace(/\//g, '-');
    const filename = `MerSam-Work-Report-${safeNumber}.${format}`;
    const body =
      format === 'pdf'
        ? await renderToBuffer(<WorkReportPdf report={report} settings={settings} />)
        : await buildWorkReportDocx(report, settings);

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
