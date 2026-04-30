import type { Locale } from '../../../lib/seo/locale';

export interface EurovisionGamesCopy {
  meta: {
    title: string;
    description: string;
    headline: string;
    articleDescription: string;
    keywords: string[];
  };
  crumbs: { home: string; current: string };
  hero: { chip: string; title: string; lede: string };
  sections: {
    inside: {
      title: string;
      intro: string;
      tableHeaders: [string, string, string];
      rows: { game: string; when: string; scoring: string; href: string }[];
    };
    predictions: { title: string; p1: string; p2Before: string; p2Link: string; p2After: string };
    quiz: { title: string; p1: string; p2Before: string; p2Link: string; p2After: string };
    duels: { title: string; p1Pre: string; steal: string; p1Mid: string; double: string; p1Post: string; p2Before: string; p2Link: string; p2After: string };
    dashboard: { title: string; p1: string; p2Before: string; p2Link: string; p2After: string };
    trophies: {
      title: string;
      intro: string;
      bullets: { strong: string; rest: string }[];
    };
    free: {
      title: string;
      intro: string;
      bullets: { strong: string; rest: string }[];
    };
    faq: { title: string };
  };
  faq: { q: string; a: string }[];
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    heading: string;
    items: { href: string; title: string; blurb: string }[];
  };
}

