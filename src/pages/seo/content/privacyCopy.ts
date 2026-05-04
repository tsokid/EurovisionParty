import type { Locale } from '../../../lib/seo/locale';

interface ListItem {
  bold: string;
  rest: string;
}

interface RelatedItem {
  href: string;
  title: string;
  blurb: string;
}

interface CollectRow {
  type: string;
  purpose: string;
  retention: string;
}

export interface PrivacyCopy {
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
  breadcrumbs: { home: string; privacy: string };
  whatCollect: {
    title: string;
    intro: string;
    headers: [string, string, string];
    rows: CollectRow[];
  };
  notCollect: {
    title: string;
    items: ListItem[];
  };
  whoHasAccess: {
    title: string;
    intro: string;
    items: ListItem[];
  };
  rights: {
    title: string;
    intro: string;
    items: ListItem[];
    contactLead: string;
    contactTail: string;
  };
  deletion: {
    title: string;
    cardTitle: string;
    cardLead: string;
    cardTail: string;
    cardBody: string;
    note: string;
  };
  cookies: {
    title: string;
    lead: string;
    linkLabel: string;
    tail: string;
  };
  children: {
    title: string;
    body: string;
  };
  changes: {
    title: string;
    body: string;
  };
  contact: {
    title: string;
    lead: string;
    privacyEmail: string;
    mid: string;
    generalEmail: string;
    tail: string;
  };
  related: RelatedItem[];
}

