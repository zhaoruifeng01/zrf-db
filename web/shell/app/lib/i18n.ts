/**
 * i18n boot for the shell.
 *
 * Reuses the legacy web/app/i18n.ts config (resources, locale, plugins) via the
 * `@/` alias so the migration does not duplicate locale resources. Called once
 * from app/root.tsx alongside bootApi().
 *
 * web/app/i18n.ts is a side-effect module: importing it runs
 * `i18n.use(initReactI18next).init(...)`. We guard against double-init here.
 */

import i18n from '@/app/i18n';

let booted = false;

export function bootI18n(): typeof i18n {
  if (booted) return i18n;
  booted = true;
  // init() already ran at import time; nothing else to do.
  return i18n;
}

export default i18n;
