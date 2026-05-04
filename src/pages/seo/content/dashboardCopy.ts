import type { Locale } from '../../../lib/seo/locale';

export interface DashboardCopy {
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
    shows: {
      title: string;
      intro: string;
      bullets: { strong: string; rest: string }[];
    };
    sources: {
      title: string;
      intro: string;
      tableHeaders: [string, string, string];
      rows: {
        source: string;
        when: string;
        capLabel: string; // either a number string or "open"
        capIsOpen: boolean;
      }[];
      footer: { before: string; linkLabel: string; after: string };
    };
    activity: {
      title: string;
      bullets: { strong: string; rest: string }[];
    };
    notShown: {
      title: string;
      intro: string;
      bullets: { strong: string; rest: string }[];
    };
    hostVsPlayer: {
      title: string;
      body: string;
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

export const copy: Record<Locale, DashboardCopy> = {
  en: {
    meta: {
      title: 'Dashboard \u2014 Live Leaderboard for Eurovision Games',
      description:
        'The Dashboard is the live leaderboard for your Eurovision Games room. Push-updated as predictions resolve, quiz answers land, and duels finish — no refresh.',
      headline: 'The Eurovision Games Dashboard — Live Leaderboard Explained',
      articleDescription:
        'How the live Dashboard leaderboard works in a Eurovision Games room: what it shows, when it updates, and the four point sources that flow into it.',
      keywords: [
        'eurovision games dashboard',
        'eurovision live leaderboard',
        'eurovision party score tracker',
        'eurovision games scores',
      ],
    },
    crumbs: { home: 'Home', current: 'Dashboard' },
    hero: {
      chip: 'Live leaderboard',
      title: 'The Dashboard — your live Eurovision leaderboard',
      lede:
        'The Dashboard is the heartbeat of every Eurovision Games room. It is the always-visible leaderboard that updates in real time — every prediction that resolves, every quiz answer, every duel finish pushes new totals to everyone in the room without a refresh.',
    },
    sections: {
      shows: {
        title: 'What the Dashboard shows',
        intro:
          'One screen, every player, ranked by total points and updated as the night unfolds. The Dashboard is the single source of truth for who is winning — and by how much.',
        bullets: [
          { strong: 'Total points', rest: ' per player, ranked highest to lowest.' },
          { strong: 'Live rank arrows', rest: ' next to each player when their position changes.' },
          {
            strong: 'Source split',
            rest: ' on tap: predictions, quiz, duels won, points stolen, trophy bonuses.',
          },
          { strong: 'Phase indicator', rest: ' — Lobby, Predictions, Quiz, Live Show, Results, Winners.' },
          { strong: 'You-vs-leader gap', rest: ' chip — exactly how far you are from first place.' },
        ],
      },
      sources: {
        title: 'How the four point sources flow into the Dashboard',
        intro:
          'Your total on the Dashboard is the sum of four live components. Each has its own update trigger and its own cap, which keeps any single mode from running away with the night.',
        tableHeaders: ['Source', 'When it updates', 'Cap'],
        rows: [
          {
            source: 'Predictions (Top 5 + Worst 5)',
            when: 'Host enters Eurovision results, or they update automatically',
            capLabel: '500',
            capIsOpen: false,
          },
          { source: 'Quiz', when: 'Each round ends', capLabel: '360', capIsOpen: false },
          { source: 'Duels — won', when: 'Each duel finishes', capLabel: 'open', capIsOpen: true },
          { source: 'Duels — stolen', when: 'Each Steal finishes', capLabel: 'open', capIsOpen: true },
        ],
        footer: {
          before:
            'Predictions and Quiz are bounded; duels are uncapped on purpose so that an underdog can claw back the lead in the final ad break. See the ',
          linkLabel: 'full scoring page',
          after: ' for the formulas.',
        },
      },
      activity: {
        title: 'When the Dashboard is most active',
        bullets: [
          {
            strong: 'Quiz round end.',
            rest: ' Sudden vertical jumps as ten questions resolve at once and the standings reshuffle.',
          },
          {
            strong: 'Live results entry.',
            rest: ' Biggest swings of the night as 26+ predictions auto-score against jury and televote totals.',
          },
          {
            strong: 'Live duels.',
            rest: ' Small but constant updates as challenges fire and resolve in commercial breaks.',
          },
          {
            strong: 'Trophy reveal.',
            rest: ' Final stack as Champion / Thief / Duelist / Oracle / Guru bonuses post.',
          },
        ],
      },
      notShown: {
        title: 'What the Dashboard does NOT show',
        intro:
          "A few things stay deliberately hidden so the night stays competitive — the Dashboard is a leaderboard, not a spreadsheet of everybody's working.",
        bullets: [
          {
            strong: "Other players' Top 5 / Worst 5 picks",
            rest: ' before they lock — those stay private until the host advances out of the Predictions phase.',
          },
          {
            strong: 'Duel questions in progress',
            rest:
              ' — only the two participants see the quiz items; everyone else sees a discreet "duel in progress" chip.',
          },
          {
            strong: 'Trophy winners ahead of time',
            rest: ' — Champion, Thief, Duelist, Oracle, and Guru are revealed at the end on a dedicated Winners screen.',
          },
        ],
      },
      hostVsPlayer: {
        title: 'Hosting view vs player view',
        body:
          'The host sees one extra control on the Dashboard — a phase advance button that walks the room from Lobby through Predictions, Quiz, Live Show, Results, and Winners. Players see the same leaderboard but no controls. Everyone\u2019s totals are identical; there is no "hidden host bonus."',
      },
      faq: { title: 'Frequently asked questions' },
    },
    faq: [
      {
        q: 'What is the Dashboard?',
        a: 'The Dashboard is the always-visible leaderboard that updates in real time as predictions resolve, quiz answers come in, and duels finish. It shows every player ranked by total points across all four sources: predictions, quiz, duels, and trophy bonuses.',
      },
      {
        q: 'When does the Dashboard update?',
        a: 'Live, push-driven. Quiz answers update on submission; duels update on finish; predictions update as the host enters Eurovision results (or as they update automatically). No refresh needed.',
      },
      {
        q: 'Can I see the breakdown per player?',
        a: 'Yes. Tap a player on the Dashboard to see their points split into prediction, quiz, duel-won, duel-stolen, and trophy components — useful for arguing about who actually deserved Champion.',
      },
      {
        q: 'Who can see the Dashboard?',
        a: 'Every player in the room sees the same live leaderboard. There is no spectator mode — Eurovision Games is for participants, not lurkers.',
      },
    ],
    cta: {
      title: 'Open the Dashboard live',
      body: 'Spin up a room — every move you make shows up on it instantly.',
      primary: 'Create',
      secondary: 'How to play',
    },
    related: {
      heading: 'Keep reading',
      items: [
        {
          href: '/eurovision-2026-predictions',
          title: 'Predictions',
          blurb: 'Top 5 and Worst 5 — the biggest single feeder into the Dashboard.',
        },
        { href: '/duels', title: 'Duels', blurb: 'Head-to-head trivia battles that drive the live ad-break swings.' },
        {
          href: '/eurovision-trivia',
          title: 'Trivia',
          blurb: 'Quiz round samples and how the 360-point cap is structured.',
        },
        { href: '/scoring', title: 'Scoring', blurb: 'The full formulas behind every number on the Dashboard.' },
        { href: '/how-to-play', title: 'How to play', blurb: 'Setup walkthrough from create-room to trophy reveal.' },
        {
          href: '/eurovision-night',
          title: 'Eurovision Night',
          blurb: 'How the Dashboard fits into the four-hour run-of-show.',
        },
      ],
    },
  },
  el: {
    meta: {
      title: 'Dashboard \u2014 ζωντανός πίνακας βαθμολογίας για το Eurovision Games',
      description:
        'Το Dashboard είναι ο ζωντανός πίνακας βαθμολογίας του δωματίου σου στο Eurovision Games. Ενημερώνεται αυτόματα όταν λύνονται προβλέψεις, μπαίνουν απαντήσεις στο quiz και τελειώνουν μονομαχίες — χωρίς refresh.',
      headline: 'Το Dashboard του Eurovision Games — ο ζωντανός πίνακας βαθμολογίας',
      articleDescription:
        'Πώς δουλεύει το ζωντανό Dashboard σε ένα δωμάτιο Eurovision Games: τι δείχνει, πότε ενημερώνεται και οι τέσσερις πηγές πόντων που τροφοδοτούν τη βαθμολογία.',
      keywords: [
        'eurovision games dashboard',
        'eurovision ζωντανός πίνακας βαθμολογίας',
        'eurovision party score tracker',
        'βαθμολογία eurovision games',
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Dashboard' },
    hero: {
      chip: 'Ζωντανός πίνακας βαθμολογίας',
      title: 'Dashboard — ζωντανός πίνακας βαθμολογίας',
      lede:
        'Το Dashboard είναι ο παλμός κάθε δωματίου Eurovision Games. Ο πίνακας βαθμολογίας που είναι πάντα ορατός και ενημερώνεται σε πραγματικό χρόνο — κάθε πρόβλεψη που λύνεται, κάθε απάντηση στο quiz, κάθε μονομαχία που τελειώνει στέλνει νέα σύνολα σε όλους στο δωμάτιο, χωρίς refresh.',
    },
    sections: {
      shows: {
        title: 'Τι δείχνει το Dashboard',
        intro:
          'Μία οθόνη, όλοι οι παίκτες, σε κατάταξη με βάση τους συνολικούς πόντους και ενημέρωση όσο εξελίσσεται η βραδιά. Το Dashboard είναι η μοναδική πηγή αλήθειας για το ποιος προηγείται — και με πόση διαφορά.',
        bullets: [
          { strong: 'Συνολικοί πόντοι', rest: ' ανά παίκτη, σε κατάταξη από τον υψηλότερο στον χαμηλότερο.' },
          { strong: 'Ζωντανά βέλη κατάταξης', rest: ' δίπλα σε κάθε παίκτη όταν αλλάζει η θέση του.' },
          {
            strong: 'Ανάλυση πηγών',
            rest: ' με ένα tap: προβλέψεις, quiz, μονομαχίες που κερδήθηκαν, πόντοι που κλάπηκαν, μπόνους τροπαίων.',
          },
          { strong: 'Δείκτης φάσης', rest: ' — Λόμπι, Προβλέψεις, Quiz, Ζωντανή Εκπομπή, Αποτελέσματα, Νικητές.' },
          { strong: 'Διαφορά από τον πρώτο', rest: ' σε chip — ακριβώς πόσο μακριά είσαι από την πρώτη θέση.' },
        ],
      },
      sources: {
        title: 'Πώς οι τέσσερις πηγές πόντων τροφοδοτούν το Dashboard',
        intro:
          'Το σύνολό σου στο Dashboard είναι το άθροισμα τεσσάρων ζωντανών συνιστωσών. Καθεμία έχει το δικό της trigger ενημέρωσης και το δικό της όριο, που εμποδίζει οποιαδήποτε μεμονωμένη λειτουργία να μονοπωλήσει τη βραδιά.',
        tableHeaders: ['Πηγή', 'Πότε ενημερώνεται', 'Όριο'],
        rows: [
          {
            source: 'Προβλέψεις (Top 5 + Worst 5)',
            when: 'Ο οικοδεσπότης καταχωρεί τα αποτελέσματα της Eurovision ή ενημερώνονται αυτόματα',
            capLabel: '500',
            capIsOpen: false,
          },
          { source: 'Quiz', when: 'Στο τέλος κάθε γύρου', capLabel: '360', capIsOpen: false },
          { source: 'Μονομαχίες — κερδισμένες', when: 'Στο τέλος κάθε μονομαχίας', capLabel: 'ανοιχτό', capIsOpen: true },
          { source: 'Μονομαχίες — κλεμμένες', when: 'Στο τέλος κάθε Steal', capLabel: 'ανοιχτό', capIsOpen: true },
        ],
        footer: {
          before:
            'Οι Προβλέψεις και το Quiz έχουν όριο· οι μονομαχίες είναι σκόπιμα χωρίς όριο, ώστε ένας αουτσάιντερ να μπορεί να κερδίσει έδαφος στο τελευταίο διαφημιστικό. Δες την ',
          linkLabel: 'πλήρη σελίδα βαθμολογίας',
          after: ' για τους τύπους.',
        },
      },
      activity: {
        title: 'Πότε το Dashboard είναι πιο ενεργό',
        bullets: [
          {
            strong: 'Τέλος γύρου quiz.',
            rest: ' Απότομα κατακόρυφα άλματα όταν λύνονται δέκα ερωτήσεις μαζί και αναδιατάσσεται η κατάταξη.',
          },
          {
            strong: 'Καταχώρηση ζωντανών αποτελεσμάτων.',
            rest: ' Τα μεγαλύτερα swings της βραδιάς, καθώς 26+ προβλέψεις βαθμολογούνται αυτόματα έναντι των συνόλων κριτικής επιτροπής και televote.',
          },
          {
            strong: 'Ζωντανές μονομαχίες.',
            rest: ' Μικρές αλλά συνεχείς ενημερώσεις καθώς οι προκλήσεις ξεκινούν και λύνονται στα διαφημιστικά διαλείμματα.',
          },
          {
            strong: 'Αποκάλυψη τροπαίων.',
            rest: ' Τελική στοίβα καθώς δημοσιεύονται τα μπόνους Πρωταθλητής / Κλέφτης / Μονομάχος / Μάντης / Γκουρού.',
          },
        ],
      },
      notShown: {
        title: 'Τι ΔΕΝ δείχνει το Dashboard',
        intro:
          'Μερικά πράγματα παραμένουν σκοπίμως κρυφά για να μένει ανταγωνιστική η βραδιά — το Dashboard είναι πίνακας βαθμολογίας, όχι spreadsheet με τις σημειώσεις του καθενός.',
        bullets: [
          {
            strong: 'Τις επιλογές Top 5 / Worst 5 των άλλων παικτών',
            rest: ' πριν κλειδώσουν — μένουν ιδιωτικές μέχρι ο οικοδεσπότης να προχωρήσει από τη φάση Προβλέψεων.',
          },
          {
            strong: 'Ερωτήσεις μονομαχίας σε εξέλιξη',
            rest:
              ' — μόνο οι δύο συμμετέχοντες βλέπουν τις ερωτήσεις· όλοι οι άλλοι βλέπουν ένα διακριτικό chip "μονομαχία σε εξέλιξη".',
          },
          {
            strong: 'Τους νικητές τροπαίων εκ των προτέρων',
            rest:
              ' — Πρωταθλητής, Κλέφτης, Μονομάχος, Μάντης και Γκουρού αποκαλύπτονται στο τέλος, σε ξεχωριστή οθόνη Νικητών.',
          },
        ],
      },
      hostVsPlayer: {
        title: 'Όψη οικοδεσπότη vs όψη παίκτη',
        body:
          'Ο οικοδεσπότης βλέπει ένα επιπλέον χειριστήριο στο Dashboard — ένα κουμπί μετάβασης φάσης που οδηγεί το δωμάτιο από το Λόμπι στις Προβλέψεις, στο Quiz, στη Ζωντανή Εκπομπή, στα Αποτελέσματα και στους Νικητές. Οι παίκτες βλέπουν τον ίδιο πίνακα αλλά χωρίς χειριστήρια. Τα σύνολα όλων είναι πανομοιότυπα· δεν υπάρχει "κρυφό μπόνους οικοδεσπότη".',
      },
      faq: { title: 'Συχνές ερωτήσεις' },
    },
    faq: [
      {
        q: 'Τι είναι το Dashboard;',
        a: 'Το Dashboard είναι ο πίνακας βαθμολογίας που είναι πάντα ορατός και ενημερώνεται σε πραγματικό χρόνο, καθώς λύνονται προβλέψεις, μπαίνουν απαντήσεις στο quiz και τελειώνουν μονομαχίες. Δείχνει κάθε παίκτη σε κατάταξη με βάση τους συνολικούς πόντους από τις τέσσερις πηγές: προβλέψεις, quiz, μονομαχίες και μπόνους τροπαίων.',
      },
      {
        q: 'Πότε ενημερώνεται το Dashboard;',
        a: 'Ζωντανά, με push. Οι απαντήσεις στο quiz ενημερώνουν με την υποβολή· οι μονομαχίες με την ολοκλήρωση· οι προβλέψεις καθώς ο οικοδεσπότης καταχωρεί τα αποτελέσματα της Eurovision (ή καθώς ενημερώνονται αυτόματα). Δεν χρειάζεται refresh.',
      },
      {
        q: 'Μπορώ να δω την ανάλυση ανά παίκτη;',
        a: 'Ναι. Πάτα έναν παίκτη στο Dashboard για να δεις τους πόντους του χωρισμένους σε προβλέψεις, quiz, κερδισμένες μονομαχίες, κλεμμένους πόντους και τρόπαια — χρήσιμο για να συζητάς ποιος πραγματικά άξιζε τον τίτλο του Πρωταθλητή.',
      },
      {
        q: 'Ποιος βλέπει το Dashboard;',
        a: 'Όλοι οι παίκτες στο δωμάτιο βλέπουν τον ίδιο ζωντανό πίνακα. Δεν υπάρχει spectator mode — το Eurovision Games είναι για συμμετέχοντες, όχι για παρατηρητές.',
      },
    ],
    cta: {
      title: 'Άνοιξε ζωντανά το Dashboard',
      body: 'Στήσε ένα δωμάτιο — κάθε κίνηση που κάνεις εμφανίζεται αμέσως πάνω του.',
      primary: 'Δημιουργία',
      secondary: 'Πώς παίζεις',
    },
    related: {
      heading: 'Συνέχισε την ανάγνωση',
      items: [
        {
          href: '/eurovision-2026-predictions',
          title: 'Προβλέψεις',
          blurb: 'Top 5 και Worst 5 — η μεγαλύτερη πηγή πόντων που τροφοδοτεί το Dashboard.',
        },
        {
          href: '/duels',
          title: 'Μονομαχίες',
          blurb: 'Μάχες trivia ένας προς έναν που οδηγούν τα ζωντανά swings στα διαφημιστικά.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Trivia',
          blurb: 'Δείγματα γύρων quiz και πώς δομείται το όριο των 360 πόντων.',
        },
        { href: '/scoring', title: 'Βαθμολογία', blurb: 'Όλοι οι τύποι πίσω από κάθε αριθμό στο Dashboard.' },
        {
          href: '/how-to-play',
          title: 'Πώς παίζεις',
          blurb: 'Οδηγός εκκίνησης από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.',
        },
        {
          href: '/eurovision-night',
          title: 'Βραδιά Eurovision',
          blurb: 'Πώς εντάσσεται το Dashboard στη σειρά εμφάνισης τεσσάρων ωρών.',
        },
      ],
    },
  },
};
