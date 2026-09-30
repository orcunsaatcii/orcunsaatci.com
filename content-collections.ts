import { defineCollection, defineConfig, defineSingleton } from '@content-collections/core';
import { compileMDX } from '@content-collections/mdx';
import * as S from './src/lib/content/schemas';
import { imageMeta, mdxMedia } from './src/lib/content/image-meta';

/** "about.tr" | "brand-strategy.en" → { key, locale } */
const splitLocale = (p: string) => {
  const i = p.lastIndexOf('.');
  return { key: p.slice(0, i), locale: S.Locale.parse(p.slice(i + 1)) };
};

/* 1) MDX gövdeleri (hakkımda, gizlilik, alan sayfası; projelerde MDX yok, D-48): bağımlı koleksiyonlardan ÖNCE listelenir */
const pageBodies = defineCollection({
  name: 'pageBodies',
  directory: 'content/pages',
  include: '*.{tr,en}.mdx',
  schema: S.PageBodyFrontmatter,
  transform: async (doc, ctx) => {
    const { key, locale } = splitLocale(doc._meta.path); // "about.tr"
    if (key !== 'about' && key !== 'privacy')
      throw new Error(`pages/${doc._meta.fileName}: yalnız about|privacy`);
    return {
      ...doc,
      key,
      locale,
      media: await mdxMedia(doc.content),
      mdx: await compileMDX(ctx, doc),
    };
  },
});

const areaBodies = defineCollection({
  name: 'areaBodies',
  directory: 'content/areas',
  include: '*.{tr,en}.mdx',
  schema: S.PageBodyFrontmatter,
  transform: async (doc, ctx) => {
    const { key, locale } = splitLocale(doc._meta.path);
    return {
      ...doc,
      areaId: S.Slug.parse(key),
      locale,
      media: await mdxMedia(doc.content),
      mdx: await compileMDX(ctx, doc),
    };
  },
});

/* 2) YAML koleksiyonları */
const areas = defineCollection({
  name: 'areas',
  directory: 'content/areas',
  include: '*.yaml',
  parser: 'yaml',
  schema: S.Area,
  transform: (doc, ctx) => {
    const id = S.Slug.parse(doc._meta.path);
    // ctx.documents() tipi dönüşüm ÖNCESİ şemadır → birleştirme _meta üzerinden yapılır
    const bodies = ctx
      .documents(areaBodies)
      .filter((b) => splitLocale(b._meta.path).key === id && !b.draft);
    const pageLocales = bodies.map((b) => splitLocale(b._meta.path).locale);
    if (doc.hasPage && !pageLocales.includes('tr'))
      throw new Error(`areas/${id}: hasPage: true → ${id}.tr.mdx zorunlu`);
    return { ...doc, id, pageLocales: doc.hasPage ? pageLocales : [] };
  },
});

const projects = defineCollection({
  name: 'projects',
  directory: 'content/projects',
  include: '*/project.yaml',
  parser: 'yaml',
  schema: S.Project,
  transform: async (doc, ctx) => {
    const slug = S.Slug.parse(doc._meta.directory); // klasör adı = slug
    if (doc.draft) return ctx.skip(`projects/${slug}: taslak`);
    const areaIds = new Set(ctx.documents(areas).map((a) => a._meta.path));
    for (const a of doc.areas)
      if (!areaIds.has(a)) throw new Error(`projects/${slug}: bilinmeyen alan "${a}"`);
    // EN sayfası yalnızca EN başlık VE EN özet varsa (§7.4.3, D-48)
    const locales: S.Locale[] = doc.title.en && doc.summary.en ? ['tr', 'en'] : ['tr'];
    return {
      ...doc,
      slug,
      locales,
      primaryArea: doc.areas[0] as string,
      year: doc.end ? Number(doc.end.slice(0, 4)) : new Date().getFullYear(), // §7.3.3
      cover: await imageMeta(doc.cover),
      // doğrudan atama: üretilen tip ImageAsset | undefined olur (koşullu yayma ImageRef | ImageAsset birleşimi verirdi)
      mobileCover: doc.mobileCover ? await imageMeta(doc.mobileCover) : undefined,
      preview: doc.preview ? await imageMeta(doc.preview) : undefined,
      gallery: await Promise.all(doc.gallery.map((g) => imageMeta(g))),
    };
  },
});

/* 3) Tekil dosyalar (singleton) */
const yaml = 'yaml' as const;
const site = defineSingleton({
  name: 'site',
  filePath: 'content/site/site.yaml',
  parser: yaml,
  schema: S.SiteConfig,
});
const person = defineSingleton({
  name: 'person',
  filePath: 'content/site/person.yaml',
  parser: yaml,
  schema: S.Person,
  // doğrudan atama (projects ile aynı gerekçe): koşullu yayma ImageRef | ImageAsset birleşimi üretir (SPEC-SAPMA §7.3.3)
  transform: async (doc) => ({
    ...doc,
    portrait: doc.portrait ? await imageMeta(doc.portrait) : undefined,
    headshot: doc.headshot ? await imageMeta(doc.headshot) : undefined,
    portraitWorking: doc.portraitWorking ? await imageMeta(doc.portraitWorking) : undefined,
  }),
});
const contact = defineSingleton({
  name: 'contact',
  filePath: 'content/site/contact.yaml',
  parser: yaml,
  schema: S.Contact,
});
const home = defineSingleton({
  name: 'home',
  filePath: 'content/pages/home.yaml',
  parser: yaml,
  schema: S.HomePage,
});
// typeName açıkça verilir: aksi halde tekil adlar çoğul dosya adlarından "tekilleştirilir" (certifications → certification)
const cv = <N extends string, T extends Parameters<typeof S.Items>[0]>(
  name: N,
  typeName: string,
  item: T,
) =>
  defineSingleton({
    name,
    typeName,
    filePath: `content/cv/${name}.yaml`,
    parser: yaml,
    schema: S.Items(item),
  });
const experience = cv('experience', 'CvExperience', S.Experience);
const education = cv('education', 'CvEducation', S.Education);
const certifications = cv('certifications', 'CvCertifications', S.Certification);
const awards = cv('awards', 'CvAwards', S.Award);
const publications = cv('publications', 'CvPublications', S.Publication);
const skills = cv('skills', 'CvSkills', S.Skill);
const languages = cv('languages', 'CvLanguages', S.Language);
const testimonials = defineSingleton({
  name: 'testimonials',
  typeName: 'Testimonials',
  filePath: 'content/testimonials.yaml',
  parser: yaml,
  schema: S.Items(S.Testimonial),
  transform: async (doc) => ({
    ...doc,
    items: await Promise.all(
      doc.items.map(async (t) => ({
        ...t,
        avatar: t.avatar ? await imageMeta(t.avatar) : undefined,
      })),
    ),
  }),
});

export default defineConfig({
  content: [
    pageBodies,
    areaBodies, // önce gövdeler
    areas,
    projects, // sonra onlara bağlananlar
    site,
    person,
    contact,
    home,
    experience,
    education,
    certifications,
    awards,
    publications,
    skills,
    languages,
    testimonials,
  ],
});
