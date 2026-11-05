import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { repositories } from '@infra/deps';
import { PageHeader } from '@/components/admin/shell';
import { ProposalEditor } from '@/components/admin/proposal-editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit proposal' };

export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await repositories().proposals.findById(id).catch(() => null);
  if (!proposal) notFound();

  // A decided proposal is a record of what was agreed, not a draft.
  if (proposal.status === 'accepted' || proposal.status === 'declined') {
    redirect(`/admin/proposals/${id}`);
  }

  return (
    <>
      <PageHeader
        title={`Edit proposal ${proposal.proposalNumber}`}
        description={`${proposal.clientCompany ?? proposal.clientName}, ${proposal.title}`}
      />
      <ProposalEditor proposal={proposal} />
    </>
  );
}
