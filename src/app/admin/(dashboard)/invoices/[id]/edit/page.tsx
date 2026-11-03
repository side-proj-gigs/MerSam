import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { repositories } from '@infra/deps';
import { PageHeader } from '@/components/admin/shell';
import { InvoiceEditor } from '@/components/admin/invoice-editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit invoice' };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await repositories().invoices.findById(id).catch(() => null);
  if (!invoice) notFound();

  // A settled or void invoice is a record, not a draft; send them to the view.
  if (invoice.status === 'void' || invoice.status === 'paid') redirect(`/admin/invoices/${id}`);

  return (
    <>
      <PageHeader
        title={`Edit invoice ${invoice.invoiceNumber}`}
        description={`${invoice.customerName}. Totals recalculate as you change the lines.`}
      />
      <InvoiceEditor invoice={invoice} />
    </>
  );
}
