// src/app/(tr)/projeler/[slug]/page.tsx — M2 kabuğu (§15.3.1 #6): parametre listesi boş, sayfa üretilmez; M3'te §3.4.3 kalıbı.
import { ProjectView } from '@/views/project/ProjectView';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return []; // M3: getProjects('tr').map((p) => ({ slug: p.slug }))
}

export default async function Page({ params }: PageProps<'/projeler/[slug]'>) {
  const { slug } = await params;
  return <ProjectView slug={slug} locale="tr" />;
}
