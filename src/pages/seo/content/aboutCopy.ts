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

export interface AboutCopy {
  meta: {
    title: string;
    description: string;
    organizationDescription: string;
    aboutPageDescription: string;
    keywords: string[];
  };
  hero: {
    chip: string;
    title: string;
    lede: string;
  };
  breadcrumbs: { home: string; about: string };
  whatIs: {
    title: string;
    parts: {
      lead: string;
      predictionsBold: string;
      mid1: string;
      triviaBold: string;
      mid2: string;
      trophiesBold: string;
      tail: string;
    };
  };
  why: {
    title: string;
    body: string;
    cardTitle: string;
    items: ListItem[];
  };
  whatsIn: {
    title: string;
    items: {
      bold: string;
      lead: string;
      linkLabel?: string;
      linkHref?: string;
      tail: string;
    }[];
  };
  freeNoAccount: {
    title: string;
    body: string;
  };
  ebu: {
    title: string;
    cardTitle: string;
    body: string;
  };
  builtBy: {
    title: string;
    lead: string;
    helloEmail: string;
    mid: string;
    pressEmail: string;
    tail: string;
  };
  cta: {
    title: string;
    body: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
  related: RelatedItem[];
}

const en: AboutCopy = {
  meta: {
    title: 'About Eurovision Games — Free Eurovision Party Game',
    description:
      'Eurovision Games is a free, fan-built browser party game for the Eurovision Song Contest. Predictions, trivia, duels, trophies. No ads, no accounts for guests, no install.',
    organizationDescription:
      'A free, fan-built browser party game for the Eurovision Song Contest. Live predictions, trivia, duels, and trophies for any group hosting a Eurovision night.',
    aboutPageDescription:
      'Eurovision Games is a free, fan-built browser party game for the Eurovision Song Contest. Origin, philosophy, what is in the game, and contact.',
    keywords: [
      'about eurovision games',
      'eurovision party game',
      'free eurovision game',
      'eurovision song contest game',
      'fan-built eurovision game',
      'eurovision watch party',
    ],
  },
  hero: {
    chip: 'About',
    title: 'About Eurovision Games',
    lede:
      "A free, fan-built browser party game for the Eurovision Song Contest. It started as a spreadsheet between friends and grew into a real-time multiplayer app for any group hosting a Eurovision night — with automatic scoring so the host doesn't have to miss the show.",
  },
  breadcrumbs: { home: 'Home', about: 'About' },
  whatIs: {
    title: 'What is Eurovision Games?',
    parts: {
      lead:
        'Eurovision Games is a free, browser-based party game played alongside the Eurovision Song Contest broadcast. Hosts spin up a private room in 60 seconds and share the code; guests join with just a display name. The game runs through three live phases: ',
      predictionsBold: 'predictions',
      mid1: ' before the show (lock your Top 5 and Worst 5), ',
      triviaBold: 'trivia and duels',
      mid2: ' during the show (head-to-head 12-second rounds during ad breaks), and ',
      trophiesBold: 'trophies',
      tail:
        ' after the winner is announced (Champion, Oracle, Quizmaster, Duelist, Thief). Everything scores automatically.',
    },
  },
  why: {
    title: 'Why we built it',
    body:
      "Watching Eurovision is great. Watching Eurovision with stakes is better. The existing options — printed bingo cards, paid quiz packs, custom Google Sheets — all break in the same way: someone has to do the scoring, and that someone misses half the show. We wanted live, automatic scoring that didn't cost anything and didn't require an install. That's the entire product.",
    cardTitle: 'Five principles, no exceptions',
    items: [
      { bold: 'Free, always.', rest: ' No subscriptions, no ads, no premium tier.' },
      {
        bold: 'No download.',
        rest: " If it can't open in a browser, it's not the Eurovision experience.",
      },
      {
        bold: 'No accounts for guests.',
        rest: ' Hosts sign in once; guests join with a name.',
      },
      { bold: 'Mobile-first.', rest: ' Most people host from a sofa with a phone in hand.' },
      {
        bold: 'Real fun, not gamified.',
        rest: ' Five winner categories, sudden death, real bragging rights — no streaks, no daily challenges.',
      },
    ],
  },
  whatsIn: {
    title: "What's in the game",
    items: [
      {
        bold: 'Predictions',
        lead: ' — lock your Top 5 and Worst 5 before the show. Points stack as the broadcast plays out. See ',
        linkLabel: "this year's predictions page",
        linkHref: '/eurovision-2026-predictions',
        tail: '.',
      },
      {
        bold: 'Quiz',
        lead: ' — open-room Eurovision trivia in the Preshow phase. Locks when the live show starts.',
        tail: '',
      },
      {
        bold: 'Duels',
        lead: ' — 3-question head-to-head trivia battles during the live show. Steal points or double your own. ',
        linkLabel: 'Full duel rules',
        linkHref: '/duels',
        tail: '.',
      },
      {
        bold: 'Trophies',
        lead:
          ' — five end-of-night categories (Champion, Oracle, Quizmaster, Duelist, Thief). Sudden-death tiebreaks if two players tie.',
        tail: '',
      },
    ],
  },
  freeNoAccount: {
    title: 'Free, no account, no install',
    body:
      'Eurovision Games is free for personal Eurovision watch parties. There is no subscription, no in-app purchase, and no advertising — anywhere on the site. Hosts authenticate once with an email one-time code; guests join with just a display name and a room code. Nothing to download, nothing to install. The whole thing runs in your browser on phone, tablet, or laptop.',
  },
  ebu: {
    title: 'Not affiliated with the EBU',
    cardTitle: 'Independent fan project',
    body:
      'Eurovision Games is an independent fan project. We are not affiliated with, endorsed by, or sponsored by the European Broadcasting Union, the Eurovision Song Contest, the host broadcaster, or any participating broadcaster. "Eurovision" is a trademark of the EBU; we use it descriptively only to indicate the broadcast this game is designed to accompany. Country names, song titles, artist names, and related marks remain the property of their respective owners.',
  },
  builtBy: {
    title: 'Built by',
    lead:
      'Built by a small team of Eurovision fans who got tired of doing prediction maths by hand. Bug reports, feature requests, hosting questions: ',
    helloEmail: 'hello@eurovision.games',
    mid: '. Press and partnership enquiries: ',
    pressEmail: 'press@eurovision.games',
    tail: '. We aim to reply within 3 business days; during Eurovision week (May), within 24 hours.',
  },
  cta: {
    title: 'Try Eurovision Games tonight',
    body:
      'Set up a watch party in 60 seconds. Spin up a private room, share the code, and have your friends locked in before the first postcard.',
    primaryLabel: 'Create room',
    secondaryLabel: 'How to play',
  },
  related: [
    {
      href: '/how-to-play',
      title: 'How to play in 60 seconds',
      blurb: 'Setup walkthrough from create-room to trophy reveal.',
    },
    {
      href: '/eurovision-night',
      title: 'Hosting a Eurovision night',
      blurb: 'Run-of-show, snack ideas, and how the game fits the broadcast.',
    },
    {
      href: '/eurovision-2026-predictions',
      title: '2026 predictions',
      blurb: 'Lock your Top 5 and Worst 5 before the show — points stack with duels.',
    },
    { href: '/faq', title: 'FAQ', blurb: 'Hosting, scoring, leaving rooms, and other common questions.' },
    {
      href: '/privacy',
      title: 'Privacy policy',
      blurb: 'Data we collect, retention, and how to delete your account.',
    },
    {
      href: '/terms',
      title: 'Terms of use',
      blurb: 'Player conduct, host responsibilities, and the EBU disclaimer.',
    },
  ],
};

const el: AboutCopy = {
  meta: {
    title: 'Σχετικά με το Eurovision Games — Δωρεάν Eurovision Party Game',
    description:
      'Το Eurovision Games είναι ένα δωρεάν, fan-built browser party game για τον Διαγωνισμό Τραγουδιού Eurovision. Προβλέψεις, trivia, μονομαχίες, τρόπαια. Καμία διαφήμιση, κανένας λογαριασμός για guests, καμία εγκατάσταση.',
    organizationDescription:
      'Ένα δωρεάν, fan-built browser party game για τον Διαγωνισμό Τραγουδιού Eurovision. Ζωντανές προβλέψεις, trivia, μονομαχίες και τρόπαια για κάθε παρέα που στήνει βραδιά Eurovision.',
    aboutPageDescription:
      'Το Eurovision Games είναι ένα δωρεάν, fan-built browser party game για τον Διαγωνισμό Τραγουδιού Eurovision. Προέλευση, φιλοσοφία, τι περιλαμβάνει το παιχνίδι και επικοινωνία.',
    keywords: [
      'σχετικά με eurovision games',
      'eurovision party game',
      'δωρεάν eurovision game',
      'παιχνίδι eurovision song contest',
      'fan-built eurovision game',
      'βραδιά eurovision',
    ],
  },
  hero: {
    chip: 'Σχετικά',
    title: 'Σχετικά με το Eurovision Games',
    lede:
      'Ένα δωρεάν, fan-built browser party game για τον Διαγωνισμό Τραγουδιού Eurovision. Ξεκίνησε ως ένα spreadsheet ανάμεσα σε φίλους και εξελίχθηκε σε μια real-time multiplayer εφαρμογή για κάθε παρέα που στήνει βραδιά Eurovision — με αυτόματη βαθμολογία ώστε ο οικοδεσπότης να μη χάνει την εκπομπή.',
  },
  breadcrumbs: { home: 'Αρχική', about: 'Σχετικά' },
  whatIs: {
    title: 'Τι είναι το Eurovision Games;',
    parts: {
      lead:
        'Το Eurovision Games είναι ένα δωρεάν, browser-based party game που παίζεται παράλληλα με τη μετάδοση του Διαγωνισμού Τραγουδιού Eurovision. Οι οικοδεσπότες στήνουν ιδιωτικό δωμάτιο σε 60 δευτερόλεπτα και μοιράζονται τον κωδικό· οι guests μπαίνουν μόνο με όνομα εμφάνισης. Το παιχνίδι περνά από τρεις ζωντανές φάσεις: ',
      predictionsBold: 'προβλέψεις',
      mid1: ' πριν την εκπομπή (κλείδωσε το Top 5 και το Worst 5 σου), ',
      triviaBold: 'trivia και μονομαχίες',
      mid2: ' κατά τη διάρκεια της εκπομπής (head-to-head γύροι 12 δευτερολέπτων στις διαφημίσεις) και ',
      trophiesBold: 'τρόπαια',
      tail:
        ' μετά την ανακοίνωση του νικητή (Πρωταθλητής, Μάντης, Quizmaster, Μονομάχος, Κλέφτης). Όλα βαθμολογούνται αυτόματα.',
    },
  },
  why: {
    title: 'Γιατί το φτιάξαμε',
    body:
      'Το να βλέπεις Eurovision είναι ωραίο. Το να βλέπεις Eurovision με στοιχήματα είναι καλύτερο. Οι υπάρχουσες επιλογές — εκτυπωμένα bingo cards, επί πληρωμή πακέτα quiz, custom Google Sheets — σπάνε όλες με τον ίδιο τρόπο: κάποιος πρέπει να κάνει τη βαθμολογία και αυτός ο κάποιος χάνει τη μισή εκπομπή. Θέλαμε ζωντανή, αυτόματη βαθμολογία που δεν θα κόστιζε τίποτα και δεν θα απαιτούσε εγκατάσταση. Αυτό είναι όλο το προϊόν.',
    cardTitle: 'Πέντε αρχές, καμία εξαίρεση',
    items: [
      { bold: 'Δωρεάν, πάντα.', rest: ' Καμία συνδρομή, καμία διαφήμιση, κανένα premium επίπεδο.' },
      {
        bold: 'Καμία εγκατάσταση.',
        rest: ' Αν δεν ανοίγει στον browser, δεν είναι η εμπειρία Eurovision.',
      },
      {
        bold: 'Κανένας λογαριασμός για guests.',
        rest: ' Οι οικοδεσπότες συνδέονται μία φορά· οι guests μπαίνουν με ένα όνομα.',
      },
      { bold: 'Mobile-first.', rest: ' Οι περισσότεροι παίζουν από τον καναπέ με το κινητό στο χέρι.' },
      {
        bold: 'Πραγματική διασκέδαση, όχι gamified.',
        rest:
          ' Πέντε κατηγορίες νικητή, sudden death, αληθινά bragging rights — χωρίς streaks, χωρίς daily challenges.',
      },
    ],
  },
  whatsIn: {
    title: 'Τι περιλαμβάνει το παιχνίδι',
    items: [
      {
        bold: 'Προβλέψεις',
        lead:
          ' — κλείδωσε το Top 5 και το Worst 5 σου πριν την εκπομπή. Οι πόντοι στοιβάζονται καθώς εξελίσσεται η μετάδοση. Δες ',
        linkLabel: 'τη φετινή σελίδα προβλέψεων',
        linkHref: '/eurovision-2026-predictions',
        tail: '.',
      },
      {
        bold: 'Quiz',
        lead:
          ' — open-room Eurovision trivia στη φάση Pre-show. Κλειδώνει μόλις ξεκινήσει η ζωντανή εκπομπή.',
        tail: '',
      },
      {
        bold: 'Μονομαχίες',
        lead:
          ' — head-to-head μάχες trivia 3 ερωτήσεων κατά τη διάρκεια της ζωντανής εκπομπής. Κλέψε πόντους ή διπλασίασε τους δικούς σου. ',
        linkLabel: 'Πλήρεις κανόνες μονομαχίας',
        linkHref: '/duels',
        tail: '.',
      },
      {
        bold: 'Τρόπαια',
        lead:
          ' — πέντε κατηγορίες τέλους βραδιάς (Πρωταθλητής, Μάντης, Quizmaster, Μονομάχος, Κλέφτης). Sudden-death tiebreak αν δύο παίκτες ισοβαθμήσουν.',
        tail: '',
      },
    ],
  },
  freeNoAccount: {
    title: 'Δωρεάν, χωρίς λογαριασμό, χωρίς εγκατάσταση',
    body:
      'Το Eurovision Games είναι δωρεάν για ιδιωτικές βραδιές Eurovision. Δεν υπάρχει συνδρομή, δεν υπάρχει in-app αγορά και καμία διαφήμιση — πουθενά στο site. Οι οικοδεσπότες αυθεντικοποιούνται μία φορά με email one-time code· οι guests μπαίνουν μόνο με όνομα εμφάνισης και κωδικό εισόδου. Τίποτα να κατεβάσεις, τίποτα να εγκαταστήσεις. Όλο τρέχει μέσα στον browser σε κινητό, tablet ή laptop.',
  },
  ebu: {
    title: 'Καμία σχέση με την EBU',
    cardTitle: 'Ανεξάρτητο fan project',
    body:
      'Το Eurovision Games είναι ένα ανεξάρτητο fan project. Δεν έχουμε καμία σχέση με, ούτε υποστηριζόμαστε ή χρηματοδοτούμαστε από την European Broadcasting Union, τον Διαγωνισμό Τραγουδιού Eurovision, τον φιλοξενούντα ραδιοτηλεοπτικό φορέα ή οποιονδήποτε συμμετέχοντα φορέα. Η λέξη «Eurovision» είναι εμπορικό σήμα της EBU· τη χρησιμοποιούμε περιγραφικά μόνο για να υποδείξουμε τη μετάδοση που το παιχνίδι αυτό έχει σχεδιαστεί να συνοδεύει. Ονόματα χωρών, τίτλοι τραγουδιών, ονόματα καλλιτεχνών και σχετικά σήματα παραμένουν ιδιοκτησία των αντίστοιχων κατόχων τους.',
  },
  builtBy: {
    title: 'Φτιαγμένο από',
    lead:
      'Φτιαγμένο από μια μικρή ομάδα fans της Eurovision που κουράστηκαν να κάνουν τα μαθηματικά των προβλέψεων με το χέρι. Αναφορές bugs, αιτήματα features, ερωτήσεις φιλοξενίας: ',
    helloEmail: 'hello@eurovision.games',
    mid: '. Ερωτήματα Τύπου και συνεργασιών: ',
    pressEmail: 'press@eurovision.games',
    tail:
      '. Στόχος μας είναι να απαντάμε εντός 3 εργάσιμων ημερών· κατά την εβδομάδα της Eurovision (Μάιος), εντός 24 ωρών.',
  },
  cta: {
    title: 'Δοκίμασε το Eurovision Games απόψε',
    body:
      'Στήσε μια βραδιά Eurovision σε 60 δευτερόλεπτα. Φτιάξε ιδιωτικό δωμάτιο, μοιράσου τον κωδικό και κλείδωσε τους φίλους σου πριν από το πρώτο postcard.',
    primaryLabel: 'Δημιουργία δωματίου',
    secondaryLabel: 'Πώς να παίξεις',
  },
  related: [
    {
      href: '/how-to-play',
      title: 'Πώς να παίξεις σε 60 δευτερόλεπτα',
      blurb: 'Οδηγός στησίματος από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίου.',
    },
    {
      href: '/eurovision-night',
      title: 'Φιλοξενώντας μια βραδιά Eurovision',
      blurb: 'Run-of-show, ιδέες για σνακ και πώς το παιχνίδι ταιριάζει με τη μετάδοση.',
    },
    {
      href: '/eurovision-2026-predictions',
      title: 'Προβλέψεις 2026',
      blurb: 'Κλείδωσε το Top 5 και το Worst 5 σου πριν την εκπομπή — οι πόντοι στοιβάζονται με τις μονομαχίες.',
    },
    {
      href: '/faq',
      title: 'FAQ',
      blurb: 'Φιλοξενία, βαθμολογία, αποχώρηση από δωμάτια και άλλες συνηθισμένες ερωτήσεις.',
    },
    {
      href: '/privacy',
      title: 'Πολιτική απορρήτου',
      blurb: 'Τι δεδομένα συλλέγουμε, διατήρηση και πώς να διαγράψεις τον λογαριασμό σου.',
    },
    {
      href: '/terms',
      title: 'Όροι χρήσης',
      blurb: 'Συμπεριφορά παικτών, ευθύνες οικοδεσπότη και η αποποίηση EBU.',
    },
  ],
};

export const copy: Record<Locale, AboutCopy> = { en, el };
