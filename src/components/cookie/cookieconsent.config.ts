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
      equalWeightButtons: true,
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
              description: 'Supabase sign-in session, your room code, player ID and room password if set, language, sound and display preferences (localStorage), and this consent choice (cookie). Cannot be disabled.',
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
            'Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία του παιχνιδιού και την αποθήκευση της γλωσσικής προτίμησής σου. Καμία παρακολούθηση χωρίς τη συγκατάθεσή σου.',
          acceptAllBtn: 'Αποδοχή όλων',
          acceptNecessaryBtn: 'Μόνο απαραίτητα',
          showPreferencesBtn: 'Διαχείριση προτιμήσεων',
          footer: '<a href="/el/privacy">Πολιτική Απορρήτου</a> · <a href="/el/terms">Όροι</a>',
        },
        preferencesModal: {
          title: 'Προτιμήσεις cookies',
          acceptAllBtn: 'Αποδοχή όλων',
          acceptNecessaryBtn: 'Μόνο απαραίτητα',
          savePreferencesBtn: 'Αποθήκευση προτιμήσεων',
          closeIconLabel: 'Κλείσιμο',
          sections: [
            {
              title: 'Απολύτως απαραίτητα',
              description: 'Συνεδρία σύνδεσης Supabase, ο κωδικός δωματίου, το player ID και ο κωδικός πρόσβασης του δωματίου (αν έχει οριστεί), γλώσσα και ρυθμίσεις ήχου και εμφάνισης (localStorage), και αυτή η επιλογή συγκατάθεσης (cookie). Δεν μπορούν να απενεργοποιηθούν.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Στατιστικά (δεν χρησιμοποιούνται προς το παρόν)',
              description: 'Αν προσθέσουμε εργαλείο στατιστικών στο μέλλον (π.χ. Plausible), θα σου ζητήσουμε πρώτα εδώ τη συγκατάθεσή σου.',
              linkedCategory: 'analytics',
            },
          ],
        },
      },
    },
  },
};
