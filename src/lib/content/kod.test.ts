// src/lib/content/kod.test.ts — içerikten KOD program verisi: dil seçimi ve TR'ye düşüş, tarih biçimi, yolculuk,
// mağazalar ve yer etiketi; yalnız içerikteki olgular (§5.20.2, §13.2.2, §4.1.2).
import { describe, expect, it } from 'vitest';
import { buildKodData, type KodInput } from './kod';

/* ───────── elle kurulmuş, en küçük girdi (content-collections tipleri; yalnız okunan alanlar) ───────── */

const person = {
  name: 'Orçun Saatçi',
  asciiName: 'Orcun Saatci',
  jobTitle: { tr: 'Mobil Geliştirici' }, // EN yok → TR'ye düşer
  location: { city: { tr: 'İstanbul', en: 'Istanbul' }, timezone: 'Europe/Istanbul' },
  careerStartYear: 2014,
  knowsAbout: [
    { tr: 'Flutter', en: 'Flutter' },
    { tr: 'Yazılım mimarisi', en: 'Software architecture' },
    { tr: 'Mağaza yayını' },
  ],
} as unknown as KodInput['person'];

const home = {
  about: { now: { tr: 'Acme’de mobil ekip', en: 'Mobile team at Acme' } },
  contact: { lead: { tr: 'Bir proje için yazın.', en: 'Write about a project.' } },
} as unknown as KodInput['home'];

const contact = { email: 'iletisim@example.com' } as unknown as KodInput['contact'];

const areas = [
  {
    id: 'mobil',
    title: { tr: 'Mobil', en: 'Mobile' },
    figure: 'phone',
    tags: [{ tr: 'iOS', en: 'iOS' }, { tr: 'Çapraz platform' }],
    capabilities: [{ tr: 'Uygulama geliştiriyorum.', en: 'I build apps.' }],
  },
  { id: 'notlar', title: { tr: 'Notlar' }, tags: [], capabilities: [] }, // figure yok → list
] as unknown as KodInput['areas'];

const projects = [
  {
    slug: 'kasa',
    title: { tr: 'Kasa', en: 'Till' },
    year: 2024,
    role: { tr: 'Geliştirici' },
    status: 'live',
    areas: ['mobil'],
    facts: [{ label: { tr: 'Platform', en: 'Platform' }, value: { tr: 'iOS · Android' } }],
    links: [
      { kind: 'live', url: 'https://apps.apple.com/app/id1', label: { tr: 'App Store' } },
      {
        kind: 'video',
        url: 'https://youtu.be/x',
        label: { tr: 'Tanıtım videosu', en: 'Demo video' },
      },
      { kind: 'live', url: 'https://play.google.com/store/apps', label: { tr: 'Google Play' } },
    ],
  },
] as unknown as KodInput['projects'];

const experience = [
  {
    organization: 'Acme',
    role: { tr: 'Kıdemli Geliştirici', en: 'Senior Developer' },
    period: { start: '2023-03' },
  },
  { organization: 'Beta', role: { tr: 'Geliştirici' }, period: { start: '2019', end: '2022-12' } },
] as unknown as KodInput['experience'];

const education = [
  {
    institution: 'Test Üniversitesi',
    degree: { tr: 'Lisans', en: 'BSc' },
    field: { tr: 'Bilgisayar Mühendisliği', en: 'Computer Engineering' },
    period: { start: '2010-09-01', end: '2014' },
  },
] as unknown as KodInput['education'];

const input = (over: Partial<KodInput> = {}): KodInput => ({
  locale: 'tr',
  person,
  home,
  contact,
  areas,
  projects,
  experience,
  education,
  defaultLead: 'Varsayılan çağrı.',
  ...over,
});

