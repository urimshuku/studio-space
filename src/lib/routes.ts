const TOP_LEVEL_APP_SEGMENTS = new Set([
  'venue',
  'activities',
  'donate',
  'donations',
  'book',
  'join',
  'success',
  'cancel',
  'unsubscribe',
  'email-preferences',
  'privacy-policy',
  'cookie-policy',
  'terms-of-service',
  'admin',
]);

/** Compute the effective base path at runtime (handles GitHub Pages subfolder deployments). */
export function getBaseFull(): string {
  const rawBase = import.meta.env.BASE_URL || '/';
  // Strip leading and trailing slashes so we don't accidentally double-prefix.
  const cleaned = rawBase.replace(/^\/+|\/+$/g, '');
  let baseFull = cleaned ? `/${cleaned}` : '/';

  // If Vite base is root but app is served from a subfolder (e.g. GitHub Pages /repo-name),
  // derive base from the first path segment.
  if (baseFull === '/' && typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && !TOP_LEVEL_APP_SEGMENTS.has(parts[0])) {
      baseFull = `/${parts[0]}`;
    }
  }

  return baseFull;
}

/** Path after deployment base (e.g. /venue on custom domain, /studio-space/venue -> /venue on GitHub Pages). */
export function pathRelativeToBase(pathname: string, baseFull: string): string {
  if (baseFull === '/') return pathname;
  if (pathname === baseFull || pathname === baseFull + '/') return '/';
  if (pathname.startsWith(baseFull + '/')) {
    const rel = pathname.slice(baseFull.length).replace(/\/$/, '') || '/';
    return rel.startsWith('/') ? rel : `/${rel}`;
  }
  return pathname;
}

export function buildAppPath(path: string): string {
  const baseFull = getBaseFull();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === '/') return baseFull;
  if (baseFull === '/') return normalizedPath;
  return `${baseFull}${normalizedPath}`;
}
