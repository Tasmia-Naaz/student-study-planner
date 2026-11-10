import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function applyChartTheme(theme) {
  const dark = theme === 'dark';
  Chart.defaults.color = dark ? '#ced4da' : '#495057';
  Chart.defaults.borderColor = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
}

export const PALETTE = ['#536f91', '#7489a3', '#829a92', '#a28d7b', '#a17c83', '#8594ad', '#78917f', '#b09a70', '#718f9a', '#a28796'];
