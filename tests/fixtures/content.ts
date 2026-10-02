// tests/fixtures/content.ts — birim testleri için küçük içerik fixture'ı (§11.8.1, §13.2.1).
// `vi.mock('content-collections', () => import('…/tests/fixtures/content'))` ile bağlanır: erişimciler
// (src/lib/content/index.ts) gerçek kodla bu veri üzerinde koşar; sahibin içerik PR'ları testleri etkilemez.
// İçerir: çift dilli proje (cift-dilli), yalnız TR proje (yalniz-tr: title.en var, summary.en yok), noindex proje
// (gizli), sayfalı/sayfasız alanlar, web-only / pdf-only CV kayıtları. Varyantlar testte nesne üzerinde değiştirilir
// ve `resetFixture()` ile geri alınır.
import type {
  Area,
  AreaBody,
  Contact,
  CvAwards,
  CvCertifications,
  CvEducation,
  CvExperience,
  CvLanguages,
  CvPublications,
  CvSkills,
  Home,
  PageBody,
  Person,
  Project,
  Site,
  Testimonials,
} from 'content-collections';

const meta = (filePath: string) => ({
  filePath,
  fileName: filePath.split('/').at(-1) ?? filePath,
  directory: '.',
  extension: filePath.split('.').at(-1) ?? '',
  path: filePath.replace(/\.[^.]+$/, ''),
});
const img = (src: string, width: number, height: number, alt = 'Ekran görüntüsü') => ({
  src,
  alt: { tr: alt, en: 'Screenshot' },
  width,
  height,
  bytes: 1000,
  dominant: '#9aa1b2',
});
const desc = (tr: string, en: string) => ({ description: { tr, en } });

