// src/app/en/expertise/[area]/page.tsx — §3.4.3 kalıbı. Liste features.areaPages kapalıysa ya da hasPage'li alan yoksa boştur (V-22).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAreaPage, getAreaPageIds } from '@/lib/content';
import { areaMetadata } from '@/lib/seo/metadata';
import { AreaView } from '@/views/area/AreaView';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAreaPageIds('en').map((id) => ({ area: id }));
}

export async function generateMetadata({
  params,
}: PageProps<'/en/expertise/[area]'>): Promise<Metadata> {
  const { area: id } = await params;
  const area = getAreaPage(id, 'en');
  return area ? areaMetadata(area, 'en') : {};
}

export default async function Page({ params }: PageProps<'/en/expertise/[area]'>) {
  const { area: id } = await params;
  const area = getAreaPage(id, 'en');
  if (!area) notFound();
  return <AreaView area={area} locale="en" />;
}
