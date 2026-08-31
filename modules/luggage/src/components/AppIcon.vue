<script setup>
defineProps({ name: { type: String, default: 'bag' }, size: { type: [Number, String], default: 20 } })
const paths = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  bag: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6h14v14H5zM9 10v6m6-6v6M8 20v2m8-2v2',
  scan: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0h3v3h-3z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  print: 'M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'M5 12l4 4L19 6',
  database: 'M20 5c0 2-4 3-8 3s-8-1-8-3 4-3 8-3 8 1 8 3zM4 5v14c0 2 4 3 8 3s8-1 8-3V5M4 12c0 2 4 3 8 3s8-1 8-3',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  shield: 'M12 2l8 3v6c0 5-8 11-8 11S4 16 4 11V5zM8 11l3 3 5-5',
  exit: 'M9 4H4v16h5m-1-8h13m-5-5 5 5-5 5',
  refresh: 'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 22v-3a8 8 0 0 1 16 0v3',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 6v6l4 2',
  wifi: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.bag" /></svg></template>
