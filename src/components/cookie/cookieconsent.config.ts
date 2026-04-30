import type { CookieConsentConfig } from 'vanilla-cookieconsent';

export const config: CookieConsentConfig = {
  root: 'body',
  autoShow: true,
  disablePageInteraction: false,
  hideFromBots: true,
  mode: 'opt-in',
  revision: 1,

  cookie: {
    name: 'cc_cookie',
    domain: 'eurovision.games',
    path: '/',
    sameSite: 'Lax',
    expiresAfterDays: 365,
  },

  guiOptions: {
    consentModal: {
      layout: 'bar',
      position: 'bottom',
      equalWeightButtons: false,
      flipButtons: false,
    },
    preferencesModal: {
      layout: 'box',
      position: 'right',
    },
  },

  categories: {
    necessary: {
      enabled: true,
      readOnly: true,
    },
    analytics: {
      enabled: false,
      autoClear: {
        cookies: [{ name: /^(_ga|_gid)/ }],
      },
    },
  },

  language: {
    default: 'en',
    translations: {
      en: {
        consentModal: {
          title: '🍪 We use cookies',
          description:
            'We use essential cookies to keep the game running and remember your language preference. No tracking without your consent.',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Necessary only',
          showPreferencesBtn: 'Manage preferences',
          footer: '<a href="/en/privacy">Privacy Policy</a> · <a href="/en/terms">Terms</a>',
        },
        preferencesModal: {
          title: 'Cookie preferences',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Necessary only',
          savePreferencesBtn: 'Save preferences',
          closeIconLabel: 'Close',
          sections: [
            {
              title: 'Strictly necessary',
              description: 'Language preference (localStorage), Supabase authentication tokens. Cannot be disabled.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Analytics (none currently)',
              description: 'If we add analytics in future (e.g. Plausible), we will ask for consent here first.',
              linkedCategory: 'analytics',
            },
          ],
        },
      },
      el: {
        consentModal: {
          title: '🍪 Χρησιμοποιούμε cookies',
          description:
            'Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία του παιχνιδιού και την αποθήκευση της γλωσσικής προτίμησής σου.',
          acceptAllBtn: 'Αποδοχή όλων',
          acceptNecessaryBtn: 'Μόνο απαραίτητα',
          showPreferencesBtn: 'Διαχείριση προτιμήσεων',
          footer: '<a href="/el/privacy">Πολιτική Απορρήτου</a> · <a href="/el/terms">Όροι</a>',
        },
        preferencesModal: {
          title: 'Προτιμήσεις cookies',
          acceptAllBtn: 'Αποδοχή όλων',
          acceptNecessaryBtn: 'Μόνο απαραίτητα',
          savePreferencesBtn: 'Αποθήκευση',
          closeIconLabel: 'Κλείσιμο',
          sections: [
            {
              title: 'Απολύτως απαραίτητα',
              description: 'Γλωσσική προτίμηση (localStorage) και tokens αυθεντικοποίησης Supabase. Δεν μπορούν να απενεργοποιηθούν.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Αναλυτικά στοιχεία (κανένα αυτή τη στιγμή)',
              description: 'Εάν προσθέσουμε analytics στο μέλλον, θα ζητήσουμε τη συγκατάθεσή σου.',
              linkedCategory: 'analytics',
            },
          ],
        },
      },
    },
  },
};
