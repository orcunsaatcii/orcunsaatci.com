// scripts/jsonresume.d.ts — @jsonresume/schema (CJS) için tip bildirimi (§7.6.4, U-07).
declare module '@jsonresume/schema' {
  const m: { validate(json: unknown, cb: (err: unknown, ok: boolean) => void): void };
  export default m;
}
