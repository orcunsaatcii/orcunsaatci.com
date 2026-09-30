// src/app/(tr)/calisma-alanlari/[area]/page.tsx — M2 kabuğu (§15.3.1 #6): parametre listesi boş, sayfa üretilmez; M3'te §3.4.3 kalıbı.
import { AreaView } from '@/views/area/AreaView';

export const dynamicParams = false;

export function generateStaticParams(): { area: string }[] {
  return []; // M3: getAreaPageIds('tr').map((id) => ({ area: id }))
}

export default async function Page({ params }: PageProps<'/calisma-alanlari/[area]'>) {
  const { area } = await params;
  return <AreaView id={area} locale="tr" />;
}
