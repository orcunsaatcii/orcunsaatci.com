// src/lib/head-script.ts
// <head> içinde, ilk boyamadan ÖNCE çalışan satır içi betik. ES5; import yok; üretilen dize ≤ 1.5 KB.
// İki kök layout ve global-not-found.tsx aynı dizeyi kullanır (§8.4.3).

/** Depolama anahtarları (D-38). Başka yerde dize olarak yazılmaz; buradan import edilir. */
export const STORAGE_KEYS = { motion: 'os-motion', theme: 'os-theme', sweep: 'os-sweep' } as const;
/** window üzerinde yayınlanan tercih olayları. */
export const PREF_EVENTS = { motion: 'os-motion-change', theme: 'os-theme-change' } as const;
/** MotionRoot'un ilk effect'inde yazdığı hidrasyon işareti. */
export const HYDRATED_ATTR = 'data-hydrated';
/** `load`'dan bu kadar sonra hidrasyon işareti yoksa `js` sınıfı kaldırılır (JS'siz düzene dönüş, §4.16.2). */
export const HYDRATION_GRACE_MS = 4000;

export const headScript = `(function(){
var d=document.documentElement,w=window;
d.classList.add('js');
function get(k){try{return w.localStorage.getItem(k)}catch(e){return null}}
function mm(q){try{return w.matchMedia(q)}catch(e){return null}}
function on(m,f){if(m){try{m.addEventListener('change',f)}catch(e){}}}
var DARK=mm('(prefers-color-scheme: dark)'),REDUCE=mm('(prefers-reduced-motion: reduce)');
var tp=get('${STORAGE_KEYS.theme}');if(tp!=='light'&&tp!=='dark')tp='system';
d.setAttribute('data-theme-pref',tp);
d.setAttribute('data-theme',tp==='system'?(DARK&&DARK.matches?'dark':'light'):tp);
var mp=get('${STORAGE_KEYS.motion}');
d.setAttribute('data-motion',mp==='reduce'||mp==='full'?mp:(REDUCE&&REDUCE.matches?'reduce':'full'));
on(DARK,function(e){if(d.getAttribute('data-theme-pref')!=='system')return;d.setAttribute('data-theme',e.matches?'dark':'light');w.dispatchEvent(new Event('${PREF_EVENTS.theme}'))});
on(REDUCE,function(e){var s=get('${STORAGE_KEYS.motion}');if(s==='reduce'||s==='full')return;d.setAttribute('data-motion',e.matches?'reduce':'full');w.dispatchEvent(new Event('${PREF_EVENTS.motion}'))});
w.addEventListener('load',function(){setTimeout(function(){if(!d.hasAttribute('${HYDRATED_ATTR}'))d.classList.remove('js')},${HYDRATION_GRACE_MS})});
})();`;
