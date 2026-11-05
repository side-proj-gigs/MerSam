import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/shell';
import { ProposalEditor } from '@/components/admin/proposal-editor';

export const metadata: Metadata = { title: 'New proposal' };

export default function NewProposalPage() {
  return (
    <>
      <PageHeader
        title="New proposal"
        description="A letter with a priced scope attached. The wording is written for you and stays yours to edit."
      />
      <ProposalEditor />
    </>
  );
}
