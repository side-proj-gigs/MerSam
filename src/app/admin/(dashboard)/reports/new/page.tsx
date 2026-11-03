import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/shell';
import { ReportEditor } from '@/components/admin/report-editor';

export const metadata: Metadata = { title: 'New work report' };

export default function NewReportPage() {
  return (
    <>
      <PageHeader
        title="New work report"
        description="The same numbered sections as the signed paper report, ready to hand to a client."
      />
      <ReportEditor />
    </>
  );
}
