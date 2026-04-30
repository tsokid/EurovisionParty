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

export interface TermsCopy {
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
  breadcrumbs: { home: string; terms: string };
  whoWeAre: {
    title: string;
    lead: string;
    contactTail: string;
  };
  free: {
    title: string;
    intro: string;
    items: ListItem[];
  };
  conduct: {
    title: string;
    intro: string;
    items: ListItem[];
    closer: string;
  };
  account: {
    title: string;
    intro: string;
    items: ListItem[];
    deletionItem: {
      bold: string;
      lead: string;
      mid: string;
      linkLabel: string;
      tail: string;
    };
  };
  userContent: {
    title: string;
    lead: string;
    linkLabel: string;
    tail: string;
  };
  warranties: {
    title: string;
    lead: string;
    asIs: string;
    mid: string;
    asAvailable: string;
    tail: string;
  };
  liability: {
    title: string;
    body: string;
  };
  ebu: {
    title: string;
    cardTitle: string;
    body: string;
    bodyBold: string;
    bodyTail: string;
  };
  changes: {
    title: string;
    body: string;
  };
  contact: {
    title: string;
    lead: string;
    helloEmail: string;
    mid1: string;
    privacyEmail: string;
    mid2: string;
    legalEmail: string;
    tail: string;
  };
  related: RelatedItem[];
}

