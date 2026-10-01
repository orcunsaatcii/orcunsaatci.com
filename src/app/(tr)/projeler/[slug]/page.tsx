// src/app/(tr)/projeler/[slug]/page.tsx — §3.4.3 kalıbı. getProjects('tr') yalnız bu dilde sayfası olan projeleri döndürür.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject, getProjects } from '@/lib/content';
import { projectMetadata } from '@/lib/seo/metadata';
import { ProjectView } from '@/views/project/ProjectView';
import { PageTransition } from '@/components/motion/PageTransition';

export const dynamicParams = false;

export function generateStaticParams() {
  return getProjects('tr').map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/projeler/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug, 'tr');
  return project ? projectMetadata(project, 'tr') : {};
}

export default async function Page({ params }: PageProps<'/projeler/[slug]'>) {
  const { slug } = await params;
  const project = getProject(slug, 'tr');
  if (!project) notFound();
  return (
    <PageTransition>
      <ProjectView project={project} locale="tr" />
    </PageTransition>
  ); // yalın proje sayfası, bölüm sırası §7.7.1 (D-48)
}
