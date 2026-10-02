// src/lib/content/kod.ts — içerikten KOD program verisi (§4 KOD). Saf: girdileri index.ts toplar (döngüsel import yok).
// Yalnız içerikteki olgular kullanılır; çeviri yoksa TR'ye düşer (D-11).
import type { Area, Contact, Home, Person, Project } from 'content-collections';
import type { Locale } from '@/i18n/config';
import { lower } from '@/i18n/format';
import type { KodData, KodEntry, KodFigure } from '@/lib/kod/types';
import type { EducationItem, ExperienceItem } from './cv';

type LStr = { tr: string; en?: string };
const pick = (v: LStr | undefined, locale: Locale): string =>
  !v ? '' : locale === 'en' ? (v.en ?? v.tr) : v.tr;

/** "2024" | "2024-03" | "2024-03-15" → "2024-03" */
const ym = (d: string): string => (d.length >= 7 ? d.slice(0, 7) : `${d.slice(0, 4)}-01`);

/** Europe/Istanbul → "GMT+3" (Intl; desteklenmezse saat dilimi adı) */
function gmt(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date(Date.UTC(2026, 0, 15)))
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export interface KodInput {
  locale: Locale;
  person: Person;
  home: Home;
  contact: Contact;
  areas: readonly Area[];
  projects: readonly Project[];
  experience: readonly ExperienceItem[];
  education: readonly EducationItem[];
  defaultLead: string;
}

export function buildKodData(x: KodInput): KodData {
  const { locale, person } = x;
  const city = pick(person.location.city, locale);
  const current = x.experience.find((e) => !e.period.end);
  const now =
    pick(x.home.about.now, locale) ||
    (current ? `${current.organization} · ${pick(current.role, locale)}` : '');
  // git log en yeniden eskiye (§4.10.3); ref = DOM'daki deneyim girdisinin indeksi (journey:active eşlemesi)
  const journey: KodEntry[] = [
    ...x.experience.map((e, i) => ({
      date: ym(e.period.start),
      title: pick(e.role, locale),
      at: `@ ${e.organization}`,
      edu: false,
      current: !e.period.end,
      ref: i,
    })),
    ...x.education.map((e) => ({
      date: ym(e.period.start),
      title: `${pick(e.degree, locale)}, ${pick(e.field, locale)}`,
      at: `@ ${e.institution}`,
      edu: true,
      current: false,
      ref: -1,
    })),
  ]
    .map((e, k) => ({ e, k }))
    .sort((a, b) => (a.e.date === b.e.date ? a.k - b.k : a.e.date < b.e.date ? 1 : -1))
    .map(({ e }) => e);
  return {
    locale,
    name: person.name,
    varName:
      lower(person.asciiName.trim().split(/\s+/)[0] ?? '', 'en').replace(/[^a-z0-9_]/g, '') ||
      'dev',
    title: pick(person.jobTitle, locale),
    city,
    since: person.careerStartYear ?? null,
    now: now || null,
    skills: person.knowsAbout.map((k) => pick(k, locale)),
    areas: x.areas.map((a) => ({
      id: a.id,
      title: pick(a.title, locale),
      figure: (a.figure ?? 'list') as KodFigure,
      tags: a.tags.map((t) => pick(t, locale)),
      capabilities: a.capabilities.map((c) => pick(c, locale)),
    })),
    journey,
    email: x.contact.email,
    lead: pick(x.home.contact.lead, locale) || x.defaultLead,
    place: `${city} · ${gmt(person.location.timezone)}`,
    projects: x.projects.map((p) => ({
      slug: p.slug,
      title: pick(p.title, locale),
      year: String(p.year),
      role: pick(p.role, locale),
      status: p.status,
      areas: [...p.areas],
      facts: p.facts.map((f) => [pick(f.label, locale), pick(f.value, locale)] as const),
      stores: p.links.filter((l) => l.kind === 'live').map((l) => pick(l.label, locale)),
    })),
  };
}