const en: TermsCopy = {
  meta: {
    title: 'Terms of Use — Eurovision Games',
    description:
      'The agreement you accept when you use Eurovision Games. Free fan project, no affiliation with the EBU, player conduct rules and liability disclaimers.',
    schemaDescription:
      'Terms of use for Eurovision Games: who we are, free-to-use rules, player conduct, account & rooms, disclaimer of warranties, limitation of liability, and the EBU trademark disclaimer.',
    webPageDescription:
      'Terms governing use of the Eurovision Games browser party game. Free, fan-made, not affiliated with the European Broadcasting Union.',
    webPageMainEntityName: 'Eurovision Games terms of use',
    webPageMainEntityAbout: 'User agreement for the eurovision.games browser game',
    keywords: [
      'eurovision games terms',
      'terms of use',
      'eurovision party game terms',
      'eurovision games disclaimer',
      'fan game terms',
    ],
  },
  hero: {
    chip: 'Terms of use',
    title: 'Terms of use',
    lede:
      "By using Eurovision Games you agree to these terms. The short version: it's a free fan project, play nicely, and we're not affiliated with the European Broadcasting Union. Last updated 30 April 2026.",
  },
  breadcrumbs: { home: 'Home', terms: 'Terms' },
  whoWeAre: {
    title: 'Who we are',
    lead:
      'Eurovision Games ("the Service", "we", "us") is an independent fan-built browser party game for the Eurovision Song Contest. The Service is operated by the Eurovision Games maintainers and is not a registered company, broadcaster, or commercial product. Contact: ',
    contactTail: '.',
  },
  free: {
    title: 'Free to use',
    intro:
      'The Service is free. There is no subscription, no in-app purchase, no paid tier, and no advertising. You may use it for private Eurovision watch parties at no cost. Commercial use — paid Eurovision events, broadcast use, sponsored play — requires written permission from the maintainers.',
    items: [
      { bold: 'No fees.', rest: ' We do not charge to host or join a room.' },
      {
        bold: 'No accounts for guests.',
        rest: ' Hosts authenticate via email OTP; guests join with a display name.',
      },
      { bold: 'No download.', rest: ' Everything runs in your browser.' },
    ],
  },
  conduct: {
    title: 'Player conduct',
    intro: 'By using the Service, you agree not to:',
    items: [
      {
        bold: 'Harass, threaten, or harm',
        rest: ' other players, in display names, in chat-like fields, or anywhere else.',
      },
      {
        bold: 'Cheat or exploit.',
        rest: ' No automated tools, scripts, scrapers, or attempts to manipulate scoring beyond the in-game rules.',
      },
      {
        bold: 'Impersonate',
        rest: ' another person, broadcaster, artist, or the Service itself.',
      },
      {
        bold: 'Access rooms',
        rest:
          ' you have not been invited to, attempt to bypass row-level security, or reverse-engineer the Service.',
      },
      {
        bold: 'Use the Service for hate speech',
        rest: ', illegal content, or harassment of any group.',
      },
    ],
    closer:
      'We can suspend or remove access for violations — especially harassment or scale abuse — without notice.',
  },
  account: {
    title: 'Account & rooms',
    intro:
      'Hosts authenticate via email one-time code. The host owns the room: they can change settings, advance the game phase, and delete the room. Guests join with a display name visible only to other players in the same room.',
    items: [
      {
        bold: 'Host responsibilities.',
        rest:
          ' The host is responsible for sharing the room code with the right people and removing anyone who breaks player conduct rules.',
      },
      {
        bold: 'RLS protects data.',
        rest:
          ' Row-level security policies in the database prevent cross-room data access; players only see their own room.',
      },
    ],
    deletionItem: {
      bold: 'Account deletion.',
      lead: ' Hosts can delete their account at any time by emailing ',
      mid: ' — see the ',
      linkLabel: 'Privacy Policy',
      tail: ' for retention details.',
    },
  },
  userContent: {
    title: 'User content',
    lead:
      'Names, predictions, trivia answers, and similar content you enter remain your own. By entering them you grant the Service a non-exclusive, free licence to display them to other players in the same room and to store them for the retention periods listed in the ',
    linkLabel: 'Privacy Policy',
    tail: '. You are responsible for ensuring you have the right to use any name, nickname, or input you provide.',
  },
  warranties: {
    title: 'Disclaimer of warranties',
    lead: 'The Service is provided ',
    asIs: '"as is"',
    mid: ' and ',
    asAvailable: '"as available"',
    tail:
      ', without warranties of any kind, express or implied. We aim for high uptime — especially during Eurovision week — but we do not guarantee uninterrupted, error-free, or bug-free operation. Scheduled maintenance, broadcast-day load spikes, or upstream provider outages may briefly affect play.',
  },
  liability: {
    title: 'Limitation of liability',
    body:
      'To the maximum extent permitted by law, Eurovision Games and its maintainers are not liable for indirect, incidental, consequential, or punitive damages arising from use of the Service — including (without limitation) lost predictions, missed trivia points, ruined parties, or interrupted broadcasts. The Service is free; total aggregate liability is limited to the fees you paid to use it (which is zero).',
  },
  ebu: {
    title: 'Eurovision Song Contest disclaimer',
    cardTitle: 'Not affiliated with the EBU',
    body: 'Eurovision Games is an independent fan project. ',
    bodyBold:
      'We are not affiliated with, endorsed by, or sponsored by the European Broadcasting Union, the Eurovision Song Contest, the host broadcaster, or any participating broadcaster.',
    bodyTail:
      ' The trademark "Eurovision" and the official Eurovision Song Contest branding belong to the EBU. We use "Eurovision" descriptively only — to indicate the broadcast this game is designed to accompany. Country names, song titles, artist names, and related marks remain the property of their respective owners.',
  },
  changes: {
    title: 'Changes to these terms',
    body:
      'We can update these terms at any time. Material changes will be announced in the FAQ and reflected in the "Last updated" date in the hero above. Continued use of the Service after a material change constitutes acceptance of the updated terms.',
  },
  contact: {
    title: 'Contact',
    lead: 'General contact and bug reports: ',
    helloEmail: 'hello@eurovision.games',
    mid1: '. Privacy and data requests: ',
    privacyEmail: 'privacy@eurovision.games',
    mid2: '. DMCA / copyright notices: ',
    legalEmail: 'legal@eurovision.games',
    tail: '.',
  },
  related: [
    {
      href: '/privacy',
      title: 'Privacy policy',
      blurb: 'Data we collect, retention, your GDPR rights, and how to delete your data.',
    },
    {
      href: '/cookies',
      title: 'Cookies & consent',
      blurb: 'What we store, how to flip analytics off, and where the data lives.',
    },
    {
      href: '/about',
      title: 'About Eurovision Games',
      blurb: 'Why this exists, who built it, and the no-ads, no-accounts philosophy.',
    },
  ],
};

