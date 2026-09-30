// scripts/cv-document.tsx — PDF CV belgesi (@react-pdf/renderer, §7.6.4 yerleşimi). Yalnız scripts/build-cv.tsx kullanır.
// A4, 14 mm kenar, tek sütun (ATS dostu). Vurgu rengi yok; renkler açık tema token'larından (ink, inkMuted, line).
// Bölüm sırası ve seçim selectCv('pdf')'ten gelir (web ile aynı sıra, §7.6.1); "Seçili projeler" yalnız burada çizilir.
import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { Fragment, type ReactNode } from 'react';
import { themeColors } from '../src/design/tokens';
import { getExperienceProfile } from '../src/experience/profile';
import { absoluteUrl, pathOf, type Locale } from '../src/i18n/config';
import { formatPartialDate, formatRange } from '../src/i18n/format';
import { duration, fill, plural } from '../src/i18n/text';
import { cvDictionary, pick, type CvSection, type CvSource } from '../src/lib/content/cv';

const BUILD_MONTH = new Date().toISOString().slice(0, 7); // süren kaydın süresi (build anı)

export interface CvDocumentProps {
  locale: Locale;
  sections: CvSection[];
  src: CvSource;
  /** sharp ile kırpılmış 600×600 JPEG; site.cv.photo[locale] kapalıysa ya da görsel yoksa undefined */
  photo?: Buffer;
}

/** Belgenin başlığı ve altbilgi etiketi: "Orçun Saatçi — Özgeçmiş" / "Orçun Saatçi — CV" */
export const docLabel = (locale: Locale) => (locale === 'tr' ? cvDictionary('tr').cv.title : 'CV');

/** URL'nin görünen biçimi: protokol ve sondaki "/" atılır */
export const bareUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Başlık bloğundaki düz metinler (karakter kapsamı koruması için, build-cv.tsx) */
export function headerStrings(src: CvSource, locale: Locale): string[] {
  const primary = src.contact.social.filter((s) => s.primary);
  return [
    src.person.name,
    pick(src.person.jobTitle, locale),
    pick(src.person.location.city, locale),
    src.contact.email,
    bareUrl(absoluteUrl('/')),
    ...primary.map((s) => bareUrl(s.url)),
    `${src.person.name} — ${docLabel(locale)} · 0/0`,
    ...Object.values(cvDictionary(locale).cv.sections),
  ];
}

