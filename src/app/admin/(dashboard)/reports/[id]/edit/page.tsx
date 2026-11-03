import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { repositories } from '@infra/deps';
import { PageHeader } from '@/components/admin/shell';
import { ReportEditor } from '@/components/admin/report-editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit work report' };

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await repositories().workReports.findById(id).catch(() => null);
  if (!report) notFound();
  if (report.status === 'archived') redirect(`/admin/reports/${id}`);

  return (
    <>
      <PageHeader
        title={`Edit report ${report.reportNumber}`}
        description={`${report.clientName}, ${report.serviceCategory}`}
      />
      <ReportEditor report={report} />
    </>
  );
}
