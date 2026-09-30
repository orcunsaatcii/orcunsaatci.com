// src/app/(tr)/calisma-alanlari/[area]/page.tsx — §3.4.3 kalıbı. Liste features.areaPages kapalıysa ya da hasPage'li alan yoksa boştur (V-22).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAreaPage, getAreaPageIds } from '@/lib/content';
import { areaMetadata } from '@/lib/seo/metadata';
import { AreaView } from '@/views/area/AreaView';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAreaPageIds('tr').map((id) => ({ area: id }));
}

export async function generateMetadata({
  params,
}: PageProps<'/calisma-alanlari/[area]'>): Promise<Metadata> {
  const { area: id } = await params;
  const area = getAreaPage(id, 'tr');
  return area ? areaMetadata(area, 'tr') : {};
}

export default async function Page({ params }: PageProps<'/calisma-alanlari/[area]'>) {
  const { area: id } = await params;
  const area = getAreaPage(id, 'tr');
  if (!area) notFound();
  return <AreaView area={area} locale="tr" />;
}
