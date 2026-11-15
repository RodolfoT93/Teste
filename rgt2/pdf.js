import { db, browser, storage } from 'hatchable';

export const access = 'member';

const rid = () => {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
};

export default async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' });
  const html = String((req.body && req.body.html) || '');
  if (!html || html.length > 600000) return res.status(400).json({ error: 'documento vazio ou grande demais' });
  const id = rid();
  await db.query('DELETE FROM prints WHERE em < now() - interval \'1 hour\'');
  await db.query('INSERT INTO prints (id, html) VALUES ($1, $2)', [id, html.replace(/\bpage overflow\b/g, 'page')]);
  try {
    const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'rodolfoturini.hatchable.site';
    const pdf = await browser.pdf('https://' + host + '/print?id=' + id, { format: 'A4', printBackground: true });
    const key = 'pdf/' + id + '.pdf';
    await storage.put(key, pdf, 'application/pdf');
    const url = await storage.url(key);
    return res.json({ url });
  } finally {
    await db.query('DELETE FROM prints WHERE id = $1', [id]);
  }
}