const en: PrivacyCopy = {
  meta: {
    title: 'Privacy Policy — Eurovision Games',
    description:
      'What data Eurovision Games collects, why, and how to delete it. GDPR-compliant; no ads, no third-party tracking, no data sales.',
    schemaDescription:
      'Privacy policy for Eurovision Games: what data we collect, how we use it, retention, cookies, your GDPR rights, and how to delete your data.',
    webPageDescription:
      'How Eurovision Games collects, stores, and deletes player data. GDPR-compliant; no advertising; no third-party tracking.',
    webPageMainEntityName: 'Eurovision Games privacy policy',
    webPageMainEntityAbout: 'Personal data handling, retention periods, and user rights on eurovision.games',
    keywords: [
      'eurovision games privacy',
      'privacy policy',
      'gdpr eurovision games',
      'data deletion eurovision games',
      'eurovision party game privacy',
    ],
  },
  hero: {
    chip: 'Privacy',
    title: 'Privacy policy',
    lede:
      'Eurovision Games is a free browser-based party game. We do not sell data, we do not run third-party advertising, and we collect the minimum needed for the game to work. Last updated 30 April 2026.',
  },
  breadcrumbs: { home: 'Home', privacy: 'Privacy' },
  whatCollect: {
    title: 'What we collect',
    intro:
      'Three categories — what each is for, and how long we keep it. Guest players (people who join a room with just a name) are not tied to identifying data on our side.',
    headers: ['Data type', 'Purpose', 'Retention'],
    rows: [
      {
        type: 'Host email',
        purpose: 'Authenticate the host via one-time code (OTP). No marketing email.',
        retention: 'Until you delete your account.',
      },
      {
        type: 'Player display name',
        purpose: 'Chosen by each player joining a room. Visible to other players in the same room only.',
        retention: 'Stripped 30 days after the room ends.',
      },
      {
        type: 'Game state',
        purpose:
          'Predictions, trivia answers, duel outcomes, scores. Tied to a room ID, not to identifying data for guests.',
        retention: 'Active room + 24 hours; aggregate stats anonymised after 30 days.',
      },
      {
        type: 'Browser & connection data',
        purpose: 'IP and user-agent for security and abuse prevention. Not used for cross-session tracking.',
        retention: 'Server logs retained 14 days.',
      },
    ],
  },
  notCollect: {
    title: 'What we do NOT collect',
    items: [
      {
        bold: 'No real names, addresses, phone numbers, or payment details.',
        rest: " The game is free and there's nothing to bill.",
      },
      { bold: 'No cross-site tracking cookies.', rest: ' No advertising or behavioural profiling.' },
      { bold: 'No microphone or camera input.', rest: ' The game is text and tap only.' },
      { bold: 'No data sales.', rest: " Ever. We're not in that business." },
    ],
  },
  whoHasAccess: {
    title: 'Who has access',
    intro: 'Eurovision Games runs on two infrastructure providers. No other third parties see your data.',
    items: [
      {
        bold: 'Supabase (Postgres database, auth)',
        rest: ' — stores room state, host accounts, and game data. Row-level security policies prevent cross-room data access.',
      },
      {
        bold: 'Vercel (hosting)',
        rest: ' — serves the app and retains short-term request logs for security and abuse prevention.',
      },
      {
        bold: 'No-one else.',
        rest:
          ' No analytics broker, no advertising network, no CRM, no data warehouse, no third-party email provider beyond the OTP transactional sender.',
      },
    ],
  },
  rights: {
    title: 'Your rights',
    intro: 'Under GDPR (EU) and UK GDPR, you have the right to:',
    items: [
      { bold: 'Access', rest: ' — request a copy of the data we hold about you.' },
      { bold: 'Rectification', rest: ' — correct inaccurate or incomplete data.' },
      { bold: 'Erasure', rest: ' — request that we delete your data (the "right to be forgotten").' },
      { bold: 'Portability', rest: ' — receive your data in a machine-readable format.' },
      { bold: 'Restriction & objection', rest: ' — limit or object to how we process your data.' },
      { bold: 'Complain', rest: ' — lodge a complaint with your local data protection authority.' },
    ],
    contactLead: 'Email ',
    contactTail: " with your request and we'll respond within 30 days.",
  },
  deletion: {
    title: 'Data deletion',
    cardTitle: 'How to delete your account',
    cardLead: 'Email ',
    cardTail:
      ' from the address you signed up with. We delete the host email and detach any historical room data within 7 days. Guest player names are stripped automatically 30 days after the room ends — you do not need to ask for that.',
    cardBody: 'To delete your account, send a request from the address you signed up with. We delete the host email and detach any historical room data within 7 days. Guest player names are stripped automatically 30 days after the room ends.',
    note: 'If you joined a room as a guest and want your display name removed sooner, ask the room host to delete the room from the host dashboard.',
  },
  cookies: {
    title: 'Cookies',
    lead:
      'We use one strictly-necessary cookie category to keep your session alive (room code, language, consent choice). Analytics cookies are off by default and opt-in. No advertising cookies, no cross-site tracking. Full breakdown on the ',
    linkLabel: 'cookies page',
    tail: '.',
  },
  children: {
    title: 'Children',
    body:
      "Eurovision Games is not directed at children under 13. Hosts should be adults; children playing in a hosted room do so under the host's supervision.",
  },
  changes: {
    title: 'Changes to this policy',
    body:
      'If we change this policy, we\'ll update the "Last updated" date in the hero above and post a note in the FAQ. Material changes will be highlighted at the top of this page for at least 30 days.',
  },
  contact: {
    title: 'Contact',
    lead: 'Privacy questions and data requests: ',
    privacyEmail: 'privacy@eurovision.games',
    mid: '. General contact: ',
    generalEmail: 'hello@eurovision.games',
    tail: '. We aim to reply within 3 business days; during Eurovision week (May), within 24 hours.',
  },
  related: [
    {
      href: '/cookies',
      title: 'Cookies & consent',
      blurb: 'What we store, how to flip analytics off, and where the data lives.',
    },
    {
      href: '/terms',
      title: 'Terms of use',
      blurb: 'Player conduct, host responsibilities, and the EBU trademark disclaimer.',
    },
    {
      href: '/about',
      title: 'About Eurovision Games',
      blurb: 'Why this exists, who built it, and the no-ads philosophy.',
    },
    { href: '/faq', title: 'FAQ', blurb: 'Hosting, scoring, leaving rooms, and other common questions.' },
  ],
};

