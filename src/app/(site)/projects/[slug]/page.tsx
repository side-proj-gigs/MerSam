import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { repositories, contentDeps } from '@infra/deps';
import { getSiteSettings, listPublishedProjects } from '@app-layer/use-cases/content';
import { BLUR_DATA_URL } from '@/lib/media';
import { formatDate, paragraphs } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { Reveal } from '@/components/ui/motion';
import { PageBanner } from '@/components/site/page-banner';
import { CtaBand, ProjectCard, SectionHeading } from '@/components/site/sections';

export const revalidate = 300;

export async function generateStaticParams() {
  const projects = await listPublishedProjects(contentDeps(), 50);
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const project = await repositories().projects.findBySlug((await params).slug);
  if (!project) return { title: 'Project not found' };

  return {
    title: project.title,
    description: project.summary,
    openGraph: {
      title: project.title,
      description: project.summary,
      images: project.coverImageUrl ? [{ url: project.coverImageUrl }] : undefined,
    },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await repositories().projects.findBySlug(slug);
  if (!project || !project.isPublished) notFound();

  const deps = contentDeps();
  const [settings, projects] = await Promise.all([
    getSiteSettings(deps),
    listPublishedProjects(deps, 12),
  ]);

  const others = projects.filter((item) => item.id !== project.id).slice(0, 3);

  return (
    <>
      <PageBanner
        eyebrow={project.location}
        title={project.title}
        description={project.summary}
        imageUrl={project.coverImageUrl}
        breadcrumbs={[
          { href: '/projects', label: 'Projects' },
          { href: `/projects/${project.slug}`, label: project.title },
        ]}
      />

      {project.stats.length > 0 && (
        <section className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
          <dl className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
            {project.stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-display text-2xl font-semibold text-gradient-gold sm:text-3xl">
                  {stat.value}
                </dd>
                <dt className="mt-0.5 text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Reveal>
              <div className="space-y-4 text-base leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(project.body).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>
            </Reveal>

            {project.galleryUrls.length > 0 && (
              <Reveal delay={80}>
                <div className="mt-10 grid grid-cols-2 gap-3">
                  {project.galleryUrls.map((url, index) => (
                    <div
                      key={url}
                      className={`relative overflow-hidden rounded-xl ${
                        index % 3 === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/3]'
                      }`}
                    >
                      <Image
                        src={url}
                        alt={`${project.title}, photograph ${index + 1}`}
                        fill
                        sizes="(min-width: 1024px) 45vw, 46vw"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover transition-transform duration-700 hover:scale-[1.04]"
                      />
                    </div>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          <aside className="lg:col-span-4">
            <Reveal direction="left">
              <dl className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 lg:sticky lg:top-28">
                {[
                  { term: 'Client', value: project.client },
                  { term: 'Location', value: project.location },
                  {
                    term: 'Completed',
                    value: project.completedOn ? formatDate(project.completedOn, 'long') : 'In progress',
                  },
                ].map((row) => (
                  <div key={row.term} className="border-b border-[var(--border-subtle)] py-3 first:pt-0">
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      {row.term}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
                      {row.value || 'Not disclosed'}
                    </dd>
                  </div>
                ))}
                <div className="pt-3">
                  <dt className="sr-only">Status</dt>
                  <dd>
                    <Badge tone={project.status === 'completed' ? 'success' : 'warning'}>
                      {project.status}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </Reveal>
          </aside>
        </div>
      </section>

      {others.length > 0 && (
        <section className="container-page pb-16 sm:pb-20">
          <Reveal>
            <SectionHeading eyebrow="More work" title="Other projects" />
          </Reveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((item, index) => (
              <Reveal key={item.id} delay={index * 60}>
                <ProjectCard project={item} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <div className="pb-20 sm:pb-28">
        <CtaBand
          title="Start your own project"
          description="A survey, a clear price, and a crew that turns up when it said it would."
          phone={settings.primaryPhone}
        />
      </div>
    </>
  );
}
