import path from 'node:path';

// Static hosting must never bypass API redaction with a settings file, source
// tree, test fixture, preparation directory, or an old deployment archive.
export function protectPrivateFiles(req, res, next) {
  let pathname;
  try { pathname = path.posix.normalize(decodeURIComponent(req.path)); }
  catch { return res.status(400).end(); }
  if (/^\/(?:data|server|tests|node_modules|attached_assets|live)(?:\/|$)/i.test(pathname) ||
      /\.(?:json|zip|py|md|lock|map)$/i.test(pathname) ||
      pathname.split('/').some(segment => segment.startsWith('.'))) return res.status(404).end();
  next();
}
