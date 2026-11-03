'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileDown, FileText, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkReport } from '@core/entities';
import { api } from '@/lib/api-client';
import { Button, ButtonLink } from '@/components/ui/button';

export function ReportActions({ report }: { report: WorkReport }) {
  const router = useRouter();

  const issue = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/work-reports/${report.id}/issue`, {}, { idempotent: false }),
    onSuccess: () => {
      toast.success(`Report ${report.reportNumber} issued`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink
        href={`/api/documents/reports/${report.id}/pdf`}
        target="_blank"
        variant="outline"
        size="sm"
        leadingIcon={<FileText className="size-4" aria-hidden />}
      >
        PDF
      </ButtonLink>

      <ButtonLink
        href={`/api/documents/reports/${report.id}/docx`}
        variant="outline"
        size="sm"
        leadingIcon={<FileDown className="size-4" aria-hidden />}
      >
        Word
      </ButtonLink>

      {report.status !== 'archived' && (
        <ButtonLink
          href={`/admin/reports/${report.id}/edit`}
          variant="secondary"
          size="sm"
          leadingIcon={<Pencil className="size-4" aria-hidden />}
        >
          Edit
        </ButtonLink>
      )}

      {report.status === 'draft' && (
        <Button
          size="sm"
          variant="gold"
          loading={issue.isPending}
          onClick={() => issue.mutate()}
          leadingIcon={<CheckCircle2 className="size-4" aria-hidden />}
        >
          Issue report
        </Button>
      )}
    </div>
  );
}
