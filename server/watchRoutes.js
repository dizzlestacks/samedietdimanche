import { watchCatalog, quoteWatches, validateWatchPricing } from './watchPricing.js';

// Admin protection is supplied explicitly by the application's existing middleware.
export function registerWatchRoutes(app, { getSettings, customerSettings = getSettings, updateSettings, adminAuth }) {
  app.get('/api/admin/watch-pricing', adminAuth, async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(watchCatalog(await getSettings(), { admin: true })); }
    catch { res.status(503).json({ error: 'Prices could not be loaded. Please retry.' }); }
  });
  app.get('/api/watch-catalog', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(watchCatalog(await customerSettings(req))); }
    catch { res.status(503).json({ error: 'Watch pricing is temporarily unavailable.' }); }
  });
  app.post('/api/watch-quote', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, 'items')) return res.status(400).json({ error: 'Provide only an items list. Prices are calculated by the server.' });
    let settings;
    try { settings = await customerSettings(req); }
    catch { return res.status(503).json({ error: 'Watch pricing is temporarily unavailable.' }); }
    try { res.json(quoteWatches(req.body.items, settings)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.put('/api/admin/watch-pricing', adminAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let prices;
    try { prices = validateWatchPricing(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    try { res.json(watchCatalog(await updateSettings({ watchPricing: prices }), { admin: true })); }
    catch { res.status(503).json({ error: 'Prices could not be saved. Please retry.' }); }
  });
}
