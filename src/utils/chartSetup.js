import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function applyChartTheme(theme) {
  const dark = theme === 'dark';
  Chart.defaults.color = dark ? '#ced4da' : '#495057';
  Chart.defaults.borderColor = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
}

export const PALETTE = ['#0f766e', '#f5b700', '#3b5bdb', '#d6336c', '#7048e8', '#e8590c', '#2b8a3e', '#1098ad', '#862e9c', '#868e96'];
