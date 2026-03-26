import i18n from '../i18n';
import type { Country } from './types';

/** Return the country name in the current language. */
export function getLocalizedCountryName(c: Country): string {
  return i18n.language === 'el' ? c.name_el : c.name;
}
