// src/app/en/projects/[slug]/page.tsx — M2 kabuğu (§15.3.1 #6): parametre listesi boş, sayfa üretilmez; M3'te §3.4.3 kalıbı.
import { notFound } from 'next/navigation';
import { getSite } from '@/lib/content';
import { ProjectView } from '@/views/project/ProjectView';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return []; // M3: getProjects('en').map((p) => ({ slug: p.slug }))
}

export default async function Page({ params }: PageProps<'/en/projects/[slug]'>) {
  if (!getSite().locales.includes('en')) notFound();
  const { slug } = await params;
  return <ProjectView slug={slug} locale="en" />;
}