const el: TermsCopy = {
  meta: {
    title: 'Όροι Χρήσης — Eurovision Games',
    description:
      'Η συμφωνία που αποδέχεσαι όταν χρησιμοποιείς το Eurovision Games. Δωρεάν fan project, καμία σχέση με την EBU, κανόνες συμπεριφοράς παικτών και αποποιήσεις ευθύνης.',
    schemaDescription:
      'Όροι χρήσης του Eurovision Games: ποιοι είμαστε, κανόνες δωρεάν χρήσης, συμπεριφορά παικτών, λογαριασμός & δωμάτια, αποποίηση εγγυήσεων, περιορισμός ευθύνης και αποποίηση εμπορικού σήματος EBU.',
    webPageDescription:
      'Όροι που διέπουν τη χρήση του Eurovision Games browser party game. Δωρεάν, fan-made, χωρίς σχέση με την European Broadcasting Union.',
    webPageMainEntityName: 'Όροι χρήσης Eurovision Games',
    webPageMainEntityAbout: 'Συμφωνία χρήστη για το browser game του eurovision.games',
    keywords: [
      'όροι eurovision games',
      'όροι χρήσης',
      'όροι eurovision party game',
      'αποποίηση eurovision games',
      'όροι fan game',
    ],
  },
  hero: {
    chip: 'Όροι χρήσης',
    title: 'Όροι χρήσης',
    lede:
      'Χρησιμοποιώντας το Eurovision Games αποδέχεσαι αυτούς τους όρους. Σύντομη εκδοχή: είναι ένα δωρεάν fan project, παίξε ωραία και δεν έχουμε καμία σχέση με την European Broadcasting Union. Τελευταία ενημέρωση: 30 Απριλίου 2026.',
  },
  breadcrumbs: { home: 'Αρχική', terms: 'Όροι' },
  whoWeAre: {
    title: 'Ποιοι είμαστε',
    lead:
      'Το Eurovision Games («η Υπηρεσία», «εμείς», «μας») είναι ένα ανεξάρτητο fan-built browser party game για τον Διαγωνισμό Τραγουδιού Eurovision. Η Υπηρεσία λειτουργεί από τους maintainers του Eurovision Games και δεν αποτελεί εγγεγραμμένη εταιρεία, ραδιοτηλεοπτικό φορέα ή εμπορικό προϊόν. Επικοινωνία: ',
    contactTail: '.',
  },
  free: {
    title: 'Δωρεάν χρήση',
    intro:
      'Η Υπηρεσία είναι δωρεάν. Δεν υπάρχει συνδρομή, δεν υπάρχει in-app αγορά, δεν υπάρχει επί πληρωμή επίπεδο και καμία διαφήμιση. Μπορείς να τη χρησιμοποιήσεις για ιδιωτικές βραδιές Eurovision χωρίς κόστος. Εμπορική χρήση — επί πληρωμή εκδηλώσεις Eurovision, μεταδόσεις, sponsored play — απαιτεί έγγραφη άδεια από τους maintainers.',
    items: [
      { bold: 'Καμία χρέωση.', rest: ' Δεν χρεώνουμε για να φτιάξεις ή να μπεις σε δωμάτιο.' },
      {
        bold: 'Κανένας λογαριασμός για guests.',
        rest: ' Οι οικοδεσπότες αυθεντικοποιούνται μέσω email OTP· οι guests μπαίνουν με όνομα εμφάνισης.',
      },
      { bold: 'Κανένα download.', rest: ' Όλα τρέχουν μέσα στον browser σου.' },
    ],
  },
  conduct: {
    title: 'Συμπεριφορά παικτών',
    intro: 'Χρησιμοποιώντας την Υπηρεσία, συμφωνείς να μην:',
    items: [
      {
        bold: 'Παρενοχλείς, απειλείς ή βλάπτεις',
        rest: ' άλλους παίκτες, σε ονόματα εμφάνισης, σε πεδία τύπου chat ή οπουδήποτε αλλού.',
      },
      {
        bold: 'Εξαπατάς ή εκμεταλλεύεσαι.',
        rest:
          ' Καμία χρήση αυτοματοποιημένων εργαλείων, scripts, scrapers ή προσπαθειών χειραγώγησης της βαθμολογίας πέραν των κανόνων του παιχνιδιού.',
      },
      {
        bold: 'Υποδύεσαι',
        rest: ' άλλο πρόσωπο, ραδιοτηλεοπτικό φορέα, καλλιτέχνη ή την ίδια την Υπηρεσία.',
      },
      {
        bold: 'Αποκτάς πρόσβαση σε δωμάτια',
        rest:
          ' στα οποία δεν έχεις προσκληθεί, ούτε προσπαθείς να παρακάμψεις το row-level security ή να κάνεις reverse-engineer την Υπηρεσία.',
      },
      {
        bold: 'Χρησιμοποιείς την Υπηρεσία για ρητορική μίσους',
        rest: ', παράνομο περιεχόμενο ή παρενόχληση οποιασδήποτε ομάδας.',
      },
    ],
    closer:
      'Μπορούμε να αναστείλουμε ή να αφαιρέσουμε την πρόσβαση για παραβιάσεις — ιδίως παρενόχληση ή κατάχρηση μεγάλης κλίμακας — χωρίς προειδοποίηση.',
  },
  account: {
    title: 'Λογαριασμός & δωμάτια',
    intro:
      'Οι οικοδεσπότες αυθεντικοποιούνται μέσω email one-time code. Ο οικοδεσπότης κατέχει το δωμάτιο: μπορεί να αλλάξει ρυθμίσεις, να προχωρήσει τη φάση του παιχνιδιού και να διαγράψει το δωμάτιο. Οι guests μπαίνουν με όνομα εμφάνισης ορατό μόνο στους άλλους παίκτες του ίδιου δωματίου.',
    items: [
      {
        bold: 'Ευθύνες οικοδεσπότη.',
        rest:
          ' Ο οικοδεσπότης είναι υπεύθυνος για τη διαμοίραση του κωδικού εισόδου στα σωστά πρόσωπα και για την αφαίρεση όποιου παραβιάζει τους κανόνες συμπεριφοράς.',
      },
      {
        bold: 'Το RLS προστατεύει τα δεδομένα.',
        rest:
          ' Οι πολιτικές row-level security στη βάση δεδομένων εμποδίζουν την πρόσβαση μεταξύ δωματίων· οι παίκτες βλέπουν μόνο το δικό τους δωμάτιο.',
      },
    ],
    deletionItem: {
      bold: 'Διαγραφή λογαριασμού.',
      lead: ' Οι οικοδεσπότες μπορούν να διαγράψουν τον λογαριασμό τους ανά πάσα στιγμή στέλνοντας email στο ',
      mid: ' — δες την ',
      linkLabel: 'Πολιτική Απορρήτου',
      tail: ' για λεπτομέρειες διατήρησης.',
    },
  },
  userContent: {
    title: 'Περιεχόμενο χρήστη',
    lead:
      'Ονόματα, προβλέψεις, απαντήσεις trivia και παρόμοιο περιεχόμενο που εισάγεις παραμένουν δικά σου. Εισάγοντάς τα, παραχωρείς στην Υπηρεσία μη αποκλειστική, δωρεάν άδεια να τα εμφανίζει σε άλλους παίκτες του ίδιου δωματίου και να τα αποθηκεύει για τις περιόδους διατήρησης που αναφέρονται στην ',
    linkLabel: 'Πολιτική Απορρήτου',
    tail:
      '. Είσαι υπεύθυνος/η να διασφαλίζεις ότι έχεις δικαίωμα χρήσης σε οποιοδήποτε όνομα, ψευδώνυμο ή είσοδο που παρέχεις.',
  },
  warranties: {
    title: 'Αποποίηση εγγυήσεων',
    lead: 'Η Υπηρεσία παρέχεται ',
    asIs: '«ως έχει»',
    mid: ' και ',
    asAvailable: '«όπως είναι διαθέσιμη»',
    tail:
      ', χωρίς εγγυήσεις οποιουδήποτε είδους, ρητές ή σιωπηρές. Στοχεύουμε σε υψηλό uptime — ιδίως κατά την εβδομάδα της Eurovision — αλλά δεν εγγυώμαστε αδιάλειπτη, χωρίς σφάλματα ή χωρίς bugs λειτουργία. Προγραμματισμένη συντήρηση, αιχμές φορτίου την ημέρα της μετάδοσης ή διακοπές παρόχων μπορεί να επηρεάσουν στιγμιαία το παιχνίδι.',
  },
  liability: {
    title: 'Περιορισμός ευθύνης',
    body:
      'Στο μέγιστο βαθμό που επιτρέπεται από τον νόμο, το Eurovision Games και οι maintainers του δεν ευθύνονται για έμμεσες, παρεπόμενες, επακόλουθες ή τιμωρητικές ζημίες που προκύπτουν από τη χρήση της Υπηρεσίας — συμπεριλαμβανομένων (ενδεικτικά) χαμένων προβλέψεων, χαμένων πόντων trivia, χαλασμένων βραδιών ή διακοπών μετάδοσης. Η Υπηρεσία είναι δωρεάν· η συνολική σωρευτική ευθύνη περιορίζεται στα τέλη που πλήρωσες για να τη χρησιμοποιήσεις (που είναι μηδέν).',
  },
  ebu: {
    title: 'Αποποίηση Διαγωνισμού Τραγουδιού Eurovision',
    cardTitle: 'Καμία σχέση με την EBU',
    body: 'Το Eurovision Games είναι ένα ανεξάρτητο fan project. ',
    bodyBold:
      'Δεν έχουμε καμία σχέση με, ούτε υποστηριζόμαστε ή χρηματοδοτούμαστε από την European Broadcasting Union, τον Διαγωνισμό Τραγουδιού Eurovision, τον φιλοξενούντα ραδιοτηλεοπτικό φορέα ή οποιονδήποτε συμμετέχοντα φορέα.',
    bodyTail:
      ' Το εμπορικό σήμα «Eurovision» και η επίσημη επωνυμία του Διαγωνισμού Τραγουδιού Eurovision ανήκουν στην EBU. Χρησιμοποιούμε τη λέξη «Eurovision» περιγραφικά μόνο — για να υποδείξουμε τη μετάδοση που το παιχνίδι αυτό έχει σχεδιαστεί να συνοδεύει. Ονόματα χωρών, τίτλοι τραγουδιών, ονόματα καλλιτεχνών και σχετικά σήματα παραμένουν ιδιοκτησία των αντίστοιχων κατόχων τους.',
  },
  changes: {
    title: 'Αλλαγές σε αυτούς τους όρους',
    body:
      'Μπορούμε να επικαιροποιήσουμε αυτούς τους όρους ανά πάσα στιγμή. Ουσιώδεις αλλαγές θα ανακοινώνονται στο FAQ και θα αντικατοπτρίζονται στην ημερομηνία «Τελευταία ενημέρωση» στο hero παραπάνω. Η συνεχιζόμενη χρήση της Υπηρεσίας μετά από ουσιώδη αλλαγή συνιστά αποδοχή των επικαιροποιημένων όρων.',
  },
  contact: {
    title: 'Επικοινωνία',
    lead: 'Γενική επικοινωνία και αναφορές bugs: ',
    helloEmail: 'hello@eurovision.games',
    mid1: '. Ερωτήσεις απορρήτου και αιτήματα δεδομένων: ',
    privacyEmail: 'privacy@eurovision.games',
    mid2: '. Ειδοποιήσεις DMCA / πνευματικών δικαιωμάτων: ',
    legalEmail: 'legal@eurovision.games',
    tail: '.',
  },
  related: [
    {
      href: '/privacy',
      title: 'Πολιτική απορρήτου',
      blurb: 'Τι δεδομένα συλλέγουμε, διατήρηση, τα δικαιώματά σου βάσει GDPR και πώς να διαγράψεις τα δεδομένα σου.',
    },
    {
      href: '/cookies',
      title: 'Cookies & συναίνεση',
      blurb: 'Τι αποθηκεύουμε, πώς να απενεργοποιήσεις τα στατιστικά και πού ζουν τα δεδομένα.',
    },
    {
      href: '/about',
      title: 'Σχετικά με το Eurovision Games',
      blurb: 'Γιατί υπάρχει, ποιος το έφτιαξε και η φιλοσοφία χωρίς διαφημίσεις και χωρίς λογαριασμούς.',
    },
  ],
};

export const copy: Record<Locale, TermsCopy> = { en, el };
