declare module 'rabbit-node' {
  const Rabbit: { zg2uni(text: string): string; uni2zg(text: string): string }
  export default Rabbit
}

/** "/sb" when the build runs on a host that forwards /sb/* to Supabase (set in vite.config.ts). */
declare const __SB_PROXY__: string