export const copy: Record<Locale, EurovisionGamesCopy> = {
  en: {
    meta: {
      title: 'Eurovision Games \u2014 Free Multiplayer Party Game for Eurovision 2026',
      description:
        'The free, browser-based Eurovision party game: Top 5 and Worst 5 predictions, trivia duels, quiz rounds, a live dashboard, and five trophies. 2\u201320 players, no install.',
      headline: 'Eurovision Games — The Free Multiplayer Companion for Eurovision 2026',
      articleDescription:
        'A free, browser-based party game built around Eurovision: predictions, quiz, duels, a live dashboard, and five trophies. Two to twenty players, no install.',
      keywords: [
        'eurovision games',
        'free eurovision party game',
        'eurovision online game',
        'eurovision games for friends',
        'eurovision quiz game',
        'eurovision predictions game',
      ],
    },
    crumbs: { home: 'Home', current: 'Eurovision Games' },
    hero: {
      chip: 'All games',
      title: 'Eurovision Games — every game in the suite',
      lede:
        'Eurovision Games is the free, browser-based companion for the Eurovision Song Contest. Predictions before the show, quiz rounds in the preshow, head-to-head duels in the ad breaks, a live dashboard, and five trophies at the end. Two to twenty players, no install, no account for guests.',
    },
    sections: {
      inside: {
        title: "What's inside Eurovision Games",
        intro:
          'Four scoring modes layer across the four hours of the broadcast — each one targeting a different beat of the night so that the room never has "nothing to do." Predictions are the long game. Quiz is the warm-up. Duels are the live-show weapon. The Dashboard is the running scoreboard everyone is watching.',
        tableHeaders: ['Game', 'When active', 'Scoring (cap)'],
        rows: [
          {
            game: 'Predictions',
            when: 'Lobby \u2192 lock at song 1',
            scoring: 'Top 5 + Worst 5, weighted slots, 500 cap',
            href: '/eurovision-2026-predictions',
          },
          { game: 'Quiz', when: 'Preshow only', scoring: '3 rounds \u00d7 120 = 360 cap', href: '/eurovision-trivia' },
          {
            game: 'Duels',
            when: 'Live Show \u2192 Winners',
            scoring: '3 questions, 12s each, Steal or Double',
            href: '/duels',
          },
          { game: 'Dashboard', when: 'Always', scoring: 'Live total of all four sources', href: '/dashboard' },
        ],
      },
      predictions: {
        title: 'Predictions — Top 5 and Worst 5',
        p1:
          'Before song one, every player locks a Top 5 and a Worst 5 from the 2026 grand-final running order. Weighted slots reward conviction (your #1 pick is worth more than your #5), and the formula scores against the official jury + televote total once the host enters results. The hard cap is 500 points so no single category can run the night.',
        p2Before: 'Full format on the ',
        p2Link: '2026 predictions page',
        p2After: '.',
      },
      quiz: {
        title: 'Quiz rounds',
        p1:
          'Three host-triggered rounds run during the preshow window: ten questions each, twelve seconds per question, drawn from the same Eurovision trivia bank that feeds duels. Quiz locks the moment the host advances to Live Show — that is the cutoff. Cap is 360 across all three rounds combined.',
        p2Before: 'Sample questions and the bank breakdown live on the ',
        p2Link: 'Eurovision trivia page',
        p2After: '.',
      },
      duels: {
        title: 'Duels',
        p1Pre:
          'Once the broadcast starts, quiz locks and duels open. A duel is a private 3-question, 12-second-per-question head-to-head with another player. Winner picks ',
        steal: 'Steal',
        p1Mid: ' (take points from the loser) or ',
        double: 'Double',
        p1Post: ' (add points to themselves). Two trophies — Duelist and Thief — are decided here.',
        p2Before: 'Full rules and scoring on the ',
        p2Link: 'duels page',
        p2After: '.',
      },
      dashboard: {
        title: 'Live Dashboard',
        p1:
          'The Dashboard is the always-visible leaderboard, push-updated the moment any of the four sources resolves — predictions, quiz, duels won, points stolen. Tap a player for their per-source split. There is no refresh and no spectator mode; everyone in the room sees the same totals at the same time.',
        p2Before: 'Deep dive on the ',
        p2Link: 'Dashboard page',
        p2After: '.',
      },
      trophies: {
        title: 'Trophies — five winners every night',
        intro:
          'Eurovision Games does not crown one winner — it crowns five. After the official Eurovision result is entered, trophy cards reveal one by one:',
        bullets: [
          { strong: 'Champion', rest: ' — highest total across all four sources.' },
          { strong: 'Oracle', rest: ' — best Top 5 prediction score.' },
          { strong: 'Guru', rest: ' — highest quiz score across the three rounds.' },
          { strong: 'Duelist', rest: ' — most duels won across the night.' },
          { strong: 'Thief', rest: ' — most points taken via Steal.' },
        ],
      },
      free: {
        title: 'Free, no install, no account',
        intro:
          'Eurovision Games is free to play and built to remove every reason a guest might bail before the first song.',
        bullets: [
          { strong: 'Browser-based.', rest: ' Any modern browser on iOS, Android, or desktop.' },
          { strong: 'Mobile-first PWA.', rest: ' Add to home screen if you want, but you do not have to.' },
          {
            strong: 'Host-only signup.',
            rest: ' The host authenticates once; guests just type a room code and a display name.',
          },
          {
            strong: '2\u201320 players.',
            rest: ' Sweet spot is 6\u201310 — enough variety without the trivia rotation getting stale.',
          },
        ],
      },
      faq: { title: 'Frequently asked questions' },
    },
    faq: [
      {
        q: 'Is Eurovision Games really free?',
        a: 'Yes. No subscription, no in-app purchases, no signup required for guests to join. The host authenticates once by email so the room can be saved; players just need the room code.',
      },
      {
        q: 'How many players can join?',
        a: 'Two to twenty per room. The sweet spot is six to ten — enough variety in predictions and duels without the trivia rotation getting stale across a four-hour show.',
      },
      {
        q: 'Does it work on mobile?',
        a: 'Yes. It is a mobile-first PWA that runs in any modern browser on iOS, Android, or desktop. No app store install — players just open the link, type the room code, and play.',
      },
      {
        q: 'Do players need an account?',
        a: 'No. Only the host creates a free account (email or Google). Guests join with the room code and a display name; nothing is saved against them between sessions unless they choose to sign up.',
      },
      {
        q: 'Is this affiliated with the EBU or the official Eurovision Song Contest?',
        a: 'No. Eurovision Games is an independent fan project. Eurovision Song Contest, ESC, and the heart logo are trademarks of the European Broadcasting Union. We use the country and song data only to score your predictions.',
      },
      {
        q: 'How long does a full session take?',
        a: 'Roughly four hours, matched to the broadcast. Predictions lock before song one, quiz runs in the preshow, duels run during ad breaks and the interval, results post live, and trophies reveal after the winner is announced.',
      },
    ],
    cta: {
      title: 'Try Eurovision Games tonight',
      body: 'A 60-second setup, the perfect Eurovision watch-party companion.',
      primary: 'Create room',
      secondary: 'How to play',
    },
    related: {
      heading: 'Keep reading',
      items: [
        {
          href: '/eurovision-2026-predictions',
          title: 'Predictions',
          blurb: 'Lock Top 5 and Worst 5 before the show — the 500-point engine of the night.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Trivia',
          blurb: 'Sample questions plus the bank quiz and duels both pull from.',
        },
        {
          href: '/duels',
          title: 'Duels',
          blurb: '3-question head-to-head battles during the live show. Steal or Double.',
        },
        {
          href: '/dashboard',
          title: 'Dashboard',
          blurb: 'The live leaderboard everyone is watching. Push-updated, no refresh.',
        },
        {
          href: '/how-to-play',
          title: 'How to play',
          blurb: 'Sixty-second setup walkthrough from create-room to trophy reveal.',
        },
        {
          href: '/eurovision-night',
          title: 'Eurovision Night',
          blurb: 'How the four games fit into the four-hour broadcast.',
        },
        {
          href: '/eurovision-party',
          title: 'Eurovision Party',
          blurb: 'Hosting playbook — venue, food, run-of-show, and the games to layer on.',
        },
      ],
    },
  },
  el: {
    meta: {
      title: 'Eurovision Games \u2014 Δωρεάν multiplayer party game για τη Eurovision 2026',
      description:
        'Το δωρεάν party game της Eurovision μέσα στον browser: προβλέψεις Top 5 και Worst 5, μονομαχίες trivia, γύροι quiz, ζωντανός πίνακας βαθμολογίας και πέντε τρόπαια. 2\u201320 παίκτες, χωρίς install.',
      headline: 'Eurovision Games — Ο δωρεάν multiplayer σύντροφος για τη Eurovision 2026',
      articleDescription:
        'Ένα δωρεάν party game μέσα στον browser, χτισμένο γύρω από τη Eurovision: προβλέψεις, quiz, μονομαχίες, ζωντανός πίνακας βαθμολογίας και πέντε τρόπαια. Από δύο έως είκοσι παίκτες, χωρίς install.',
      keywords: [
        'eurovision games',
        'δωρεάν eurovision party game',
        'eurovision online παιχνίδι',
        'eurovision games για παρέα',
        'eurovision quiz παιχνίδι',
        'eurovision προβλέψεις παιχνίδι',
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Eurovision Games' },
    hero: {
      chip: 'Όλα τα παιχνίδια',
      title: 'Παιχνίδια Eurovision — όλα όσα παίζονται',
      lede:
        'Το Eurovision Games είναι ο δωρεάν σύντροφος για τη Eurovision μέσα στον browser. Προβλέψεις πριν την εκπομπή, γύροι quiz στο pre-show, μονομαχίες ένας προς έναν στα διαφημιστικά διαλείμματα, ζωντανός πίνακας βαθμολογίας και πέντε τρόπαια στο τέλος. Από δύο έως είκοσι παίκτες, χωρίς install και χωρίς λογαριασμό για τους καλεσμένους.',
    },
    sections: {
      inside: {
        title: 'Τι περιλαμβάνει το Eurovision Games',
        intro:
          'Τέσσερα modes βαθμολογίας απλώνονται στις τέσσερις ώρες της μετάδοσης — καθένα στοχεύει σε διαφορετικό σημείο της βραδιάς, ώστε το δωμάτιο να μη μένει ποτέ "χωρίς να κάνει κάτι". Οι προβλέψεις είναι το long game. Το quiz είναι το ζέσταμα. Οι μονομαχίες είναι το όπλο της ζωντανής εκπομπής. Το Dashboard είναι ο πίνακας βαθμολογίας που παρακολουθούν όλοι.',
        tableHeaders: ['Παιχνίδι', 'Πότε ενεργοποιείται', 'Βαθμολογία (όριο)'],
        rows: [
          {
            game: 'Προβλέψεις',
            when: 'Λόμπι \u2192 κλείδωμα στο τραγούδι 1',
            scoring: 'Top 5 + Worst 5, σταθμισμένες θέσεις, όριο 500',
            href: '/eurovision-2026-predictions',
          },
          {
            game: 'Quiz',
            when: 'Μόνο pre-show',
            scoring: '3 γύροι \u00d7 120 = όριο 360',
            href: '/eurovision-trivia',
          },
          {
            game: 'Μονομαχίες',
            when: 'Ζωντανή Εκπομπή \u2192 Νικητές',
            scoring: '3 ερωτήσεις, 12 δευτ. έκαστη, Steal ή Double',
            href: '/duels',
          },
          {
            game: 'Dashboard',
            when: 'Πάντα',
            scoring: 'Ζωντανό σύνολο και των τεσσάρων πηγών',
            href: '/dashboard',
          },
        ],
      },
      predictions: {
        title: 'Προβλέψεις — Top 5 και Worst 5',
        p1:
          'Πριν το πρώτο τραγούδι, κάθε παίκτης κλειδώνει ένα Top 5 και ένα Worst 5 από τη σειρά εμφάνισης του μεγάλου τελικού του 2026. Οι σταθμισμένες θέσεις ανταμείβουν την πεποίθηση (η #1 επιλογή σου αξίζει περισσότερο από τη #5) και ο τύπος βαθμολογεί έναντι του επίσημου συνόλου κριτικής επιτροπής + televote, μόλις ο οικοδεσπότης καταχωρήσει τα αποτελέσματα. Το όριο είναι 500 πόντοι, ώστε καμία κατηγορία να μην μπορεί να μονοπωλήσει τη βραδιά.',
        p2Before: 'Πλήρης μορφή στη ',
        p2Link: 'σελίδα προβλέψεων 2026',
        p2After: '.',
      },
      quiz: {
        title: 'Γύροι quiz',
        p1:
          'Τρεις γύροι, που τους ξεκινάει ο οικοδεσπότης, τρέχουν στο παράθυρο του pre-show: δέκα ερωτήσεις ο καθένας, δώδεκα δευτερόλεπτα ανά ερώτηση, από την ίδια τράπεζα trivia της Eurovision που τροφοδοτεί και τις μονομαχίες. Το quiz κλειδώνει τη στιγμή που ο οικοδεσπότης προχωράει στη Ζωντανή Εκπομπή — αυτό είναι το όριο. Συνολικό όριο 360 πόντοι και για τους τρεις γύρους.',
        p2Before: 'Δείγματα ερωτήσεων και ανάλυση της τράπεζας στη ',
        p2Link: 'σελίδα Eurovision trivia',
        p2After: '.',
      },
      duels: {
        title: 'Μονομαχίες',
        p1Pre:
          'Μόλις ξεκινήσει η μετάδοση, το quiz κλειδώνει και ανοίγουν οι μονομαχίες. Μια μονομαχία είναι ένα ιδιωτικό head-to-head 3 ερωτήσεων με 12 δευτερόλεπτα ανά ερώτηση με άλλον παίκτη. Ο νικητής επιλέγει ',
        steal: 'Steal',
        p1Mid: ' (παίρνει πόντους από τον ηττημένο) ή ',
        double: 'Double',
        p1Post: ' (προσθέτει πόντους στον εαυτό του). Δύο τρόπαια — Μονομάχος και Κλέφτης — κρίνονται εδώ.',
        p2Before: 'Όλοι οι κανόνες και η βαθμολογία στη ',
        p2Link: 'σελίδα μονομαχιών',
        p2After: '.',
      },
      dashboard: {
        title: 'Ζωντανό Dashboard',
        p1:
          'Το Dashboard είναι ο πίνακας βαθμολογίας που είναι πάντα ορατός και ενημερώνεται με push τη στιγμή που λύνεται οποιαδήποτε από τις τέσσερις πηγές — προβλέψεις, quiz, κερδισμένες μονομαχίες, κλεμμένοι πόντοι. Πάτα έναν παίκτη για να δεις την ανάλυση ανά πηγή. Δεν υπάρχει refresh ούτε spectator mode· όλοι στο δωμάτιο βλέπουν τα ίδια σύνολα την ίδια στιγμή.',
        p2Before: 'Πλήρης ανάλυση στη ',
        p2Link: 'σελίδα Dashboard',
        p2After: '.',
      },
      trophies: {
        title: 'Τρόπαια — πέντε νικητές κάθε βραδιά',
        intro:
          'Το Eurovision Games δεν στέφει έναν νικητή — στέφει πέντε. Αφού καταχωρηθεί το επίσημο αποτέλεσμα της Eurovision, οι κάρτες των τροπαίων αποκαλύπτονται μία προς μία:',
        bullets: [
          { strong: 'Πρωταθλητής', rest: ' — υψηλότερο σύνολο και στις τέσσερις πηγές.' },
          { strong: 'Μάντης', rest: ' — καλύτερη βαθμολογία πρόβλεψης Top 5.' },
          { strong: 'Γκουρού', rest: ' — υψηλότερη βαθμολογία quiz στους τρεις γύρους.' },
          { strong: 'Μονομάχος', rest: ' — οι περισσότερες κερδισμένες μονομαχίες της βραδιάς.' },
          { strong: 'Κλέφτης', rest: ' — οι περισσότεροι πόντοι που πάρθηκαν με Steal.' },
        ],
      },
      free: {
        title: 'Δωρεάν, χωρίς install, χωρίς λογαριασμό',
        intro:
          'Το Eurovision Games είναι δωρεάν και έχει χτιστεί έτσι ώστε να εξαλείφει κάθε λόγο που θα έκανε έναν καλεσμένο να τα παρατήσει πριν το πρώτο τραγούδι.',
        bullets: [
          { strong: 'Μέσα στον browser.', rest: ' Σε κάθε σύγχρονο browser, σε iOS, Android ή desktop.' },
          {
            strong: 'PWA με προτεραιότητα στο κινητό.',
            rest: ' Πρόσθεσέ το στην αρχική οθόνη αν θες, αλλά δεν είναι απαραίτητο.',
          },
          {
            strong: 'Εγγραφή μόνο για τον οικοδεσπότη.',
            rest: ' Ο οικοδεσπότης κάνει login μία φορά· οι καλεσμένοι απλώς γράφουν τον κωδικό δωματίου και ένα όνομα.',
          },
          {
            strong: '2\u201320 παίκτες.',
            rest: ' Ιδανικό σημείο τα 6\u201310 — αρκετή ποικιλία χωρίς να βαρετιάζει η εναλλαγή trivia.',
          },
        ],
      },
      faq: { title: 'Συχνές ερωτήσεις' },
    },
    faq: [
      {
        q: 'Είναι όντως δωρεάν το Eurovision Games;',
        a: 'Ναι. Χωρίς συνδρομή, χωρίς αγορές εντός εφαρμογής, χωρίς εγγραφή για τους καλεσμένους που μπαίνουν. Ο οικοδεσπότης κάνει login μία φορά με email ώστε να αποθηκευτεί το δωμάτιο· οι παίκτες χρειάζονται μόνο τον κωδικό δωματίου.',
      },
      {
        q: 'Πόσοι παίκτες μπορούν να μπουν;',
        a: 'Από δύο έως είκοσι ανά δωμάτιο. Ιδανικό σημείο τα έξι έως δέκα — αρκετή ποικιλία στις προβλέψεις και τις μονομαχίες χωρίς να βαρετιάζει η εναλλαγή trivia σε μια τετράωρη εκπομπή.',
      },
      {
        q: 'Λειτουργεί στο κινητό;',
        a: 'Ναι. Είναι ένα mobile-first PWA που τρέχει σε κάθε σύγχρονο browser σε iOS, Android ή desktop. Χωρίς εγκατάσταση από app store — οι παίκτες απλώς ανοίγουν τον σύνδεσμο, γράφουν τον κωδικό δωματίου και παίζουν.',
      },
      {
        q: 'Χρειάζονται οι παίκτες λογαριασμό;',
        a: 'Όχι. Μόνο ο οικοδεσπότης δημιουργεί δωρεάν λογαριασμό (email ή Google). Οι καλεσμένοι μπαίνουν με τον κωδικό δωματίου και ένα όνομα εμφάνισης· τίποτα δεν αποθηκεύεται για αυτούς ανάμεσα στις βραδιές, εκτός αν επιλέξουν να εγγραφούν.',
      },
      {
        q: 'Έχει σχέση με την EBU ή την επίσημη Eurovision Song Contest;',
        a: 'Όχι. Το Eurovision Games είναι ένα ανεξάρτητο fan project. Τα Eurovision Song Contest, ESC και το λογότυπο με την καρδιά είναι σήματα κατατεθέντα της European Broadcasting Union. Χρησιμοποιούμε τα δεδομένα χωρών και τραγουδιών μόνο για να βαθμολογήσουμε τις προβλέψεις σου.',
      },
      {
        q: 'Πόσο διαρκεί μια ολόκληρη βραδιά;',
        a: 'Περίπου τέσσερις ώρες, σε αντιστοιχία με τη μετάδοση. Οι προβλέψεις κλειδώνουν πριν το πρώτο τραγούδι, το quiz τρέχει στο pre-show, οι μονομαχίες τρέχουν στα διαφημιστικά διαλείμματα και στο interval, τα αποτελέσματα δημοσιεύονται ζωντανά και τα τρόπαια αποκαλύπτονται μετά την ανακοίνωση του νικητή.',
      },
    ],
    cta: {
      title: 'Δοκίμασε το Eurovision Games απόψε',
      body: 'Εκκίνηση σε 60 δευτερόλεπτα, ο τέλειος σύντροφος για τη βραδιά Eurovision.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Πώς παίζεις',
    },
    related: {
      heading: 'Συνέχισε την ανάγνωση',
      items: [
        {
          href: '/eurovision-2026-predictions',
          title: 'Προβλέψεις',
          blurb: 'Κλείδωσε Top 5 και Worst 5 πριν την εκπομπή — η μηχανή των 500 πόντων της βραδιάς.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Trivia',
          blurb: 'Δείγματα ερωτήσεων και η τράπεζα από όπου τραβάνε quiz και μονομαχίες.',
        },
        {
          href: '/duels',
          title: 'Μονομαχίες',
          blurb: 'Μάχες 3 ερωτήσεων ένας προς έναν στη ζωντανή εκπομπή. Steal ή Double.',
        },
        {
          href: '/dashboard',
          title: 'Dashboard',
          blurb: 'Ο ζωντανός πίνακας βαθμολογίας που παρακολουθούν όλοι. Push-updated, χωρίς refresh.',
        },
        {
          href: '/how-to-play',
          title: 'Πώς παίζεις',
          blurb: 'Οδηγός εκκίνησης 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.',
        },
        {
          href: '/eurovision-night',
          title: 'Βραδιά Eurovision',
          blurb: 'Πώς εντάσσονται τα τέσσερα παιχνίδια στην τετράωρη μετάδοση.',
        },
        {
          href: '/eurovision-party',
          title: 'Πάρτι Eurovision',
          blurb: 'Οδηγός διοργάνωσης — χώρος, φαγητό, σειρά εμφάνισης και ποια παιχνίδια να βάλεις πάνω.',
        },
      ],
    },
  },
};
