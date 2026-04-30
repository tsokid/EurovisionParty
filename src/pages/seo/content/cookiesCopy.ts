import type { Locale } from '../../../lib/seo/locale';

interface TableRow {
  category: string;
  purpose: string;
  defaultText: string;
  defaultTone?: 'muted' | 'pink';
}

interface ListItem {
  bold: string;
  rest: string;
}

interface RelatedItem {
  href: string;
  title: string;
  blurb: string;
}

export interface CookiesCopy {
  meta: {
    title: string;
    description: string;
    schemaDescription: string;
    webPageDescription: string;
    webPageMainEntityName: string;
    webPageMainEntityAbout: string;
    keywords: string[];
  };
  hero: {
    chip: string;
    title: string;
    lede: string;
  };
  breadcrumbs: { home: string; cookies: string };
  whatWeUse: {
    title: string;
    intro: string;
    headers: [string, string, string];
    rows: [TableRow, TableRow];
  };
  notUsed: {
    title: string;
    items: ListItem[];
  };
  changeConsent: {
    title: string;
    intro: { lead: string; emphasis: string; tail: string };
    cardTitle: string;
    cardBody: string;
    buttonLabel: string;
  };
  whereDataLives: {
    title: string;
    intro: { lead: string; linkLabel: string; tail: string };
    items: ListItem[];
  };
  banner: {
    title: string;
    intro: { lead: string; accept: string; mid1: string; reject: string; mid2: string; manage: string; tail: string };
  };
  related: RelatedItem[];
}

const en: CookiesCopy = {
  meta: {
    title: 'Cookies & Consent — Eurovision Games',
    description:
      'What cookies Eurovision Games uses, why, and how to change your consent. Strictly necessary only by default; analytics is opt-in.',
    schemaDescription:
      'What cookies Eurovision Games uses, why, and how to change your consent. Strict necessary only by default; analytics is opt-in.',
    webPageDescription:
      'Cookie policy for Eurovision Games. Strictly necessary cookies are always on; analytics is off by default and opt-in.',
    webPageMainEntityName: 'Eurovision Games cookie policy',
    webPageMainEntityAbout: 'Cookies, consent, and tracking practices on eurovision.games',
    keywords: [
      'eurovision games cookies',
      'cookie consent',
      'gdpr cookie policy',
      'eurovision games privacy',
      'analytics opt-in',
    ],
  },
  hero: {
    chip: 'Cookies & consent',
    title: 'Cookies & consent',
    lede:
      'Eurovision Games keeps cookies to the bare minimum: one strictly-necessary category that keeps the game working, and one optional analytics category you can flip on or off any time. No advertising, no cross-site tracking, no dark patterns.',
  },
  breadcrumbs: { home: 'Home', cookies: 'Cookies' },
  whatWeUse: {
    title: 'What we use',
    intro:
      "Two categories, one of which you can switch off without breaking anything you can see. Reject is the same number of clicks as Accept — we don't bury the off switch.",
    headers: ['Category', 'Purpose', 'Default'],
    rows: [
      {
        category: 'Strictly necessary',
        purpose:
          'Keeps you signed into your room (player ID, room code, name), remembers your language preference, and stores the consent choice itself.',
        defaultText: 'Always on — required for the game to work.',
        defaultTone: 'muted',
      },
      {
        category: 'Analytics',
        purpose:
          'Anonymous, aggregated page-view counts so we can see which guides and pages people actually use. No personal identifiers, no cross-site tracking.',
        defaultText: 'Off until you opt in.',
        defaultTone: 'pink',
      },
    ],
  },
  notUsed: {
    title: 'What we do NOT use',
    items: [
      { bold: 'No advertising cookies.', rest: " Eurovision Games doesn't run ads." },
      { bold: 'No social tracking pixels.', rest: ' No Meta Pixel, no LinkedIn Insight tag, no TikTok pixel.' },
      { bold: 'No third-party retargeting.', rest: ' Nothing that follows you off the site.' },
      { bold: 'No fingerprinting libraries.', rest: ' No device hashing or behavioural ID.' },
    ],
  },
  changeConsent: {
    title: 'Change your consent',
    intro: {
      lead: 'Open the preferences modal below or click the ',
      emphasis: 'Cookies & Consent',
      tail:
        ' entry in the footer of any page. You can flip Analytics on or off without affecting the strictly-necessary category.',
    },
    cardTitle: 'Open cookie preferences',
    cardBody:
      'Launches the preferences modal where you can revisit your choice. Your selection is remembered across visits on this device until cleared.',
    buttonLabel: 'Manage cookie preferences',
  },
  whereDataLives: {
    title: 'Where data lives',
    intro: {
      lead:
        "The strictly-necessary state lives in your browser's local storage and standard cookies — nothing leaves your device until you actively join a room. Game state (room, players, predictions, scores) lives in our database while the room is active and is purged according to the retention policy in our ",
      linkLabel: 'Privacy Policy',
      tail: '.',
    },
    items: [
      { bold: 'Browser storage', rest: ' — language, room code, player name, consent choice.' },
      {
        bold: 'Server (Supabase Postgres)',
        rest: ' — room and game data tied to a room ID, not to identifying data for guests.',
      },
      { bold: 'Hosting (Vercel)', rest: ' — request logs retained 14 days for security and abuse prevention.' },
    ],
  },
  banner: {
    title: 'Cookie consent banner',
    intro: {
      lead: 'On first visit you see a small banner at the bottom of the page with three buttons: ',
      accept: 'Accept all',
      mid1: ', ',
      reject: 'Reject all',
      mid2: ' (analytics off), and ',
      manage: 'Manage preferences',
      tail:
        ". Reject is the same number of clicks as Accept — we don't dark-pattern you into agreeing. The banner reappears if you clear browser storage or revoke your choice from this page.",
    },
  },
  related: [
    {
      href: '/privacy',
      title: 'Privacy policy',
      blurb: 'Data we collect, retention, your GDPR rights, and how to delete your data.',
    },
    {
      href: '/terms',
      title: 'Terms of use',
      blurb: 'Player conduct, host responsibilities, and the EBU trademark disclaimer.',
    },
    {
      href: '/about',
      title: 'About Eurovision Games',
      blurb: 'Why this exists, who built it, and the no-ads, no-accounts philosophy.',
    },
  ],
};

