// src/lib/content/schemas.ts: tüm içerik tiplerinin tek kaynağı (Zod 4)
// Bu dosya three/React/Next import ETMEZ; content-collections.ts, scripts/* ve testler kullanır.
import { z } from 'zod';

/* ───────────── ilkel tipler ───────────── */

export const LOCALES = ['tr', 'en'] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;

/** Kısa çevrilebilir metin. TR zorunlu, EN isteğe bağlı (D-11). */
export const L = z.strictObject({
  tr: z.string().trim().min(1),
  en: z.string().trim().min(1).optional(),
});
export type LocalizedString = z.infer<typeof L>;

/** Uzunluk sınırlı çevrilebilir metin (karakter). */
export const Lmax = (max: number) =>
  z.strictObject({
    tr: z.string().trim().min(1).max(max),
    en: z.string().trim().min(1).max(max).optional(),
  });

/** Çevrilebilir madde listesi (ör. CV başarıları). */
export const LList = (maxItems: number, maxLen: number) =>
  z.strictObject({
    tr: z.array(z.string().trim().min(1).max(maxLen)).max(maxItems),
    en: z.array(z.string().trim().min(1).max(maxLen)).max(maxItems).optional(),
  });

/** ASCII kebab-case, iki dilde aynı (D-10). */
export const Slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'slug: küçük harf ASCII kebab-case olmalı (ç ğ ı ö ş ü yok)',
  );

/** Kısmi ISO tarih: "2024" | "2024-03" | "2024-03-15" (JSON Resume iso8601 ile uyumlu). */
export const PartialDate = z
  .string()
  .regex(
    /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/,
    'tarih: YYYY | YYYY-MM | YYYY-MM-DD',
  );

export const DateRange = z
  .strictObject({
    start: PartialDate,
    end: PartialDate.optional(), // yoksa "Halen" / "Present"
  })
  .refine((r) => !r.end || r.end >= r.start, {
    message: 'end, start değerinden önce olamaz',
    path: ['end'],
  });

/** Proje tarihi: yalnızca "YYYY-MM" (D-48). */
export const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'tarih: YYYY-MM');

/** Yalnızca https bağlantılar. */
export const HttpsUrl = z.url({ protocol: /^https$/ });

