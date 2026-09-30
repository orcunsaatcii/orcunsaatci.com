// src/i18n/dictionaries/error-text.ts — hata sınırı metinleri (§3.7). error.tsx istemci bileşenidir ve prop alamaz;
// sözlüğün tamamı istemciye gitmesin diye (§8.3 kural 2–3) bu küçük modül hem sözlüklerden hem error.tsx'ten kullanılır.
export const errorText = {
  tr: { title: 'Bir şeyler ters gitti', retry: 'Tekrar dene', home: 'Ana sayfaya dön' },
  en: { title: 'Something went wrong', retry: 'Try again', home: 'Back to home' },
};
