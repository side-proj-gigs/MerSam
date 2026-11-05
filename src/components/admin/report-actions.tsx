'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileDown, FileText, Mail, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkReport } from '@core/entities';
import { api } from '@/lib/api-client';
import { Button, ButtonLink } from '@/components/ui/button';
import { SendEmailDialog } from '@/components/admin/send-email-dialog';

export function ReportActions({
  report,
  clientEmail = null,
  lastSentAt,
}: {
  report: WorkReport;
  /** Looked up from the client record, so the address is usually prefilled. */
  clientEmail?: string | null;
  lastSentAt?: Date | string | null;
}) {
  const router = useRouter();
  const [emailing, setEmailing] = useState(false);

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
    <>
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

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setEmailing(true)}
          leadingIcon={<Mail className="size-4" aria-hidden />}
        >
          Email
        </Button>

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

      {emailing && (
        <SendEmailDialog
          endpoint={`/api/admin/work-reports/${report.id}/email`}
          documentLabel="Work report"
          reference={report.reportNumber}
          defaultTo={clientEmail}
          attachmentName={`Report-${report.reportNumber.replace(/\//g, '-')}.pdf`}
          lastSentAt={lastSentAt}
          onClose={() => setEmailing(false)}
        />
      )}
    </>
  );
}
