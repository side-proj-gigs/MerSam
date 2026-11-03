import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/shell';
import { InvoiceEditor } from '@/components/admin/invoice-editor';

export const metadata: Metadata = { title: 'New invoice' };

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader
        title="New invoice"
        description="Materials and workmanship as separate lines, the way the office has always written them."
      />
      <InvoiceEditor />
    </>
  );
}