const el: CookiesCopy = {
  meta: {
    title: 'Cookies & Συναίνεση — Eurovision Games',
    description:
      'Ποια cookies χρησιμοποιεί το Eurovision Games, γιατί, και πώς αλλάζεις τη συναίνεσή σου. Από προεπιλογή μόνο τα απολύτως απαραίτητα· τα στατιστικά είναι opt-in.',
    schemaDescription:
      'Ποια cookies χρησιμοποιεί το Eurovision Games, γιατί, και πώς αλλάζεις τη συναίνεσή σου. Από προεπιλογή μόνο τα απολύτως απαραίτητα· τα στατιστικά είναι opt-in.',
    webPageDescription:
      'Πολιτική cookies του Eurovision Games. Τα απολύτως απαραίτητα cookies είναι πάντα ενεργά· τα στατιστικά είναι ανενεργά από προεπιλογή και opt-in.',
    webPageMainEntityName: 'Πολιτική cookies του Eurovision Games',
    webPageMainEntityAbout: 'Cookies, συναίνεση και πρακτικές παρακολούθησης στο eurovision.games',
    keywords: [
      'eurovision games cookies',
      'συναίνεση cookies',
      'πολιτική cookies gdpr',
      'απόρρητο eurovision games',
      'analytics opt-in',
    ],
  },
  hero: {
    chip: 'Cookies & συναίνεση',
    title: 'Cookies & συναίνεση',
    lede:
      'Στο Eurovision Games κρατάμε τα cookies στο ελάχιστο: μία κατηγορία απολύτως απαραίτητων που κρατά το παιχνίδι σε λειτουργία, και μία προαιρετική κατηγορία στατιστικών που μπορείς να ενεργοποιήσεις ή να απενεργοποιήσεις όποτε θέλεις. Καμία διαφήμιση, καμία διασταυρούμενη παρακολούθηση, κανένα dark pattern.',
  },
  breadcrumbs: { home: 'Αρχική', cookies: 'Cookies' },
  whatWeUse: {
    title: 'Τι χρησιμοποιούμε',
    intro:
      'Δύο κατηγορίες — τη μία μπορείς να την κλείσεις χωρίς να σπάσει τίποτα ορατό. Το Reject απαιτεί τα ίδια κλικ με το Accept — δεν κρύβουμε τον διακόπτη.',
    headers: ['Κατηγορία', 'Σκοπός', 'Προεπιλογή'],
    rows: [
      {
        category: 'Απολύτως απαραίτητα',
        purpose:
          'Σε κρατά συνδεδεμένο στο δωμάτιό σου (player ID, κωδικός εισόδου, όνομα), θυμάται τη γλώσσα σου και αποθηκεύει την ίδια την επιλογή συναίνεσης.',
        defaultText: 'Πάντα ενεργά — απαραίτητα για να δουλέψει το παιχνίδι.',
        defaultTone: 'muted',
      },
      {
        category: 'Στατιστικά',
        purpose:
          'Ανώνυμα, συγκεντρωτικά νούμερα προβολών σελίδων ώστε να βλέπουμε ποιοι οδηγοί και σελίδες χρησιμοποιούνται πραγματικά. Χωρίς προσωπικά αναγνωριστικά, χωρίς διασταυρούμενη παρακολούθηση.',
        defaultText: 'Ανενεργά μέχρι να συναινέσεις.',
        defaultTone: 'pink',
      },
    ],
  },
  notUsed: {
    title: 'Τι ΔΕΝ χρησιμοποιούμε',
    items: [
      { bold: 'Καμία διαφήμιση μέσω cookies.', rest: ' Το Eurovision Games δεν προβάλλει διαφημίσεις.' },
      {
        bold: 'Κανένα social tracking pixel.',
        rest: ' Χωρίς Meta Pixel, χωρίς LinkedIn Insight tag, χωρίς TikTok pixel.',
      },
      { bold: 'Κανένα third-party retargeting.', rest: ' Τίποτα που να σε ακολουθεί εκτός site.' },
      { bold: 'Καμία βιβλιοθήκη fingerprinting.', rest: ' Χωρίς device hashing ή behavioural ID.' },
    ],
  },
  changeConsent: {
    title: 'Άλλαξε τη συναίνεσή σου',
    intro: {
      lead: 'Άνοιξε το παράθυρο προτιμήσεων παρακάτω ή κάνε κλικ στην επιλογή ',
      emphasis: 'Cookies & Συναίνεση',
      tail:
        ' στο footer οποιασδήποτε σελίδας. Μπορείς να ενεργοποιήσεις ή να απενεργοποιήσεις τα Στατιστικά χωρίς να επηρεάσεις την κατηγορία απολύτως απαραίτητων.',
    },
    cardTitle: 'Άνοιξε τις προτιμήσεις cookies',
    cardBody:
      'Ανοίγει το παράθυρο προτιμήσεων όπου μπορείς να επανεξετάσεις την επιλογή σου. Η επιλογή σου διατηρείται μεταξύ επισκέψεων σε αυτή τη συσκευή μέχρι να καθαριστεί.',
    buttonLabel: 'Διαχείριση προτιμήσεων cookies',
  },
  whereDataLives: {
    title: 'Πού ζουν τα δεδομένα',
    intro: {
      lead:
        'Η κατάσταση των απολύτως απαραίτητων ζει στο local storage του browser σου και σε standard cookies — τίποτα δεν φεύγει από τη συσκευή σου μέχρι να μπεις ενεργά σε δωμάτιο. Η κατάσταση παιχνιδιού (δωμάτιο, παίκτες, προβλέψεις, βαθμολογία) ζει στη βάση δεδομένων μας όσο το δωμάτιο είναι ενεργό και διαγράφεται σύμφωνα με την πολιτική διατήρησης στην ',
      linkLabel: 'Πολιτική Απορρήτου',
      tail: ' μας.',
    },
    items: [
      { bold: 'Browser storage', rest: ' — γλώσσα, κωδικός εισόδου, όνομα παίκτη, επιλογή συναίνεσης.' },
      {
        bold: 'Server (Supabase Postgres)',
        rest: ' — δεδομένα δωματίου και παιχνιδιού συνδεδεμένα με room ID, όχι με αναγνωριστικά δεδομένα για guests.',
      },
      {
        bold: 'Hosting (Vercel)',
        rest: ' — request logs που διατηρούνται για 14 ημέρες για ασφάλεια και πρόληψη κατάχρησης.',
      },
    ],
  },
  banner: {
    title: 'Banner συναίνεσης cookies',
    intro: {
      lead: 'Στην πρώτη επίσκεψη βλέπεις ένα μικρό banner στο κάτω μέρος της σελίδας με τρία κουμπιά: ',
      accept: 'Αποδοχή όλων',
      mid1: ', ',
      reject: 'Απόρριψη όλων',
      mid2: ' (στατιστικά off) και ',
      manage: 'Διαχείριση προτιμήσεων',
      tail:
        '. Το Reject απαιτεί τα ίδια κλικ με το Accept — δεν σε σπρώχνουμε με dark patterns σε αποδοχή. Το banner εμφανίζεται ξανά αν καθαρίσεις το browser storage ή ανακαλέσεις την επιλογή σου από αυτή τη σελίδα.',
    },
  },
  related: [
    {
      href: '/privacy',
      title: 'Πολιτική απορρήτου',
      blurb: 'Τι δεδομένα συλλέγουμε, διατήρηση, τα δικαιώματά σου βάσει GDPR και πώς να διαγράψεις τα δεδομένα σου.',
    },
    {
      href: '/terms',
      title: 'Όροι χρήσης',
      blurb: 'Συμπεριφορά παικτών, ευθύνες οικοδεσπότη και η αποποίηση εμπορικού σήματος EBU.',
    },
    {
      href: '/about',
      title: 'Σχετικά με το Eurovision Games',
      blurb: 'Γιατί υπάρχει, ποιος το έφτιαξε και η φιλοσοφία χωρίς διαφημίσεις και χωρίς λογαριασμούς.',
    },
  ],
};

export const copy: Record<Locale, CookiesCopy> = { en, el };
