// src/app/en/expertise/[area]/page.tsx — M2 kabuğu (§15.3.1 #6): parametre listesi boş, sayfa üretilmez; M3'te §3.4.3 kalıbı.
import { notFound } from 'next/navigation';
import { getSite } from '@/lib/content';
import { AreaView } from '@/views/area/AreaView';

export const dynamicParams = false;

export function generateStaticParams(): { area: string }[] {
  return []; // M3: getAreaPageIds('en').map((id) => ({ area: id }))
}

export default async function Page({ params }: PageProps<'/en/expertise/[area]'>) {
  if (!getSite().locales.includes('en')) notFound();
  const { area } = await params;
  return <AreaView id={area} locale="en" />;
}
