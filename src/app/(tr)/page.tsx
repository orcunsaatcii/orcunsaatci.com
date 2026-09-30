// src/app/(tr)/page.tsx — / → HomeView. M2 kabuğu (§15.3.1 #6); M3'te bölümler ve metadata bağlanır.
import { HomeView } from '@/views/home/HomeView';

export default function Page() {
  return <HomeView locale="tr" />;
}
