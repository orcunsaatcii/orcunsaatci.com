// src/app/(tr)/not-found.tsx — notFound() çağrıları → NotFoundView (TR). Metadata export etmez (§3.7).
import { NotFoundView } from '@/views/not-found/NotFoundView';

export default function NotFound() {
  return <NotFoundView locale="tr" />;
}