describe('buildKodData (§4 KOD, §5.20.2)', () => {
  it('TR: tüm olgular TR alanlarından', () => {
    expect(buildKodData(input())).toEqual({
      locale: 'tr',
      name: 'Orçun Saatçi',
      varName: 'orcun',
      title: 'Mobil Geliştirici',
      city: 'İstanbul',
      since: 2014,
      now: 'Acme’de mobil ekip',
      skills: ['Flutter', 'Yazılım mimarisi', 'Mağaza yayını'],
      areas: [
        {
          id: 'mobil',
          title: 'Mobil',
          figure: 'phone',
          tags: ['iOS', 'Çapraz platform'],
          capabilities: ['Uygulama geliştiriyorum.'],
        },
        { id: 'notlar', title: 'Notlar', figure: 'list', tags: [], capabilities: [] },
      ],
      journey: [
        {
          date: '2023-03',
          title: 'Kıdemli Geliştirici',
          at: '@ Acme',
          edu: false,
          current: true,
          ref: 0,
        },
        { date: '2019-01', title: 'Geliştirici', at: '@ Beta', edu: false, current: false, ref: 1 },
        {
          date: '2010-09',
          title: 'Lisans, Bilgisayar Mühendisliği',
          at: '@ Test Üniversitesi',
          edu: true,
          current: false,
          ref: -1,
        },
      ],
      email: 'iletisim@example.com',
      lead: 'Bir proje için yazın.',
      place: 'İstanbul · GMT+3',
      projects: [
        {
          slug: 'kasa',
          title: 'Kasa',
          year: '2024',
          role: 'Geliştirici',
          status: 'live',
          areas: ['mobil'],
          facts: [['Platform', 'iOS · Android']],
          stores: ['App Store', 'Google Play'],
        },
      ],
    });
  });

  it('EN: en alanını seçer, çeviri yoksa TR’ye düşer (D-11)', () => {
    const d = buildKodData(input({ locale: 'en' }));
    expect(d.locale).toBe('en');
    expect(d.title).toBe('Mobil Geliştirici'); // jobTitle.en yok
    expect(d.city).toBe('Istanbul');
    expect(d.skills).toEqual(['Flutter', 'Software architecture', 'Mağaza yayını']);
    expect(d.now).toBe('Mobile team at Acme');
    expect(d.lead).toBe('Write about a project.');
    expect(d.place).toBe('Istanbul · GMT+3');
    expect(d.areas.map((a) => [a.title, a.tags, a.capabilities])).toEqual([
      ['Mobile', ['iOS', 'Çapraz platform'], ['I build apps.']],
      ['Notlar', [], []],
    ]);
    expect(d.journey.map((e) => e.title)).toEqual([
      'Senior Developer',
      'Geliştirici',
      'BSc, Computer Engineering',
    ]);
    expect(d.projects[0]).toMatchObject({
      title: 'Till',
      role: 'Geliştirici',
      facts: [['Platform', 'iOS · Android']],
      stores: ['App Store', 'Google Play'],
    });
  });

  it('yolculuk: en yeniden eskiye; ref = DOM deneyim indeksi (eğitim −1); tarih YYYY-MM; süren deneyim current, eğitim edu', () => {
    const { journey } = buildKodData(input());
    expect(journey.map((e) => e.date)).toEqual(['2023-03', '2019-01', '2010-09']); // "2019" → "2019-01", gün atılır
    expect(journey.map((e) => [e.edu, e.current])).toEqual([
      [false, true],
      [false, false],
      [true, false],
    ]);
    expect(journey.every((e) => /^\d{4}-\d{2}$/.test(e.date))).toBe(true);
    const onlyEdu = buildKodData(input({ experience: [] }));
    expect(onlyEdu.journey).toHaveLength(1);
    expect(onlyEdu.journey[0]?.edu).toBe(true);
    // eğitim bitişsiz olsa da HEAD taşımaz; deneyimden yeniyse en üste sıralanır, ref'ler DOM sırasını korur
    const ongoing = buildKodData(
      input({
        education: [
          { ...education[0]!, period: { start: '2024-09' } },
        ] as unknown as KodInput['education'],
      }),
    );
    expect(ongoing.journey[0]).toMatchObject({
      date: '2024-09',
      edu: true,
      current: false,
      ref: -1,
    });
    expect(ongoing.journey.map((e) => e.ref)).toEqual([-1, 0, 1]);
  });

  it('varName: asciiName’in ilk sözcüğü, dil bağımsız küçük harf, yalnız [a-z0-9_]', () => {
    const v = (asciiName: string, locale: KodInput['locale'] = 'tr') =>
      buildKodData(
        input({ locale, person: { ...person, asciiName } as unknown as KodInput['person'] }),
      ).varName;
    expect(v('Orcun Saatci')).toBe('orcun');
    expect(v('IRMAK Yilmaz')).toBe('irmak'); // TR kuralıyla "ırmak" olurdu
    expect(v("D'Angelo Rossi")).toBe('dangelo');
    expect(v('Mary-Jane Watson', 'en')).toBe('maryjane');
  });

  it('mağazalar yalnız live bağlantılardan (video hariç), içerik sırasıyla', () => {
    const d = buildKodData(input());
    expect(d.projects[0]?.stores).toEqual(['App Store', 'Google Play']);
    const videoOnly = buildKodData(
      input({
        projects: [
          { ...projects[0]!, links: [projects[0]!.links[1]!] },
        ] as unknown as KodInput['projects'],
      }),
    );
    expect(videoOnly.projects[0]?.stores).toEqual([]);
  });

  it('yer etiketi: şehir · GMT ofseti; geçersiz saat diliminde dilim adı', () => {
    expect(buildKodData(input()).place).toBe('İstanbul · GMT+3');
    const tz = (timezone: string) =>
      buildKodData(
        input({
          person: {
            ...person,
            location: { ...person.location, timezone },
          } as unknown as KodInput['person'],
        }),
      ).place;
    expect(tz('Asia/Kolkata')).toBe('İstanbul · GMT+5:30');
    expect(tz('Mars/Olympus')).toBe('İstanbul · Mars/Olympus');
  });

  it('now: home.about.now yoksa kurum · güncel rol (§4.7.3); güncel rol de yoksa null', () => {
    const noNow = { ...home, about: {} } as unknown as KodInput['home'];
    expect(buildKodData(input({ home: noNow })).now).toBe('Acme · Kıdemli Geliştirici');
    expect(buildKodData(input({ home: noNow, locale: 'en' })).now).toBe('Acme · Senior Developer');
    const past = [experience[1]!] as unknown as KodInput['experience'];
    expect(buildKodData(input({ home: noNow, experience: past })).now).toBeNull();
  });

  it('içerikte olmayan olgu null ya da boş kalır: kariyer yılı, beceriler, lead yedeği', () => {
    const bare = {
      ...person,
      careerStartYear: undefined,
      knowsAbout: [],
    } as unknown as KodInput['person'];
    const d = buildKodData(
      input({
        person: bare,
        home: { ...home, contact: {} } as unknown as KodInput['home'],
        areas: [],
        projects: [],
        experience: [],
        education: [],
      }),
    );
    expect(d.since).toBeNull();
    expect(d.skills).toEqual([]);
    expect(d.areas).toEqual([]);
    expect(d.journey).toEqual([]);
    expect(d.projects).toEqual([]);
    expect(d.lead).toBe('Varsayılan çağrı.'); // persona etiketi (labels.contactLead)
  });
});