export function CvDocument({ locale, sections, src, photo }: CvDocumentProps) {
  const dict = cvDictionary(locale);
  const c = themeColors(getExperienceProfile(src.site.persona).palette, 'light');
  const s = StyleSheet.create({
    // lineHeight Page'de değil içerikte: Page'den kalıtılınca çok sayfalı belgede render'lı sabit altbilgi çizilmiyor
    // (react-pdf 4.9.0, M3'te denendi)
    page: {
      padding: '14mm',
      paddingBottom: '18mm',
      fontFamily: 'Mona',
      fontSize: 10,
      color: c.ink,
    },
    // View'da birimsiz lineHeight varsayılan 18 pt'ye göre çözülür: fontSize burada da verilir (10 × 1.4 = 14 pt kalıtılır)
    content: { fontSize: 10, lineHeight: 1.4 },
    header: {
      position: 'relative',
      paddingRight: photo ? '30mm' : 0,
      minHeight: photo ? '25mm' : undefined,
    },
    name: {
      fontFamily: 'MonaWide',
      fontWeight: 700,
      fontSize: 22,
      lineHeight: 1.2,
      marginBottom: 6,
    },
    title: { fontWeight: 600, fontSize: 11, lineHeight: 1.4 },
    contact: {
      fontFamily: 'Martian',
      fontSize: 8,
      lineHeight: 1.5,
      color: c.inkMuted,
      marginTop: 6,
    },
    link: { color: c.inkMuted, textDecoration: 'none' },
    photo: { position: 'absolute', top: 0, right: 0, width: '25mm', height: '25mm' },
    section: { marginTop: 12, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: c.line },
    heading: { fontWeight: 600, fontSize: 11, lineHeight: 1.4, marginBottom: 4 },
    entry: { marginTop: 6 },
    strong: { fontWeight: 600 },
    meta: { color: c.inkMuted },
    date: { fontFamily: 'Martian', fontSize: 8, lineHeight: 1.4, color: c.inkMuted },
    bullet: { flexDirection: 'row', marginTop: 1 },
    bulletMark: { width: 10 },
    bulletText: { flex: 1 },
    footer: {
      position: 'absolute',
      bottom: '7mm',
      left: '14mm',
      right: '14mm',
      fontFamily: 'Martian',
      fontSize: 7,
      color: c.inkMuted,
    },
  });

  const projectUrl = (slug: string, locales: readonly Locale[]) =>
    absoluteUrl(
      pathOf({ key: 'project', param: slug }, locales.includes(locale) ? locale : 'tr') as string,
    );
  const skillName = new Map(src.cvSkills.items.map((k) => [k.id, pick(k.name, locale)]));
  const projectTitle = new Map(src.projects.map((p) => [p.slug, pick(p.title, locale)]));
  const primary = src.contact.social.filter((x) => x.primary);
  const contactItems: { text: string; href?: string }[] = [
    { text: src.contact.email, href: `mailto:${src.contact.email}` },
    { text: bareUrl(absoluteUrl('/')), href: absoluteUrl(locale === 'tr' ? '/' : '/en') },
    ...primary.map((x) => ({ text: bareUrl(x.url), href: x.url })),
    { text: pick(src.person.location.city, locale) },
  ];

  const Bullets = ({ items }: { items: string[] }) => (
    <>
      {items.map((h, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletMark}>•</Text>
          <Text style={s.bulletText}>{h}</Text>
        </View>
      ))}
    </>
  );

  const body = (x: CvSection): ReactNode => {
    switch (x.key) {
      case 'profile':
        return <Text>{pick(x.entries[0], locale)}</Text>;
      case 'experience':
        return x.entries.map((e) => {
          const highlights = (
            locale === 'en' ? (e.highlights.en ?? e.highlights.tr) : e.highlights.tr
          ).slice(0, 5);
          const where = [
            e.organization,
            e.location ? pick(e.location, locale) : undefined,
            e.remote ? dict.cv.remoteShort : undefined,
            dict.cv.employmentTypes[e.employmentType],
          ].filter(Boolean);
          return (
            <View key={e.id} style={s.entry} wrap={false}>
              <Text style={s.strong}>{pick(e.role, locale)}</Text>
              <Text style={s.meta}>{where.join(' · ')}</Text>
              <Text style={s.date}>
                {formatRange(e.period.start, e.period.end, locale, dict.cv.present)} ·{' '}
                {duration(locale, e.period.start, e.period.end, BUILD_MONTH, dict.cv.duration)}
              </Text>
              <Text style={{ marginTop: 2 }}>{pick(e.summary, locale)}</Text>
              <Bullets items={highlights} />
              {e.projects.length ? (
                <Text style={s.meta}>
                  {dict.cv.relatedProjects}:{' '}
                  {e.projects.map((p) => projectTitle.get(p) ?? p).join(', ')}
                </Text>
              ) : null}
              {e.skills.length ? (
                <Text style={s.meta}>
                  {dict.cv.tools}: {e.skills.map((k) => skillName.get(k) ?? k).join(', ')}
                </Text>
              ) : null}
            </View>
          );
        });
      case 'projects':
        return x.entries.map((p) => {
          const url = projectUrl(p.slug, p.locales as Locale[]);
          return (
            <View key={p.slug} style={s.entry} wrap={false}>
              <Text>
                <Text style={s.strong}>{pick(p.title, locale)}</Text>
                <Text style={s.meta}>
                  {' · '}
                  {p.year} · {pick(p.role, locale)}
                </Text>
              </Text>
              <Link src={url} style={[s.date, s.link]}>
                {bareUrl(url)}
              </Link>
            </View>
          );
        });
      case 'skills':
        return x.entries.map((g) => (
          <Text key={g.category} style={s.entry}>
            <Text style={s.strong}>{dict.cv.skillCategories[g.category]}: </Text>
            {g.skills
              .map((k) =>
                [
                  pick(k.name, locale),
                  k.level ? ` (${dict.cv.skillLevels[k.level]}` : '',
                  k.years
                    ? `${k.level ? ', ' : ' ('}${plural(locale, k.years, dict.home.years)}`
                    : '',
                  k.level || k.years ? ')' : '',
                ].join(''),
              )
              .join(', ')}
          </Text>
        ));
      case 'education':
        return x.entries.map((e) => (
          <View key={e.id} style={s.entry} wrap={false}>
            <Text style={s.strong}>
              {pick(e.degree, locale)}, {pick(e.field, locale)}
            </Text>
            <Text style={s.meta}>{e.institution}</Text>
            <Text style={s.date}>
              {formatRange(e.period.start, e.period.end, locale, dict.cv.present)}
            </Text>
            {e.grade ? (
              <Text>
                {dict.cv.grade}: {e.grade}
              </Text>
            ) : null}
            {e.thesis ? (
              <Text>
                {dict.cv.thesis}: {pick(e.thesis, locale)}
              </Text>
            ) : null}
            {e.courses.length ? (
              <Text style={s.meta}>
                {dict.cv.courses}: {e.courses.map((k) => pick(k, locale)).join(', ')}
              </Text>
            ) : null}
          </View>
        ));
      case 'certifications':
        return x.entries.map((k) => (
          <Text key={k.id} style={s.entry}>
            <Text style={s.strong}>{pick(k.name, locale)}</Text> — {k.issuer}{' '}
            <Text style={s.date}>
              {formatPartialDate(k.date, locale)}
              {k.expires ? ` · ${dict.cv.expires}: ${formatPartialDate(k.expires, locale)}` : ''}
              {k.credentialId ? ` · ${k.credentialId}` : ''}
            </Text>
          </Text>
        ));
      case 'awards':
        return x.entries.map((a) => (
          <View key={a.id} style={s.entry} wrap={false}>
            <Text>
              <Text style={s.strong}>{pick(a.title, locale)}</Text> — {a.awarder}{' '}
              <Text style={s.date}>{formatPartialDate(a.date, locale)}</Text>
            </Text>
            {a.summary ? <Text style={s.meta}>{pick(a.summary, locale)}</Text> : null}
          </View>
        ));
      case 'publications':
        return x.entries.map((p) => (
          <View key={p.id} style={s.entry} wrap={false}>
            <Text>
              <Text style={s.meta}>{dict.cv.publicationTypes[p.type]} · </Text>
              <Text style={s.strong}>{pick(p.title, locale)}</Text> — {p.venue}{' '}
              <Text style={s.date}>
                {formatPartialDate(p.date, locale)}
                {p.location ? ` · ${pick(p.location, locale)}` : ''}
              </Text>
            </Text>
            {p.coAuthors.length ? (
              <Text style={s.meta}>{fill(dict.cv.with, { names: p.coAuthors.join(', ') })}</Text>
            ) : null}
            {p.doi ? (
              <Link src={`https://doi.org/${p.doi}`} style={[s.date, s.link]}>
                DOI {p.doi}
              </Link>
            ) : null}
          </View>
        ));
      case 'languages':
        return (
          <Text>
            {x.entries
              .map((l) => `${pick(l.name, locale)} — ${dict.cv.languageLevels[l.level]}`)
              .join(' · ')}
          </Text>
        );
    }
  };

  return (
    <Document
      title={`${src.person.name} — ${docLabel(locale)}`}
      author={src.person.name}
      subject={pick(src.person.jobTitle, locale)}
      keywords={src.person.knowsAbout.map((k) => pick(k, locale)).join(', ')}
      language={locale}
      creator="orcunsaatci.com"
      producer="orcunsaatci.com"
    >
      <Page size="A4" style={s.page}>
        <View style={s.content}>
          <View style={s.header}>
            <Text style={s.name}>{src.person.name}</Text>
            <Text style={s.title}>{pick(src.person.jobTitle, locale)}</Text>
            <Text style={s.contact}>
              {contactItems.map((item, i) => (
                <Fragment key={i}>
                  {i > 0 ? '\u00A0· ' : ''}
                  {item.href ? (
                    <Link src={item.href} style={s.link}>
                      {item.text}
                    </Link>
                  ) : (
                    item.text
                  )}
                </Fragment>
              ))}
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image'ın alt özniteliği yoktur (PDF etiketlemesi yok) */}
            {photo ? <Image src={{ data: photo, format: 'jpg' }} style={s.photo} /> : null}
          </View>
          {sections.map((x) => (
            <View key={x.key} style={s.section}>
              <Text style={s.heading} minPresenceAhead={40}>
                {dict.cv.sections[x.key]}
              </Text>
              {body(x)}
            </View>
          ))}
        </View>
        <Text
          fixed
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${src.person.name} — ${docLabel(locale)} · ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
