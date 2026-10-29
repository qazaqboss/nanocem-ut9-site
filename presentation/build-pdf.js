// Сборка NanoCem-UT9-presentation.pdf из presentation/deck.html.
// Нужен playwright (npm i playwright) и Google Chrome. Запуск из корня сайта:
//   node presentation/build-pdf.js
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'deck.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(__dirname, '..', 'NanoCem-UT9-presentation.pdf'),
    width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true,
  });
  await browser.close();
})();
