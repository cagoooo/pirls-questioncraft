import { getSettings, getShots } from '../lib/store.js';

const $ = (id) => document.getElementById(id);

(async () => {
  const [s, shots] = await Promise.all([getSettings(), getShots()]);
  $('warn').classList.toggle('hidden', !!(s.apiKey && s.model));
  if (shots.length) $('n').textContent = `（${shots.length} 張截圖）`;
})();

$('capture').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ type: 'START_CAPTURE', tab });
  window.close();
});
$('bench').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_WORKBENCH' });
  window.close();
});
$('opts').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
