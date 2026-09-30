// src/app/en/page.tsx — /en → HomeView. M2 kabuğu (§15.3.1 #6); M3'te bölümler ve metadata bağlanır.
import { notFound } from 'next/navigation';
import { getSite } from '@/lib/content';
import { HomeView } from '@/views/home/HomeView';

export default function Page() {
  if (!getSite().locales.includes('en')) notFound();
  return <HomeView locale="en" />;
}
