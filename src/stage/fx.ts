// src/stage/fx.ts — sahne etkileşimi (§5.9.10): /projeler filtresi. KESİT'in hover önizlemeleri, yay nabzı, halka
// dalgası ve dokunuş taraması KOD ile kaldırıldı (§4.14.2 #2, #3, #8). Three-free; ilk pakettedir.
import { directorApi, live } from './store';

/** /projeler filtre çipi (§5.9.10): alan indeksi ya da null; panel `ls projects/ --area=<id>` programına geçer */
export function setPlanFilter(k: number | null): void {
  live.planFilter = k;
  directorApi.update();
}
