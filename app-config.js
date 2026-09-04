(() => {
  const productionOrigin = /^https?:$/.test(window.location.protocol)
    ? window.location.origin
    : "https://139.196.97.236";
  window.APP_CONFIG = {
    mode: "production",
    supabaseUrl: `${productionOrigin}/supabase`,
    supabaseAnonKey: "sb_publishable_MA_eCckkqSFZuH4ulZTMzw_K5vOaSHh",
    eventSlug: "hema-sem-2026",
    documentApiBase: productionOrigin,
  };
})();
