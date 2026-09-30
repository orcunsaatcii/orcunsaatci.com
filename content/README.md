# İçerik düzenleme kılavuzu

Bu klasör sitenin bütün metinlerini ve CV verisini tutar. Kod bilmeden düzenlenebilir: bir dosyayı değiştirip
PR açtığınızda Vercel önizlemesi oluşur; önizleme doğruysa birleştirirsiniz. Hatalı içerik, build günlüğünde
anlaşılır bir mesajla durur (aşağıdaki "Hata → çözüm" tablosu).

Araçlar: tarayıcıda **github.dev** (depo sayfasında `.` tuşu) ya da yerelde **VS Code** + Red Hat "YAML" eklentisi.
Yerelde bir kez `npx content-collections build && npx tsx scripts/check-content.ts` çalıştırırsanız `.schemas/`
oluşur ve YAML dosyalarında otomatik tamamlama ile satır içi hata gösterimi gelir.

## 1. Dosya haritası

```text
content/
├─ site/site.yaml         diller, persona, özellik bayrakları, CV ayarları, sayfa açıklamaları (SEO)
├─ site/person.yaml       ad, unvan, konumlandırma cümlesi, kısa biyografi, konum, portreler
├─ site/contact.yaml      e-posta (tek kaynak), sosyal bağlantılar, yanıt süresi, müsaitlik
├─ pages/home.yaml        ana sayfa bölüm metinleri
├─ pages/about.tr.mdx     /hakkimda gövdesi (zorunlu); about.en.mdx → /en/about
├─ pages/privacy.tr.mdx   /gizlilik (zorunlu); privacy.en.mdx → /en/privacy (EN açıkken zorunlu)
├─ areas/<id>.yaml        çalışma alanı; <id>.tr.mdx yalnız alan sayfası açıksa
├─ cv/*.yaml              deneyim, eğitim, sertifika, ödül, yayın/konuşma, yetkinlik, dil
├─ projects/<slug>/project.yaml   proje sayfasının tek kaynağı (klasörde başka dosya olmaz)
└─ testimonials.yaml      yazılı izni alınmış referanslar
```

- Görseller `public/media/` altındadır: kişi görselleri `public/media/person/`, proje görselleri
  `public/media/projects/<slug>/`. Dosya adları küçük harf ve ASCII olur (ç, ğ, ı, ö, ş, ü ve boşluk yok).
- Listesi boş kalan CV dosyası silinmez; içine `items: []` yazılır.
- Metin alanları çift dillidir: `{ tr: "…", en: "…" }`. EN yoksa İngilizce sayfada Türkçe metin gösterilir.

## 2. Yer tutucular ve yayına alma kuralı

- Henüz yazılmamış içerik çift süslü parantezli büyük harfli bir yer tutucuyla (`{{…}}` biçiminde) durur ve
  YAML'da **çift tırnak içinde** yazılır. Geliştirmede ve önizlemede bunlar yalnız uyarıdır.
- **Production build'i kalan her yer tutucuda durur** (D-36). Aynı kural `/media/placeholder/` görsellerine ve
  `alan-1`, `ornek-proje-1` gibi tohum adlarına da uygulanır.
- Lansmandan önce build günlüğündeki `C01` satırlarının tamamı kapatılır.

## 3. Görev tarifleri

1. **Bir metni düzeltmek:** İlgili dosyada alanın `tr` / `en` değerini değiştirin → commit → PR → önizleme →
   birleştirme.
2. **Yeni proje eklemek:**
   1. Değişmeyecek bir ASCII kebab-case slug seçin (ör. `atlas-uygulamasi`); slug URL'dir.
   2. Mevcut bir proje klasörünü `content/projects/<slug>/` olarak kopyalayıp `project.yaml`'ı doldurun.
      Proje için MDX yazılmaz.
   3. İngilizce sayfa için `title.en` ve `summary.en` alanlarını **birlikte** doldurun.
   4. Mağaza sayfalarını (App Store, Google Play, AppGallery) ve varsa tek bir YouTube/Vimeo videosunu `links`
      altına yazın; en fazla 4 bağlantı.
   5. Görselleri `public/media/projects/<slug>/` altına koyun (boyutlar 4. bölümde). Video dosyası eklenmez.
   6. Ana sayfada görünecekse `featured: true` yapın; öne çıkan proje sayısı 3–5 arasında kalır.
