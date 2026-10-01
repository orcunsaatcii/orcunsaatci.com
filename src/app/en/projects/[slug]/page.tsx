// src/app/en/projects/[slug]/page.tsx — §3.4.3 kalıbı. getProjects('en') yalnız bu dilde sayfası olan projeleri döndürür.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject, getProjects } from '@/lib/content';
import { projectMetadata } from '@/lib/seo/metadata';
import { ProjectView } from '@/views/project/ProjectView';
import { PageTransition } from '@/components/motion/PageTransition';

export const dynamicParams = false;

export function generateStaticParams() {
  return getProjects('en').map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/en/projects/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug, 'en');
  return project ? projectMetadata(project, 'en') : {};
}

export default async function Page({ params }: PageProps<'/en/projects/[slug]'>) {
  const { slug } = await params;
  const project = getProject(slug, 'en');
  if (!project) notFound();
  return (
    <PageTransition>
      <ProjectView project={project} locale="en" />
    </PageTransition>
  ); // yalın proje sayfası, bölüm sırası §7.7.1 (D-48)
}
