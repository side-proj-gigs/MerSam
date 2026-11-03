import type { Metadata } from 'next';
import { contentDeps } from '@infra/deps';
import { getSiteSettings, listPublishedProjects } from '@app-layer/use-cases/content';
import { Reveal } from '@/components/ui/motion';
import { CtaBand, ProjectCard } from '@/components/site/sections';
import { PageBanner } from '@/components/site/page-banner';
import { EmptyState } from '@/components/ui/primitives';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Community water schemes, reverse osmosis plants, residential boreholes and plumbing installations delivered by MerSam across Ghana.',
};

export default async function ProjectsPage() {
  const deps = contentDeps();
  const [settings, projects] = await Promise.all([
    getSiteSettings(deps),
    listPublishedProjects(deps, 36),
  ]);

  return (
    <>
      <PageBanner
        eyebrow="Our work"
        title="Jobs we are happy to be measured on"
        description="Every project here lists what was delivered and the figures it achieved. No vague claims, no stock photography of someone else's work."
        imageKey="siteAerial"
        breadcrumbs={[{ href: '/projects', label: 'Projects' }]}
      />

      <section className="container-page py-16 sm:py-20">
        {projects.length === 0 ? (
          <EmptyState
            title="No projects published yet"
            description="Completed work will appear here as it is added."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <Reveal key={project.id} delay={Math.min(index, 5) * 55}>
                <ProjectCard project={project} priority={index < 3} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <div className="pb-20 sm:pb-28">
        <CtaBand
          title="Your project could be the next one here"
          description="Tell us what you are planning and we will tell you honestly what it will take."
          phone={settings.primaryPhone}
        />
      </div>
    </>
  );
}