3. **CV'yi güncellemek:** `cv/experience.yaml` listesine benzersiz `id` ile kayıt ekleyin, sonra
   `site/site.yaml` içinde `cv.updatedAt` değerini güncelleyin. PDF ve JSON Resume bir sonraki build'de yenilenir.
   `visibility` ile kaydın nerede görüneceğini seçersiniz: `web-and-pdf`, `web-only`, `pdf-only`, `hidden`.
4. **Portreyi değiştirmek:** Aynı adla dosyanın üzerine yazın (4:5) ve gerekiyorsa `portrait.alt` metnini
   güncelleyin.
5. **İngilizce eklemek:** `.en` alanlarını doldurun, `about.en.mdx` ve `privacy.en.mdx` ekleyin,
   `site.yaml`'da `locales: [tr, en]` yazın; build günlüğündeki "EN tamlık raporu"nu kapatın.
6. **Alan eklemek / sıralamak:** `areas/<id>.yaml` ekleyin ya da `order` değerlerini değiştirin. Kadran için
   3–6 alan gerekir; 7 ve üzeri liste olarak çizilir.
7. **Alan sayfalarını açmak:** Alanda `hasPage: true` yapıp `<id>.tr.mdx` (150–400 kelime) yazın, ardından
   `site.yaml`'da `features.areaPages: true` yapın.
8. **Referans eklemek:** Kişiden yazılı izin alın ve saklayın; `testimonials.yaml`'a `consent: true` ve
   `consentDate` ile ekleyin, `features.testimonials: true` yapın.
9. **Taslak:** Yayında görünmemesi gereken projeye `draft: true` yazın.
10. **Geliştirici gerektirenler:** persona / meslek değişikliği, kariyer başlangıç yılının ya da alan sayısının
    değişmesi (sahne posterleri yeniden üretilir).

## 4. Görsel hazırlama tablosu

| Görsel | Alan | Oran | En küçük (px) | Önerilen (px) | Biçim |
|---|---|---|---|---|---|
| Portre | `person.portrait` | 4:5 | 1600×2000 | 2400×3000 | JPG |
| Vesikalık | `person.headshot` | 1:1 | 1200×1200 | 2000×2000 | JPG |
| Çalışırken portre | `person.portraitWorking` | 3:2 | 1800×1200 | 3000×2000 | JPG |
| Proje kapağı | `project.cover` | 16:10 | 2400×1500 | 3200×2000 | JPG / PNG |
| Mobil kapak | `project.mobileCover` | 4:5 | 1200×1500 | 1600×2000 | JPG / PNG |
| Liste önizlemesi | `project.preview` | 4:3 | 1200×900 | 1600×1200 | JPG / PNG |
| Galeri ve sayfa görseli | `project.gallery[]`, `<Figure>` | serbest | uzun kenar 1600 | uzun kenar 2400–3200 | JPG / PNG |
| Referans avatarı | `testimonials[].avatar` | 1:1 | 400×400 | 800×800 | JPG |
| Kurum logosu | `experience[].logo` | — | — | — | SVG, tek renk |

- Uzun kenar **en çok 3200 px**; dosya hedefi **≤ 800 KB**, **2 MB üstü hata** verir. JPG kalitesi 82–85.
- Görseller build'de küçültülmez; kaynak dosyayı bu sınırlara indirip yükleyin.
- Her görselin `alt` metni sayfanın dilinde ve ≤ 125 karakterdir; "Görsel", "Resim", "Fotoğraf" ile başlamaz.
  Görselin iş hakkında ne gösterdiğini anlatır.

## 5. Hata → çözüm tablosu

