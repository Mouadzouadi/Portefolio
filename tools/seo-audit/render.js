// Rendu JavaScript de chaque page du crawl (Chromium, user-agent Googlebot smartphone, ecran mobile).
//   NODE_PATH=$(npm root -g) node tools/seo-audit/render.js crawl.json render.json
// Compare ensuite avec le HTML brut : liens, texte, titre, H1, canonique, robots. Releve aussi les ressources
// chargees (code, poids, cache) et les erreurs JavaScript. Une page qui ne charge pas (coupure) est retentee.
const { chromium } = require('playwright');
const fs = require('fs');

const crawl = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] || 'render.json';
const urls = Object.values(crawl.pages).filter(p => p.status === 200 && /html/.test(p.content_type || '')).map(p => p.url);
// 4e argument facultatif : adresse d'une copie fidele du site (mirror/verify_live + serve.js) quand le poste d'audit
// joint mal le site en ligne. Les resultats restent ranges sous l'URL d'origine.
const mirror = process.argv[4] || null;
const target = (u) => mirror ? u.replace(crawl.base, mirror) : u;
const back = (u) => mirror ? u.replace(mirror, crawl.base) : u;

(async () => {
  const browser = await chromium.launch();
  const result = {};
  for (const url of urls) {
    for (let attempt = 1; attempt <= 8; attempt++) {
      const ctx = await browser.newContext({ userAgent: crawl.user_agent, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true });
      const page = await ctx.newPage();
      const resources = [], errors = [], failed = [];
      page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
      page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
      page.on('requestfailed', r => failed.push(r.url()));
      page.on('response', async r => {
        const h = r.headers(); let size = Number(h['content-length'] || 0);
        if (!size) { try { size = (await r.body()).length; } catch (e) {} }
        resources.push({ url: back(r.url()), status: r.status(), type: r.request().resourceType(), size, encoding: h['content-encoding'] || null, cache: h['cache-control'] || null });
      });
      try {
        await page.goto(target(url), { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(1200);
        const dom = await page.evaluate((ORIGIN) => ({
          title: document.title,
          h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim().replace(/\s+/g, ' ')),
          canonical: [...document.querySelectorAll('link[rel=canonical]')].map(l => l.getAttribute('href')),
          robots: (document.querySelector('meta[name=robots]') || {}).content || null,
          links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href.replace(location.origin, ORIGIN), text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) })),
          words: document.body.innerText.split(/\s+/).filter(Boolean).length,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          smallTaps: [...document.querySelectorAll('a,button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24); }).length,
          imagesNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
          brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
        }), crawl.base);
        const perf = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] || {}; const fcp = performance.getEntriesByName('first-contentful-paint')[0];
          return { ttfb: Math.round(n.responseStart || 0), domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0), fcp: fcp ? Math.round(fcp.startTime) : null }; });
        if (dom.words < 50 && attempt < 8) throw new Error('page incomplete (' + dom.words + ' mots)');
        result[url] = { attempt, dom, perf, errors, failed, resources };
        console.log('rendu', url, '| liens', dom.links.length, '| mots', dom.words, '| ressources', resources.length, '| erreurs', errors.length);
        await ctx.close();
        break;
      } catch (e) {
        await ctx.close();
        if (attempt === 8) { result[url] = { error: String(e).slice(0, 200) }; console.log('ECHEC', url, String(e).slice(0, 120)); }
        else await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
})();