const el: PrivacyCopy = {
  meta: {
    title: 'Πολιτική Απορρήτου — Eurovision Games',
    description:
      'Τι δεδομένα συλλέγει το Eurovision Games, γιατί, και πώς να τα διαγράψεις. Συμμόρφωση με GDPR· καμία διαφήμιση, καμία παρακολούθηση από τρίτους, καμία πώληση δεδομένων.',
    schemaDescription:
      'Πολιτική απορρήτου του Eurovision Games: τι δεδομένα συλλέγουμε, πώς τα χρησιμοποιούμε, διατήρηση, cookies, τα δικαιώματά σου βάσει GDPR και πώς να διαγράψεις τα δεδομένα σου.',
    webPageDescription:
      'Πώς το Eurovision Games συλλέγει, αποθηκεύει και διαγράφει τα δεδομένα παικτών. Συμμόρφωση με GDPR· καμία διαφήμιση· καμία παρακολούθηση από τρίτους.',
    webPageMainEntityName: 'Πολιτική απορρήτου του Eurovision Games',
    webPageMainEntityAbout:
      'Διαχείριση προσωπικών δεδομένων, περίοδοι διατήρησης και δικαιώματα χρηστών στο eurovision.games',
    keywords: [
      'απόρρητο eurovision games',
      'πολιτική απορρήτου',
      'gdpr eurovision games',
      'διαγραφή δεδομένων eurovision games',
      'απόρρητο eurovision party game',
    ],
  },
  hero: {
    chip: 'Απόρρητο',
    title: 'Πολιτική απορρήτου',
    lede:
      'Το Eurovision Games είναι ένα δωρεάν party game μέσα στον browser. Δεν πουλάμε δεδομένα, δεν προβάλλουμε διαφημίσεις τρίτων και συλλέγουμε το ελάχιστο που χρειάζεται για να δουλεύει το παιχνίδι. Τελευταία ενημέρωση: 30 Απριλίου 2026.',
  },
  breadcrumbs: { home: 'Αρχική', privacy: 'Απόρρητο' },
  whatCollect: {
    title: 'Τι συλλέγουμε',
    intro:
      'Τρεις κατηγορίες — σε τι χρησιμεύει η καθεμία και για πόσο την κρατάμε. Οι guest παίκτες (όσοι μπαίνουν σε δωμάτιο μόνο με όνομα) δεν συνδέονται με αναγνωριστικά δεδομένα στο σύστημά μας.',
    headers: ['Τύπος δεδομένων', 'Σκοπός', 'Διατήρηση'],
    rows: [
      {
        type: 'Email οικοδεσπότη',
        purpose: 'Αυθεντικοποίηση του οικοδεσπότη μέσω one-time code (OTP). Κανένα marketing email.',
        retention: 'Μέχρι να διαγράψεις τον λογαριασμό σου.',
      },
      {
        type: 'Όνομα εμφάνισης παίκτη',
        purpose:
          'Επιλέγεται από κάθε παίκτη που μπαίνει στο δωμάτιο. Ορατό μόνο στους άλλους παίκτες του ίδιου δωματίου.',
        retention: 'Διαγράφεται 30 ημέρες μετά τη λήξη του δωματίου.',
      },
      {
        type: 'Κατάσταση παιχνιδιού',
        purpose:
          'Προβλέψεις, απαντήσεις trivia, αποτελέσματα μονομαχιών, βαθμολογία. Συνδέονται με room ID, όχι με αναγνωριστικά δεδομένα για guests.',
        retention: 'Ενεργό δωμάτιο + 24 ώρες· συγκεντρωτικά στατιστικά ανωνυμοποιούνται μετά από 30 ημέρες.',
      },
      {
        type: 'Δεδομένα browser & σύνδεσης',
        purpose:
          'IP και user-agent για ασφάλεια και πρόληψη κατάχρησης. Δεν χρησιμοποιούνται για παρακολούθηση μεταξύ συνεδριών.',
        retention: 'Server logs που διατηρούνται για 14 ημέρες.',
      },
    ],
  },
  notCollect: {
    title: 'Τι ΔΕΝ συλλέγουμε',
    items: [
      {
        bold: 'Καμία πραγματική ταυτότητα, διεύθυνση, τηλέφωνο ή στοιχεία πληρωμής.',
        rest: ' Το παιχνίδι είναι δωρεάν και δεν υπάρχει τίποτα να χρεώσουμε.',
      },
      { bold: 'Κανένα cross-site tracking cookie.', rest: ' Καμία διαφήμιση και καμία προφιλοποίηση συμπεριφοράς.' },
      { bold: 'Καμία είσοδος μικροφώνου ή κάμερας.', rest: ' Το παιχνίδι παίζεται μόνο με κείμενο και tap.' },
      { bold: 'Καμία πώληση δεδομένων.', rest: ' Ποτέ. Δεν είμαστε σε αυτή τη δουλειά.' },
    ],
  },
  whoHasAccess: {
    title: 'Ποιος έχει πρόσβαση',
    intro:
      'Το Eurovision Games τρέχει σε δύο παρόχους υποδομής. Κανένας άλλος τρίτος δεν βλέπει τα δεδομένα σου.',
    items: [
      {
        bold: 'Supabase (Postgres database, auth)',
        rest:
          ' — αποθηκεύει την κατάσταση δωματίων, τους λογαριασμούς οικοδεσποτών και τα δεδομένα παιχνιδιού. Πολιτικές row-level security εμποδίζουν την πρόσβαση μεταξύ δωματίων.',
      },
      {
        bold: 'Vercel (hosting)',
        rest:
          ' — εξυπηρετεί την εφαρμογή και διατηρεί βραχυπρόθεσμα request logs για ασφάλεια και πρόληψη κατάχρησης.',
      },
      {
        bold: 'Κανείς άλλος.',
        rest:
          ' Κανένας μεσάζοντας στατιστικών, κανένα διαφημιστικό δίκτυο, κανένα CRM, κανένα data warehouse, κανένας τρίτος πάροχος email πέραν του transactional sender για το OTP.',
      },
    ],
  },
  rights: {
    title: 'Τα δικαιώματά σου',
    intro: 'Βάσει GDPR (ΕΕ) και UK GDPR, έχεις δικαίωμα σε:',
    items: [
      { bold: 'Πρόσβαση', rest: ' — να ζητήσεις αντίγραφο των δεδομένων που τηρούμε για εσένα.' },
      { bold: 'Διόρθωση', rest: ' — να διορθώσεις ανακριβή ή ελλιπή δεδομένα.' },
      { bold: 'Διαγραφή', rest: ' — να ζητήσεις να διαγράψουμε τα δεδομένα σου («δικαίωμα στη λήθη»).' },
      { bold: 'Φορητότητα', rest: ' — να λάβεις τα δεδομένα σου σε μορφή αναγνώσιμη από μηχανή.' },
      {
        bold: 'Περιορισμό & εναντίωση',
        rest: ' — να περιορίσεις ή να εναντιωθείς στον τρόπο επεξεργασίας των δεδομένων σου.',
      },
      { bold: 'Καταγγελία', rest: ' — να υποβάλεις καταγγελία στην τοπική αρχή προστασίας δεδομένων.' },
    ],
    contactLead: 'Στείλε email στο ',
    contactTail: ' με το αίτημά σου και θα απαντήσουμε εντός 30 ημερών.',
  },
  deletion: {
    title: 'Διαγραφή δεδομένων',
    cardTitle: 'Πώς να διαγράψεις τον λογαριασμό σου',
    cardLead: 'Στείλε email στο ',
    cardTail:
      ' από τη διεύθυνση με την οποία εγγράφηκες. Διαγράφουμε το email του οικοδεσπότη και αποσυνδέουμε τυχόν ιστορικά δεδομένα δωματίων εντός 7 ημερών. Τα ονόματα των guest παικτών διαγράφονται αυτόματα 30 ημέρες μετά τη λήξη του δωματίου — δεν χρειάζεται να το ζητήσεις.',
    cardBody: 'Για να διαγράψεις τον λογαριασμό σου, στείλε αίτημα από τη διεύθυνση με την οποία εγγράφηκες. Διαγράφουμε το email του οικοδεσπότη και αποσυνδέουμε τυχόν ιστορικά δεδομένα δωματίων εντός 7 ημερών. Τα ονόματα των guest παικτών διαγράφονται αυτόματα 30 ημέρες μετά τη λήξη του δωματίου.',
    note: 'Αν μπήκες σε δωμάτιο ως guest και θέλεις να αφαιρεθεί νωρίτερα το όνομά σου, ζήτησε από τον οικοδεσπότη του δωματίου να το διαγράψει από το host dashboard.',
  },
  cookies: {
    title: 'Cookies',
    lead:
      'Χρησιμοποιούμε μία κατηγορία απολύτως απαραίτητων cookies για να κρατάμε ζωντανή τη συνεδρία σου (κωδικός εισόδου, γλώσσα, επιλογή συναίνεσης). Τα cookies στατιστικών είναι απενεργοποιημένα από προεπιλογή και opt-in. Καμία διαφήμιση, καμία διασταυρούμενη παρακολούθηση. Αναλυτικά στη ',
    linkLabel: 'σελίδα cookies',
    tail: '.',
  },
  children: {
    title: 'Παιδιά',
    body:
      'Το Eurovision Games δεν απευθύνεται σε παιδιά κάτω των 13 ετών. Οι οικοδεσπότες πρέπει να είναι ενήλικες· τυχόν παιδιά που παίζουν σε δωμάτιο το κάνουν υπό την επίβλεψη του οικοδεσπότη.',
  },
  changes: {
    title: 'Αλλαγές σε αυτή την πολιτική',
    body:
      'Αν αλλάξουμε αυτή την πολιτική, θα ενημερώσουμε την ημερομηνία «Τελευταία ενημέρωση» στο hero παραπάνω και θα αναρτήσουμε σχετικό σημείωμα στο FAQ. Ουσιώδεις αλλαγές θα επισημαίνονται στην κορυφή της σελίδας για τουλάχιστον 30 ημέρες.',
  },
  contact: {
    title: 'Επικοινωνία',
    lead: 'Ερωτήσεις απορρήτου και αιτήματα δεδομένων: ',
    privacyEmail: 'privacy@eurovision.games',
    mid: '. Γενική επικοινωνία: ',
    generalEmail: 'hello@eurovision.games',
    tail:
      '. Στόχος μας είναι να απαντάμε εντός 3 εργάσιμων ημερών· κατά την εβδομάδα της Eurovision (Μάιος), εντός 24 ωρών.',
  },
  related: [
    {
      href: '/cookies',
      title: 'Cookies & συναίνεση',
      blurb: 'Τι αποθηκεύουμε, πώς να απενεργοποιήσεις τα στατιστικά και πού ζουν τα δεδομένα.',
    },
    {
      href: '/terms',
      title: 'Όροι χρήσης',
      blurb: 'Συμπεριφορά παικτών, ευθύνες οικοδεσπότη και η αποποίηση εμπορικού σήματος EBU.',
    },
    {
      href: '/about',
      title: 'Σχετικά με το Eurovision Games',
      blurb: 'Γιατί υπάρχει, ποιος το έφτιαξε και η φιλοσοφία χωρίς διαφημίσεις.',
    },
    {
      href: '/faq',
      title: 'FAQ',
      blurb: 'Φιλοξενία, βαθμολογία, αποχώρηση από δωμάτια και άλλες συνηθισμένες ερωτήσεις.',
    },
  ],
};

export const copy: Record<Locale, PrivacyCopy> = { en, el };