| Build günlüğünde | Anlamı | Çözüm |
|---|---|---|
| `Validation failed … Invalid input: expected string, received undefined` | Alan eksik ya da yer tutucu tırnaksız | Alanı ekleyin ya da değeri çift tırnağa alın |
| `Error: Dosya bulunamadı: public/media/…` | Görsel yok ya da yol yanlış | Dosyayı ekleyin; yolun küçük harf ve ASCII olduğunu kontrol edin |
| `görsel /public/media altında, ASCII küçük harf adla …` | Dosya adında Türkçe karakter, boşluk ya da AVIF/WebP | Dosyayı yeniden adlandırın ya da JPG'ye çevirin |
| `projects/<slug>: bilinmeyen alan "x"` | Projede var olmayan alan kimliği | `areas/x.yaml` ekleyin ya da kimliği düzeltin |
| `links,0,kind: Invalid option: expected one of "live"\|"video"` | Desteklenmeyen bağlantı türü | Yalnız mağaza sayfası (`live`) ya da YouTube/Vimeo (`video`) |
| `start: tarih: YYYY-MM` | Proje tarihinde ay yok | `"2024-03"` biçiminde yazın |
| `ERROR C07 … proje bağlantısı` | Mağaza dışı `live` ya da YouTube/Vimeo dışı `video`, ya da ikinci video | Adresi düzeltin ya da bağlantıyı kaldırın |
| `areas/<id>: hasPage: true → <id>.tr.mdx zorunlu` | Alan sayfası açık ama gövde yok | Gövde yazın ya da `hasPage: false` yapın |
| `Singleton file not found at path: content/cv/…` | Zorunlu dosya silinmiş | `items: []` içeriğiyle geri koyun |
| MDX ayrıştırma hatası (dosya, satır, sütun) | Metinde kaçışsız `{`, `}` ya da `<` | `\{`, `\}`, `\<` yazın |
| `ERROR C01 … yer tutucu` | Production'da yer tutucu kaldı | Gerçek içerikle değiştirin |
| `ERROR C02 projects (tr) — öne çıkan P=…` | Öne çıkan proje sayısı 3–5 dışında | `featured` değerlerini düzenleyin |
| `ERROR C05 … > 2 MB` ya da uzun kenar > 3200 | Görsel çok büyük | ≤ 3200 px ve JPG kalite 82–85 ile yeniden dışa aktarın |
| `PDF fontunda olmayan karakter` | CV'de fontun desteklemediği karakter | Karakteri değiştirin ya da geliştiriciden font alt kümesini genişletmesini isteyin |

## 6. Yazım rehberi özeti

- **Ses:** birinci tekil şahıs, somut ve sakin. Bölüm başına tek fikir; cümleler ≤ 20 kelime. Cümle içinde "siz",
  buton ve kısa etiketlerde emir kipi ("Projeleri incele").
- **Sıfat yerine sayı:** "büyük başarı" değil, "3 ayda %38 artış".
- **Başlıklar** iki dilde de cümle düzenindedir: "Çalışma alanları", "Selected projects".
- **Hero formülü:** "{Kime} için {ne} yapıyorum; {nasıl / farkım}." Konumlandırma cümlesi ≤ 120 karakter ve
  ≤ 18 kelime.
- **Uzunluklar:** unvan ≤ 60; kısa biyografi ≤ 300; ana sayfa paragrafı ≤ 60 kelime (en fazla 2); alan açıklaması
  60–100 kelime; hakkımda metni 400–700 kelime; CV maddesi ≤ 180 karakter, fiille başlar.
- **Türkçe yazım:** özel ad ekinde `’` (U+2019): "Orçun’un", "İstanbul’da". Tırnak `“…”`. Yıl aralığı boşluklu
  en dash: "2021 – 2024". İçeriğe BÜYÜK HARFLE yazılmaz (büyük harf görünümü tasarımdan gelir).
- **Kaçınılacak ifadeler:** tutkulu, yenilikçi, vizyoner, sinerji, 360 derece, dünya standartlarında; passionate,
  innovative, visionary, guru, ninja, rockstar, synergy, cutting-edge, world-class. Yerine somut olgu ve sonuç.
- **Emoji yok.**

## 7. Ticari dil uyarısı

Site Vercel Hobby planında barındırılır ve bu plan **ticari kullanıma izin vermez** (D-30). Metinlerde hizmet
satışı, ücret, paket, indirim, teklif, satın alma, rezervasyon ya da randevu dili kullanılmaz; "Beni işe alın" /
"Hire me" yazılmaz. Bunların yerine "Çalışma alanları", "Neler yapıyorum", "Bana yazın" ve müsaitlik satırı
("Yeni fırsatlara açığım") kullanılır. Build bu kelimeleri `C09` uyarısıyla işaretler. Ücretli hizmet tanıtmak
istenirse Vercel Pro'ya geçmek gerekir.

## 8. İzinler

- **Kurum logoları** (`experience[].logo`) yalnızca kurumun **yazılı izniyle** eklenir.
- **Referanslar** yalnızca kişinin **yazılı izniyle** yayımlanır; izin kaydını (e-posta ya da imzalı metin) saklayın
  ve `consentDate` alanına tarihini yazın.
- **Ekran görüntülerinde** gerçek kullanıcı ya da müşteri verisi bulunmaz (ad, e-posta, telefon, hesap bilgisi,
  iç kayıtlar). Şirket projelerinde gizli bilgi yazılmaz; proje sayfası yalnızca başlık, özet, rol, tarih, künye,
  mağaza bağlantıları ve görsellerden oluşur.