function build() {
  const site: Site = {
    locales: ['tr', 'en'],
    persona: 'engineer',
    title: { tr: 'Orçun Saatçi', en: 'Orçun Saatçi' },
    description: { tr: 'Site açıklaması (TR).', en: 'Site description (EN).' },
    features: {
      areaPages: true,
      publicationsPage: false,
      contactForm: false,
      testimonials: true,
      portraitOnHome: true,
    },
    cv: { updatedAt: '2026-09', photo: { tr: true, en: false } },
    seo: {
      pages: {
        home: desc('Ana sayfa açıklaması.', 'Home description.'),
        about: desc('Hakkımda açıklaması.', 'About description.'),
        cv: desc('Özgeçmiş açıklaması.', 'CV description.'),
        projects: desc('Projeler açıklaması.', 'Projects description.'),
        expertise: desc('Çalışma alanları açıklaması.', 'Expertise description.'),
        contact: desc('İletişim açıklaması.', 'Contact description.'),
        privacy: desc('Gizlilik açıklaması.', 'Privacy description.'),
      },
    },
    crawlers: { ai: 'allow' },
    _meta: meta('site.yaml'),
  };

  const person: Person = {
    name: 'Orçun Saatçi',
    givenName: 'Orçun',
    familyName: 'Saatçi',
    asciiName: 'Orcun Saatci',
    jobTitle: { tr: 'Bilgisayar Mühendisi', en: 'Computer Engineer' },
    headline: { tr: 'Mobil uygulamalar geliştiriyorum.', en: 'I build mobile apps.' },
    shortBio: { tr: 'Kısa biyografi.', en: 'Short bio.' },
    location: {
      city: { tr: 'İstanbul', en: 'Istanbul' },
      country: { tr: 'Türkiye', en: 'Türkiye' },
      countryCode: 'TR',
      timezone: 'Europe/Istanbul',
      remote: true,
    },
    careerStartYear: 2014,
    portrait: undefined,
    headshot: img('/media/test/headshot.jpg', 1200, 1200, 'Orçun Saatçi'),
    portraitWorking: undefined,
    knowsAbout: [{ tr: 'Kotlin', en: 'Kotlin' }],
    _meta: meta('person.yaml'),
  };

  const contact: Contact = {
    email: 'iletisim@orcunsaatci.com',
    responseTime: { tr: 'İki gün içinde yanıt veririm.', en: 'I reply within two days.' },
    availability: { status: 'open' },
    social: [
      { network: 'linkedin', url: 'https://www.linkedin.com/in/test', primary: true, sameAs: true },
      { network: 'github', url: 'https://github.com/test', primary: true, sameAs: true },
      { network: 'x', url: 'https://x.com/test', primary: false, sameAs: false },
    ],
    form: { topics: [] },
    _meta: meta('contact.yaml'),
  };

  const home: Home = {
    hero: {},
    about: {
      lede: { tr: 'Giriş.', en: 'Lede.' },
      paragraphs: [{ tr: 'Paragraf.', en: 'Paragraph.' }],
    },
    areas: { statement: { tr: 'Alanlar cümlesi.', en: 'Areas statement.' } },
    work: {},
    journey: {},
    testimonials: {},
    contact: {},
    seo: { noindex: false },
    _meta: meta('home.yaml'),
  };

  const area = (
    id: string,
    order: number,
    title: [string, string],
    hasPage: boolean,
    pageLocales: ('tr' | 'en')[],
  ): Area => ({
    id,
    order,
    title: { tr: title[0], en: title[1] },
    summary: { tr: `${title[0]} özeti.`, en: `${title[1]} summary.` },
    description: { tr: `${title[0]} açıklaması.`, en: `${title[1]} description.` },
    tags: [],
    capabilities: [{ tr: 'Yetenek', en: 'Capability' }],
    skills: ['kotlin'],
    hasPage,
    figure: 'list',
    pageLocales,
    seo: { noindex: false },
    _meta: meta(`${id}.yaml`),
  });
  const allAreas: Area[] = [
    area('mobil', 1, ['Mobil', 'Mobile'], true, ['tr', 'en']),
    area('web', 2, ['Web', 'Web'], false, []),
    area('arastirma', 3, ['Araştırma', 'Research'], true, ['tr']),
  ];

  const body = (areaId: string, locale: 'tr' | 'en'): AreaBody => ({
    draft: false,
    content: '## Başlık\n\nMetin.',
    lede: undefined,
    seoTitle: undefined,
    seoDescription: undefined,
    updatedAt: undefined,
    areaId,
    locale,
    media: {},
    mdx: '',
    _meta: meta(`${areaId}.${locale}.mdx`),
  });
  const allAreaBodies: AreaBody[] = [
    body('mobil', 'tr'),
    body('mobil', 'en'),
    body('arastirma', 'tr'),
  ];

  const page = (key: 'about' | 'privacy', locale: 'tr' | 'en', updatedAt?: string): PageBody => ({
    draft: false,
    content: '## Başlık\n\nMetin.',
    lede: undefined,
    seoTitle: undefined,
    seoDescription: undefined,
    updatedAt,
    key,
    locale,
    media: {},
    mdx: '',
    _meta: meta(`${key}.${locale}.mdx`),
  });
  const allPageBodies: PageBody[] = [
    page('about', 'tr', '2026-08'),
    page('about', 'en'),
    page('privacy', 'tr', '2026-09-01'),
    page('privacy', 'en'),
  ];

  const project = (
    p: Partial<Project> & Pick<Project, 'slug' | 'title' | 'summary' | 'locales' | 'areas'>,
  ): Project => ({
    start: '2024-03',
    end: undefined,
    role: { tr: 'Geliştirici', en: 'Developer' },
    kind: 'personal',
    status: 'live',
    featured: true,
    order: 100,
    facts: [],
    links: [],
    cover: img(`/media/test/${p.slug}-cover.jpg`, 2400, 1500),
    mobileCover: undefined,
    preview: undefined,
    plateTint: undefined,
    gallery: [],
    draft: false,
    publishedAt: '2025-01',
    updatedAt: undefined,
    seo: { noindex: false },
    primaryArea: p.areas[0] as string,
    year: 2026,
    _meta: meta(`${p.slug}/project.yaml`),
    ...p,
  });
  const allProjects: Project[] = [
    project({
      slug: 'cift-dilli',
      title: { tr: 'Çift Dilli', en: 'Bilingual' },
      summary: { tr: 'Çift dilli proje.', en: 'Bilingual project.' },
      locales: ['tr', 'en'],
      areas: ['mobil'],
      order: 1,
      updatedAt: '2025-06',
      links: [
        { kind: 'live', url: 'https://apps.apple.com/app/id1', label: { tr: 'App Store' } },
        {
          kind: 'video',
          url: 'https://youtu.be/test',
          label: { tr: 'Tanıtım videosu', en: 'Demo video' },
        },
      ],
    }),
    project({
      slug: 'yalniz-tr',
      title: { tr: 'Yalnız TR', en: 'Title only' },
      summary: { tr: 'Yalnız Türkçe proje.' },
      locales: ['tr'],
      areas: ['mobil', 'web'],
      order: 2,
      start: '2022-01',
      end: '2023-06',
      year: 2023,
    }),
    project({
      slug: 'ikinci',
      title: { tr: 'İkinci', en: 'Second' },
      summary: { tr: 'İkinci proje.', en: 'Second project.' },
      locales: ['tr', 'en'],
      areas: ['mobil'],
      order: 3,
      start: '2020-05',
      end: '2021-02',
      year: 2021,
    }),
    project({
      slug: 'gizli',
      title: { tr: 'Gizli', en: 'Hidden' },
      summary: { tr: 'Noindex proje.', en: 'Noindex project.' },
      locales: ['tr', 'en'],
      areas: ['web'],
      featured: false,
      seo: { noindex: true },
    }),
  ];

  const cvExperience: CvExperience = {
    items: [
      {
        id: 'guncel',
        organization: 'Acme',
        organizationUrl: 'https://acme.example.com',
        role: { tr: 'Kıdemli Mobil Geliştirici', en: 'Senior Mobile Developer' },
        employmentType: 'full-time',
        location: { tr: 'İstanbul', en: 'Istanbul' },
        remote: false,
        period: { start: '2023-01' },
        summary: { tr: 'Güncel iş.', en: 'Current job.' },
        highlights: { tr: ['Sonuç 1'], en: ['Result 1'] },
        skills: ['kotlin'],
        projects: ['cift-dilli', 'yalniz-tr'],
        visibility: 'web-and-pdf',
        showOnHome: true,
      },
      {
        id: 'eski',
        organization: 'Beta',
        role: { tr: 'Mobil Geliştirici', en: 'Mobile Developer' },
        employmentType: 'contract',
        remote: true,
        period: { start: '2019-05', end: '2022-12' },
        summary: { tr: 'Eski iş.' },
        highlights: { tr: [] },
        skills: [],
        projects: [],
        visibility: 'web-only',
        showOnHome: true,
      },
      {
        id: 'pdf',
        organization: 'Gamma',
        role: { tr: 'Stajyer', en: 'Intern' },
        employmentType: 'internship',
        remote: false,
        period: { start: '2014-06', end: '2014-09' },
        summary: { tr: 'Staj.', en: 'Internship.' },
        highlights: { tr: [] },
        skills: [],
        projects: [],
        visibility: 'pdf-only',
        showOnHome: false,
      },
    ],
    _meta: meta('experience.yaml'),
  };
  const cvEducation: CvEducation = {
    items: [
      {
        id: 'lisans',
        institution: 'Test Üniversitesi',
        institutionUrl: 'https://uni.example.com',
        degree: { tr: 'Lisans', en: 'BSc' },
        field: { tr: 'Bilgisayar Mühendisliği', en: 'Computer Engineering' },
        period: { start: '2010', end: '2014' },
        courses: [],
        visibility: 'web-and-pdf',
        showOnHome: true,
      },
    ],
    _meta: meta('education.yaml'),
  };
  const cvCertifications: CvCertifications = {
    items: [
      {
        id: 'sertifika',
        name: { tr: 'Sertifika', en: 'Certificate' },
        issuer: 'Google',
        date: '2024-05',
        url: 'https://example.com/cert',
        visibility: 'web-and-pdf',
      },
      {
        id: 'eski-sertifika',
        name: { tr: 'Eski' },
        issuer: 'Oracle',
        date: '2018',
        visibility: 'hidden',
      },
    ],
    _meta: meta('certifications.yaml'),
  };
  const cvAwards: CvAwards = {
    items: [
      {
        id: 'odul',
        title: { tr: 'Ödül', en: 'Award' },
        awarder: 'Jüri',
        date: '2025-11',
        project: 'cift-dilli',
        featured: true,
        visibility: 'web-and-pdf',
      },
    ],
    _meta: meta('awards.yaml'),
  };
  const cvPublications: CvPublications = {
    items: [
      {
        id: 'konusma',
        type: 'talk',
        title: { tr: 'Konuşma', en: 'Talk' },
        venue: 'Konferans',
        date: '2025-04',
        coAuthors: [],
        featured: false,
        visibility: 'web-and-pdf',
      },
      {
        id: 'makale',
        type: 'article',
        title: { tr: 'Makale', en: 'Article' },
        venue: 'Dergi',
        date: '2023-02',
        url: 'https://example.com/article',
        coAuthors: ['Ayşe Yılmaz'],
        featured: false,
        visibility: 'web-and-pdf',
      },
    ],
    _meta: meta('publications.yaml'),
  };
  const cvSkills: CvSkills = {
    items: [
      {
        id: 'kotlin',
        name: { tr: 'Kotlin' },
        category: 'core',
        level: 'expert',
        years: 8,
        areas: ['mobil'],
        featured: true,
      },
      {
        id: 'swift',
        name: { tr: 'Swift' },
        category: 'core',
        level: 'advanced',
        areas: ['mobil'],
        featured: false,
      },
      { id: 'figma', name: { tr: 'Figma' }, category: 'tool', areas: [], featured: false },
    ],
    _meta: meta('skills.yaml'),
  };
  const cvLanguages: CvLanguages = {
    items: [
      { code: 'en', name: { tr: 'İngilizce', en: 'English' }, level: 'c1' },
      { code: 'tr', name: { tr: 'Türkçe', en: 'Turkish' }, level: 'native' },
    ],
    _meta: meta('languages.yaml'),
  };
  const testimonials: Testimonials = {
    items: [
      {
        id: 'referans',
        quote: { tr: 'Harika bir iş çıkardı.', en: 'Did a great job.' },
        quoteOriginalLocale: 'tr',
        author: 'Ayşe Yılmaz',
        role: { tr: 'Ürün Müdürü', en: 'Product Manager' },
        avatar: undefined,
        project: 'cift-dilli',
        consent: true,
        consentDate: '2025-01',
        featured: true,
      },
    ],
    _meta: meta('testimonials.yaml'),
  };

  return {
    site,
    person,
    contact,
    home,
    allAreas,
    allAreaBodies,
    allPageBodies,
    allProjects,
    cvExperience,
    cvEducation,
    cvCertifications,
    cvAwards,
    cvPublications,
    cvSkills,
    cvLanguages,
    testimonials,
  };
}

const fixture = build();
export const {
  site,
  person,
  contact,
  home,
  allAreas,
  allAreaBodies,
  allPageBodies,
  allProjects,
  cvExperience,
  cvEducation,
  cvCertifications,
  cvAwards,
  cvPublications,
  cvSkills,
  cvLanguages,
  testimonials,
} = fixture;

/** Testin değiştirdiği nesneleri yerinde ilk hâline döndürür (erişimciler aynı referansları okur). */
export function resetFixture(): void {
  const fresh = build();
  for (const key of Object.keys(fresh) as (keyof typeof fresh)[]) {
    const target = fixture[key];
    const source = fresh[key];
    if (Array.isArray(target) && Array.isArray(source))
      target.splice(0, target.length, ...(source as never[]));
    else Object.assign(target, source);
  }
}