/** /public altındaki raster görsel yolu: /media/<ascii-klasörler>/<ascii-ad>.<uzantı> */
export const IMAGE_PATH = /^\/media\/(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.(?:jpe?g|png)$/;
export const LOGO_PATH = /^\/media\/logos\/[a-z0-9][a-z0-9-]*\.svg$/;

/** İçerik görseli. width/height/dominant build sırasında eklenir (ImageAsset). */
export const ImageRef = z.strictObject({
  src: z
    .string()
    .regex(
      IMAGE_PATH,
      'görsel /public/media altında, ASCII küçük harf adla ve .jpg|.jpeg|.png olmalı',
    ),
  alt: Lmax(125), // dekoratif görseller içerik şemasına girmez; burada alt ZORUNLU
  caption: Lmax(200).optional(),
  focal: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(), // object-position x,y
});
export type ImageRefInput = z.infer<typeof ImageRef>;

/** Proje bağlantısı (D-48): mağaza sayfası (`live`) veya dış video (`video`, YouTube/Vimeo). Alan adı kuralları C07. */
export const Link = z.strictObject({
  label: Lmax(40), // live: mağaza adı ("App Store" | "Google Play" | "AppGallery"); video: ör. "Tanıtım videosu"
  url: HttpsUrl,
  kind: z.enum(['live', 'video']),
});

export const SeoFields = z
  .strictObject({
    title: Lmax(60).optional(), // <title> gövdesi; " — Orçun Saatçi" soneki otomatik (bkz. §11.2)
    description: Lmax(160).optional(),
    noindex: z.boolean().default(false),
  })
  .prefault({});

export const Visibility = z.enum(['web-and-pdf', 'web-only', 'pdf-only', 'hidden']);

/* ───────────── site ───────────── */

export const Persona = z.enum([
  'neutral',
  'engineer',
  'designer',
  'architect',
  'researcher',
  'manager',
]);
export type Persona = z.infer<typeof Persona>;

export const SiteConfig = z.strictObject({
  locales: z.union([z.tuple([z.literal('tr')]), z.tuple([z.literal('tr'), z.literal('en')])]),
  persona: Persona.default('engineer'), // D-35 → src/experience/profile.ts
  title: Lmax(60), // site adı: "Orçun Saatçi"
  description: Lmax(160), // varsayılan meta description (120–160 önerilir)
  features: z
    .strictObject({
      areaPages: z.boolean().default(false), // /calisma-alanlari/[area]
      publicationsPage: z.boolean().default(false), // v1: /cv sıralaması; ayrı sayfa v2 (§7.6.1)
      contactForm: z.boolean().default(false), // v1.1 (D-22)
      testimonials: z.boolean().default(false), // ana sayfa `testimonials` bölümü (D-43)
      portraitOnHome: z.boolean().default(true), // portre varsa about bölümünde gösterilir
    })
    .prefault({}),
  cv: z.strictObject({
    updatedAt: PartialDate, // "Son güncelleme"
    summary: Lmax(400).optional(), // CV'ye özel profil özeti; yoksa person.shortBio
    photo: z
      .strictObject({ tr: z.boolean().default(true), en: z.boolean().default(false) })
      .prefault({}), // PDF'te fotoğraf
  }),
  seo: z.strictObject({
    // §11.2.2–§11.2.3: statik sayfaların meta description'ları
    pages: z.strictObject({
      home: z.strictObject({ description: Lmax(160) }),
      about: z.strictObject({ description: Lmax(160) }),
      cv: z.strictObject({ description: Lmax(160) }),
      projects: z.strictObject({ description: Lmax(160) }),
      expertise: z.strictObject({ description: Lmax(160) }),
      contact: z.strictObject({ description: Lmax(160) }),
      privacy: z.strictObject({ description: Lmax(160) }),
    }),
  }),
  crawlers: z.strictObject({ ai: z.enum(['allow', 'block']).default('allow') }).prefault({}), // v1'de robots.ts okumaz (§11.4.3); 'block' kuralı Q-16 kararıyla eklenir
});
export type SiteConfig = z.infer<typeof SiteConfig>;

/* ───────────── kişi ───────────── */

export const Person = z.strictObject({
  name: z.string().min(1), // "Orçun Saatçi"
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  asciiName: z.string().regex(/^[A-Za-z .'-]+$/), // "Orcun Saatci" → JSON-LD alternateName
  pronunciation: z.string().max(60).optional(),
  jobTitle: Lmax(60), // hero eyebrow, JSON-LD jobTitle, OG (sahibin TR unvanı 52 karakter)
  headline: Lmax(120), // hero konumlandırma cümlesi (≤ 18 kelime: check-content uyarır)
  shortBio: Lmax(300), // ~50 kelime: meta/JSON-LD/CV özeti yedeği
  location: z.strictObject({
    city: Lmax(40),
    country: Lmax(40),
    fromPhrase: Lmax(60).optional(), // tam ifade, asla ek türetilmez: {tr: "İstanbul’dan", en: "Based in Istanbul"}
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default('TR'),
    timezone: z.string().min(1).default('Europe/Istanbul'), // LocalTime bileşeni
    remote: z.boolean().default(false),
  }),
  careerStartYear: z.number().int().min(1950).max(2100).optional(), // yoksa en eski deneyim yılı
  portrait: ImageRef.optional(), // 4:5
  headshot: ImageRef.optional(), // 1:1 (JSON-LD image, PDF fotoğrafı)
  portraitWorking: ImageRef.optional(), // 3:2
  knowsAbout: z.array(Lmax(60)).max(10).default([]),
});
export type Person = z.infer<typeof Person>;

/* ───────────── iletişim ───────────── */

export const SocialNetwork = z.enum([
  'linkedin',
  'github',
  'x',
  'instagram',
  'behance',
  'dribbble',
  'youtube',
  'vimeo',
  'medium',
  'orcid',
  'scholar',
  'researchgate',
  'mastodon',
  'bluesky',
  'threads',
  'website',
  'other',
]);

export const SocialLink = z
  .strictObject({
    network: SocialNetwork,
    url: HttpsUrl,
    handle: z.string().max(60).optional(), // "@orcunsaatci"
    label: Lmax(40).optional(), // network: other için ZORUNLU
    primary: z.boolean().default(false), // hero/footer/iletişim bölümünde gösterilir (en fazla 4)
    sameAs: z.boolean().default(true), // JSON-LD Person.sameAs
  })
  .refine((s) => s.network !== 'other' || s.label !== undefined, {
    message: 'network: other ise label zorunlu',
    path: ['label'],
  });

export const Contact = z.strictObject({
  email: z.email(), // tek yetkili kaynak (JSON-LD, CV, mailto)
  responseTime: Lmax(80).optional(), // "Genellikle 2 iş günü içinde yanıt veririm."
  availability: z
    .strictObject({
      status: z.enum(['open', 'limited', 'closed']),
      note: Lmax(120).optional(),
    })
    .optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'telefon E.164 biçiminde: +905xxxxxxxxx')
    .optional(), // yalnızca herkese açıksa
  social: z.array(SocialLink).max(12).default([]),
  form: z
    .strictObject({
      topics: z
        .array(z.strictObject({ id: Slug, label: Lmax(40) }))
        .max(6)
        .default([]), // v1.1
    })
    .prefault({}),
});
export type Contact = z.infer<typeof Contact>;

/* ───────────── ana sayfa metinleri ───────────── */
// Başlık/eyebrow varsayılanları persona etiketlerinden gelir (§4.17); `heading` verilirse onu ezer.

const ChapterHeading = Lmax(45).optional();

export const HomePage = z.strictObject({
  hero: z.strictObject({ eyebrow: Lmax(60).optional() }).prefault({}), // yoksa "{jobTitle} · {city}"
  about: z.strictObject({
    heading: ChapterHeading,
    lede: Lmax(160), // 3–5 satır, max 24ch
    paragraphs: z.array(Lmax(420)).min(1).max(2), // her biri ≤ 60 kelime
    now: Lmax(60).optional(), // "Şu an" olgusu; yoksa güncel deneyimden türetilir
  }),
  areas: z.strictObject({ heading: ChapterHeading, statement: Lmax(90) }),
  work: z.strictObject({ heading: ChapterHeading, intro: Lmax(120).optional() }).prefault({}),
  journey: z.strictObject({ heading: ChapterHeading, intro: Lmax(160).optional() }).prefault({}),
  testimonials: z.strictObject({ heading: ChapterHeading }).prefault({}),
  contact: z.strictObject({ heading: ChapterHeading, lead: Lmax(90).optional() }).prefault({}),
  seo: SeoFields,
});
export type HomePage = z.infer<typeof HomePage>;

/* ───────────── alanlar ve yetkinlikler ───────────── */

/** content/areas/<id>.yaml: id dosya adından türetilir. */
export const Area = z.strictObject({
  order: z.number().int().min(1).max(99), // benzersiz; artan sıra = dilim (sector) sırası k = 0…N−1
  title: Lmax(30),
  summary: Lmax(160), // ana sayfa kadran açıklaması (2–3 satır), kartlar
  description: Lmax(700), // /calisma-alanlari (60–100 kelime)
  tags: z.array(Lmax(24)).max(6).default([]), // mono çipler
  capabilities: z.array(Lmax(120)).max(8).default([]), // somut işler (fiyat/paket YOK, D-30)
  skills: z.array(Slug).default([]), // → Skill.id
  hasPage: z.boolean().default(false), // true → <id>.tr.mdx ZORUNLU; sayfa yalnız features.areaPages ile üretilir
  /** KOD diyagramı (§4 KOD): telefon, klasör ağacı, APP↔API, yayın hattı ya da yetkinlik listesi */
  figure: z.enum(['phone', 'tree', 'api', 'pipeline', 'list']).default('list'),
  seo: SeoFields,
});

export const Skill = z.strictObject({
  id: Slug,
  name: Lmax(40),
  category: z.enum(['core', 'tool', 'method', 'domain', 'soft']),
  level: z.enum(['expert', 'advanced', 'intermediate', 'familiar']).optional(), // yalnız sözcük; yüzde/çubuk YASAK
  years: z.number().int().min(0).max(60).optional(),
  areas: z.array(Slug).default([]), // → Area id
  featured: z.boolean().default(false),
});

/* ───────────── CV ───────────── */

export const Experience = z.strictObject({
  id: Slug,
  organization: z.string().min(1), // özel ad, çevrilmez
  organizationUrl: HttpsUrl.optional(),
  logo: z.string().regex(LOGO_PATH).optional(), // yazılı izinle
  role: Lmax(80),
  employmentType: z.enum([
    'full-time',
    'part-time',
    'contract',
    'freelance',
    'internship',
    'volunteer',
    'founder',
  ]),
  location: Lmax(60).optional(),
  remote: z.boolean().default(false),
  period: DateRange,
  summary: Lmax(400),
  highlights: LList(5, 180), // fiille başlar, mümkünse sayı içerir
  skills: z.array(Slug).default([]), // → Skill.id
  projects: z.array(Slug).default([]), // → proje slug
  visibility: Visibility.default('web-and-pdf'),
  showOnHome: z.boolean().default(true), // ana sayfa journey (en yeni 6)
});

export const Education = z.strictObject({
  id: Slug,
  institution: z.string().min(1),
  institutionUrl: HttpsUrl.optional(),
  degree: Lmax(60), // "Lisans" / "BSc"
  field: Lmax(80),
  period: DateRange,
  grade: z.string().max(20).optional(),
  thesis: Lmax(200).optional(),
  courses: z.array(Lmax(80)).max(8).default([]),
  highlights: LList(3, 180).optional(),
  visibility: Visibility.default('web-and-pdf'),
  showOnHome: z.boolean().default(true),
});

export const Certification = z.strictObject({
  id: Slug,
  name: Lmax(120),
  issuer: z.string().min(1),
  date: PartialDate,
  expires: PartialDate.optional(),
  credentialId: z.string().max(80).optional(),
  url: HttpsUrl.optional(),
  visibility: Visibility.default('web-and-pdf'),
});

export const Award = z.strictObject({
  id: Slug,
  title: Lmax(120),
  awarder: z.string().min(1),
  date: PartialDate,
  summary: Lmax(200).optional(),
  project: Slug.optional(), // → proje slug
  url: HttpsUrl.optional(),
  featured: z.boolean().default(false),
  visibility: Visibility.default('web-and-pdf'),
});

export const Publication = z.strictObject({
  id: Slug,
  type: z.enum([
    'article',
    'paper',
    'book',
    'chapter',
    'talk',
    'podcast',
    'workshop',
    'interview',
    'exhibition',
  ]),
  title: Lmax(200),
  venue: z.string().min(1), // yayıncı / konferans / etkinlik
  date: PartialDate,
  location: Lmax(60).optional(),
  url: HttpsUrl.optional(),
  doi: z
    .string()
    .regex(/^10\.\d{4,9}\/\S+$/)
    .optional(),
  summary: Lmax(300).optional(),
  coAuthors: z.array(z.string().min(1)).default([]),
  featured: z.boolean().default(false),
  visibility: Visibility.default('web-and-pdf'),
});

export const Language = z.strictObject({
  code: z.string().regex(/^[a-z]{2,3}$/), // ISO 639-1/-3: "tr", "en"
  name: Lmax(40), // {tr: "İngilizce", en: "English"}
  level: z.enum(['native', 'c2', 'c1', 'b2', 'b1', 'a2', 'a1']),
});

/** CV YAML dosyaları: { items: [...] } */
export const Items = <T extends z.ZodType>(item: T) =>
  z.strictObject({ items: z.array(item).default([]) });

/* ───────────── projeler (D-48: yalın proje sayfası; MDX gövdesi yok) ───────────── */

/** content/projects/<slug>/project.yaml: slug klasör adından türetilir. Proje sayfasının tek kaynağı. */
export const Project = z
  .strictObject({
    title: Lmax(60), // h1, kart, OG
    summary: Lmax(160), // hero, kart, meta description yedeği
    start: YearMonth, // "2023-04"
    end: YearMonth.optional(), // yoksa sürüyor: "Halen" / "Present"
    role: Lmax(60),
    kind: z
      .enum(['client', 'personal', 'research', 'oss', 'academic', 'product'])
      .default('client'),
    status: z.enum(['live', 'done', 'archived', 'ongoing', 'concept']).default('done'),
    areas: z.array(Slug).min(1).max(3), // areas[0] = birincil alan (sahnede dilim)
    featured: z.boolean().default(false), // ana sayfa work bölümü (P = 3–5)
    order: z.number().int().min(0).max(999).default(100), // küçük = önce
    facts: z
      .array(z.strictObject({ label: Lmax(24), value: Lmax(40) }))
      .max(4)
      .default([]), // künye: "Platform: iOS · Android"
    links: z.array(Link).max(4).default([]), // mağaza sayfaları + isteğe bağlı tek dış video (C07)
    cover: ImageRef, // 16:10, ≥ 2400×1500; ZORUNLU, sayfanın LCP görseli
    mobileCover: ImageRef.optional(), // 4:5, ≥ 1200×1500
    preview: ImageRef.optional(), // 4:3, ≥ 1200×900 (liste hover önizlemesi)
    plateTint: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(), // yalnız mockup plakası (§6.7); vurgu rengi DEĞİL
    gallery: z.array(ImageRef).max(12).default([]), // ekran görüntüleri; dikey telefon görüntüleri özgün oranında
    draft: z.boolean().default(false), // true → proje hiç üretilmez (§7.3.4 kural 4)
    publishedAt: PartialDate, // sayfanın yayına girdiği tarih (§3.4.2)
    updatedAt: PartialDate.optional(),
    seo: SeoFields,
  })
  .refine((p) => !p.end || p.end >= p.start, {
    message: 'end, start değerinden önce olamaz',
    path: ['end'],
  });
export type ProjectInput = z.infer<typeof Project>;

/* ───────────── MDX gövde frontmatter'ı (hakkımda, gizlilik, alan sayfası) ───────────── */

export const PageBodyFrontmatter = z.strictObject({
  draft: z.boolean().default(false),
  seoTitle: z.string().max(60).optional(),
  seoDescription: z.string().max(160).optional(),
  lede: z.string().max(200).optional(), // /hakkimda ve alan sayfası girişi
  updatedAt: PartialDate.optional(), // gizlilik: "Son güncelleme"
  content: z.string(),
});

/* ───────────── referanslar ───────────── */

export const Testimonial = z.strictObject({
  id: Slug,
  quote: Lmax(420),
  quoteOriginalLocale: Locale.default('tr'), // çeviri gösterilirse "Çeviri" etiketi
  author: z.string().min(1),
  role: Lmax(60),
  organization: z.string().optional(),
  avatar: ImageRef.optional(), // 1:1, ≥ 400×400, yazılı izinle
  project: Slug.optional(),
  url: HttpsUrl.optional(),
  consent: z.literal(true), // yazılı izin yoksa yayımlanamaz
  consentDate: PartialDate, // iznin alındığı tarih (kanıt kaydı sahibinde)
  featured: z.boolean().default(false),
  date: PartialDate.optional(),
});
