import type { Locale } from '../../../lib/seo/locale';

interface PredictionsFaq {
  q: string;
  a: string;
}

interface PredictionsCopy {
  meta: {
    title: string;
    description: string;
    schemaTitle: string;
    schemaDescription: string;
    keywords: string[];
  };
  crumbs: { home: string; predictions: string };
  hero: { chip: string; title: string; lede: string };
  sections: {
    lineup: {
      title: string;
      intro: (n: number) => string;
      hostSuffix: string;
      withdrawnPre: string;
      withdrawnPost: string;
      runningOrder: string;
    };
    format: {
      title: string;
      intro: string;
      top5Label: string;
      top5Body: string;
      worst5Label: string;
      worst5Body: string;
      orderedPre: string;
      orderedEm: string;
      orderedPost: string;
    };
    scoringTop5: {
      title: string;
      intro: string;
      headers: { result: string; points: string };
      rows: { exact: string; inListWrong: string; outside: string };
      max: { pre: string; post: string };
    };
    scoringWorst5: {
      title: string;
      intro: string;
      headers: { result: string; points: string };
      rows: { exact: string; inListWrong: string; outside: string };
      max: { pre: string; cap: string };
    };
    strategy: {
      title: string;
      tips: { strong: string; rest: string }[];
    };
    faqTitle: string;
  };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    night: { title: string; blurb: string };
    trivia: { title: string; blurb: string };
    duels: { title: string; blurb: string };
    scoring: { title: string; blurb: string };
    howToPlay: { title: string; blurb: string };
    faq: { title: string; blurb: string };
  };
  withdrawn: string[];
  faq: PredictionsFaq[];
}

export const copy: Record<Locale, PredictionsCopy> = {
  en: {
    meta: {
      title: 'Eurovision 2026 Predictions — Top 5 / Worst 5 Format & Strategy',
      description:
        'A complete predictions guide for Eurovision 2026 in Vienna: the competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips.',
      schemaTitle: 'Eurovision 2026 Predictions — Top 5 / Worst 5 Format',
      schemaDescription:
        'A complete predictions guide for Eurovision 2026 in Vienna: the competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips.',
      keywords: [
        'eurovision 2026 predictions',
        'eurovision 2026 top 5',
        'eurovision 2026 worst 5',
        'eurovision predictions game',
        'eurovision 2026 lineup',
      ],
    },
    crumbs: { home: 'Home', predictions: '2026 predictions' },
    hero: {
      chip: '2026 format',
      title: 'Eurovision 2026 predictions — Top 5 and Worst 5 format',
      lede:
        "Eurovision 2026 takes place in Vienna, Austria on Saturday 16 May 2026, hosted by ORF after JJ\u2019s 2025 win in Basel. In Eurovision Games each player builds two prediction lists — Top 5 and Worst 5 — before the show starts, then watches them auto-score against the official jury and televote results in real time.",
    },
    sections: {
      lineup: {
        title: 'The 2026 line-up',
        intro: (n) => `${n} countries are confirmed for Eurovision 2026 across two semi-finals and the grand final:`,
        hostSuffix: ' (host)',
        withdrawnPre: 'Withdrawn / boycotting in 2026: ',
        withdrawnPost:
          '. Spain\u2019s exit shrinks the "Big Five" to a Big Four (France, Germany, Italy, United Kingdom).',
        runningOrder:
          'The grand-final running order is fixed after the second semi-final; this page updates with live entries once the parser publishes them.',
      },
      format: {
        title: 'Prediction format',
        intro: 'Each player builds two lists before the host advances the lobby phase:',
        top5Label: 'Top 5',
        top5Body: 'five countries you think will finish highest in the combined jury + televote.',
        worst5Label: 'Worst 5',
        worst5Body: 'five countries you think will finish lowest.',
        orderedPre: 'Lists are ',
        orderedEm: 'ordered',
        orderedPost:
          ': a #1 pick that wins scores more than a #5 pick that wins. You cannot put the same country in both lists. Lists lock when the host clicks Advance to Predictions Locked.',
      },
      scoringTop5: {
        title: 'Scoring — Top 5',
        intro: 'For each Top-5 pick, you score against the official combined jury + televote ranking:',
        headers: { result: 'Result', points: 'Points' },
        rows: {
          exact: 'Country at the exact position you predicted',
          inListWrong: 'Country in the official Top 5 but at a different position',
          outside: 'Country outside the Top 5',
        },
        max: { pre: 'Maximum Top-5 points: 5 exact positions × 50 = ', post: '250' },
      },
      scoringWorst5: {
        title: 'Scoring — Worst 5',
        intro: 'Worst-5 is symmetrical — last place counts as position 1 in your list:',
        headers: { result: 'Result', points: 'Points' },
        rows: {
          exact: 'Country at the exact bottom position you predicted',
          inListWrong: 'Country in the official Worst 5 but at a different position',
          outside: 'Country outside the Worst 5',
        },
        max: { pre: 'Maximum Worst-5 points: 250. Combined predictions cap: ', cap: '500' },
      },
      strategy: {
        title: 'Strategy tips',
        tips: [
          {
            strong: "Trust the betting markets, but don\u2019t copy them.",
            rest:
              ' Top-3 favourites usually deliver, but the #4-#10 range is where rankings re-shuffle wildly between jury and televote.',
          },
          {
            strong: 'Worst 5 is where games are won.',
            rest:
              ' Most players over-think the top and ignore the bottom. Three correct Worst-5 picks = 30 free points.',
          },
          {
            strong: 'Watch the semi-final running order.',
            rest:
              " Late slots in the second semi tend to make grand-final spots they don\u2019t deserve — they\u2019re fresh in jury memory.",
          },
          {
            strong: "Don\u2019t bet against the host.",
            rest: " Austria 2026 won\u2019t win, but they probably won\u2019t bottom either.",
          },
        ],
      },
      faqTitle: 'Frequently asked questions',
    },
    cta: {
      title: 'Lock your Top 5 before kick-off',
      body: 'Create a room and invite up to 19 friends to predict.',
      primary: 'Create',
      secondary: 'How to play',
    },
    related: {
      night: { title: 'Eurovision night', blurb: 'The 10-step playbook for hosting a watch party.' },
      trivia: { title: 'Eurovision trivia', blurb: '10 sample questions and how the live bank works.' },
      duels: { title: 'Eurovision duels', blurb: 'Head-to-head 3-question duels during the live show.' },
      scoring: { title: 'Scoring formulas', blurb: 'Where predictions, duels, and quiz feed into the Champion total.' },
      howToPlay: { title: 'How to play', blurb: 'The 60-second walkthrough from create-room to trophy reveal.' },
      faq: { title: 'FAQ', blurb: 'Answers to common questions about hosting, joining, and scoring.' },
    },
    withdrawn: ['Iceland', 'Ireland', 'Netherlands', 'Slovenia', 'Spain'],
    faq: [
      {
        q: 'Can I change my list?',
        a: 'Up until the host advances the phase. After that, locked.',
      },
      {
        q: 'What about semi-final exits?',
        a: 'Eurovision Games scores against the grand-final result. Countries that don\u2019t qualify count as "outside Top 5" — zero points if you picked them.',
      },
      {
        q: 'How does the app know the results?',
        a: 'The host enters jury and televote results live during the show; or the auto-parser pulls them from the official source.',
      },
    ],
  },
  el: {
    meta: {
      title: 'Προβλέψεις Eurovision 2026 — Φόρμα Top 5 / Worst 5 και Στρατηγική',
      description:
        'Ένας πλήρης οδηγός προβλέψεων για την Eurovision 2026 στη Βιέννη: οι συμμετέχουσες χώρες, η φόρμα Top 5 / Worst 5, μαθηματικά βαθμολογίας και συμβουλές στρατηγικής.',
      schemaTitle: 'Προβλέψεις Eurovision 2026 — Φόρμα Top 5 / Worst 5',
      schemaDescription:
        'Ένας πλήρης οδηγός προβλέψεων για την Eurovision 2026 στη Βιέννη: οι συμμετέχουσες χώρες, η φόρμα Top 5 / Worst 5, μαθηματικά βαθμολογίας και συμβουλές στρατηγικής.',
      keywords: [
        'προβλέψεις eurovision 2026',
        'eurovision 2026 top 5',
        'eurovision 2026 worst 5',
        'παιχνίδι προβλέψεων eurovision',
        'λίστα χωρών eurovision 2026',
      ],
    },
    crumbs: { home: 'Αρχική', predictions: 'Προβλέψεις 2026' },
    hero: {
      chip: 'Φόρμα 2026',
      title: 'Προβλέψεις Eurovision 2026 — Φόρμα Top 5 και Worst 5',
      lede:
        'Η Eurovision 2026 διεξάγεται στη Βιέννη της Αυστρίας το Σάββατο 16 Μαΐου 2026, με οικοδεσπότη τον ORF μετά τη νίκη του JJ το 2025 στη Βασιλεία. Στο Eurovision Games κάθε παίκτης φτιάχνει δύο λίστες προβλέψεων — Top 5 και Worst 5 — πριν ξεκινήσει η εκπομπή, και τις βλέπει να βαθμολογούνται αυτόματα σε πραγματικό χρόνο με βάση τα επίσημα αποτελέσματα κριτικής επιτροπής και televote.',
    },
    sections: {
      lineup: {
        title: 'Η λίστα του 2026',
        intro: (n) =>
          `${n} χώρες έχουν επιβεβαιωθεί για την Eurovision 2026 σε δύο ημιτελικούς και τον μεγάλο τελικό:`,
        hostSuffix: ' (οικοδεσπότης)',
        withdrawnPre: 'Έχουν αποχωρήσει / κάνουν μποϊκοτάζ το 2026: ',
        withdrawnPost:
          '. Η αποχώρηση της Ισπανίας μειώνει τους «Big Five» σε Big Four (Γαλλία, Γερμανία, Ιταλία, Ηνωμένο Βασίλειο).',
        runningOrder:
          'Η σειρά εμφάνισης του μεγάλου τελικού οριστικοποιείται μετά τον δεύτερο ημιτελικό· η σελίδα ενημερώνεται με ζωντανές συμμετοχές μόλις τις δημοσιεύσει ο parser.',
      },
      format: {
        title: 'Φόρμα προβλέψεων',
        intro: 'Κάθε παίκτης φτιάχνει δύο λίστες πριν ο οικοδεσπότης προχωρήσει τη φάση lobby:',
        top5Label: 'Top 5',
        top5Body:
          'πέντε χώρες που πιστεύεις ότι θα τερματίσουν ψηλότερα στον συνδυασμό κριτικής επιτροπής + televote.',
        worst5Label: 'Worst 5',
        worst5Body: 'πέντε χώρες που πιστεύεις ότι θα τερματίσουν χαμηλότερα.',
        orderedPre: 'Οι λίστες είναι ',
        orderedEm: 'ταξινομημένες',
        orderedPost:
          ': ένα #1 pick που νικά βαθμολογείται περισσότερο από ένα #5 pick που νικά. Δεν μπορείς να βάλεις την ίδια χώρα και στις δύο λίστες. Οι λίστες κλειδώνουν όταν ο οικοδεσπότης πατήσει Advance to Predictions Locked.',
      },
      scoringTop5: {
        title: 'Βαθμολογία — Top 5',
        intro:
          'Για κάθε Top-5 pick, βαθμολογείσαι σε σχέση με την επίσημη συνδυασμένη κατάταξη κριτικής επιτροπής + televote:',
        headers: { result: 'Αποτέλεσμα', points: 'Πόντοι' },
        rows: {
          exact: 'Χώρα στην ακριβή θέση που προέβλεψες',
          inListWrong: 'Χώρα στο επίσημο Top 5 αλλά σε διαφορετική θέση',
          outside: 'Χώρα εκτός Top 5',
        },
        max: { pre: 'Μέγιστοι πόντοι Top-5: 5 ακριβείς θέσεις × 50 = ', post: '250' },
      },
      scoringWorst5: {
        title: 'Βαθμολογία — Worst 5',
        intro: 'Το Worst-5 είναι συμμετρικό — η τελευταία θέση μετράει ως θέση 1 στη λίστα σου:',
        headers: { result: 'Αποτέλεσμα', points: 'Πόντοι' },
        rows: {
          exact: 'Χώρα στην ακριβή θέση πάτου που προέβλεψες',
          inListWrong: 'Χώρα στο επίσημο Worst 5 αλλά σε διαφορετική θέση',
          outside: 'Χώρα εκτός Worst 5',
        },
        max: {
          pre: 'Μέγιστοι πόντοι Worst-5: 250. Συνολικό cap προβλέψεων: ',
          cap: '500',
        },
      },
      strategy: {
        title: 'Συμβουλές στρατηγικής',
        tips: [
          {
            strong: 'Εμπιστεύσου τις αγορές στοιχημάτων, αλλά μην τις αντιγράφεις.',
            rest:
              ' Τα top-3 φαβορί συνήθως ανταποκρίνονται, αλλά το εύρος #4-#10 είναι εκεί όπου οι κατατάξεις ανακατεύονται έντονα ανάμεσα σε κριτική επιτροπή και televote.',
          },
          {
            strong: 'Το Worst 5 είναι εκεί που κερδίζονται τα παιχνίδια.',
            rest:
              ' Οι περισσότεροι παίκτες σκέφτονται υπερβολικά την κορυφή και αγνοούν τον πάτο. Τρία σωστά Worst-5 picks = 30 δωρεάν πόντοι.',
          },
          {
            strong: 'Πρόσεχε τη σειρά εμφάνισης στους ημιτελικούς.',
            rest:
              ' Οι όψιμες θέσεις στον δεύτερο ημιτελικό συχνά κερδίζουν θέσεις στον τελικό που δεν αξίζουν — μένουν φρέσκες στη μνήμη της κριτικής επιτροπής.',
          },
          {
            strong: 'Μην ποντάρεις εναντίον του οικοδεσπότη.',
            rest: ' Η Αυστρία το 2026 δεν θα κερδίσει, αλλά μάλλον δεν θα είναι ούτε στον πάτο.',
          },
        ],
      },
      faqTitle: 'Συχνές ερωτήσεις',
    },
    cta: {
      title: 'Κλείδωσε το Top 5 σου πριν την έναρξη',
      body: 'Δημιούργησε ένα δωμάτιο και κάλεσε έως 19 φίλους να προβλέψουν.',
      primary: 'Δημιουργία',
      secondary: 'Πώς να παίξεις',
    },
    related: {
      night: { title: 'Βραδιά Eurovision', blurb: 'Το playbook 10 βημάτων για να φιλοξενήσεις ένα watch party.' },
      trivia: { title: 'Eurovision trivia', blurb: '10 δείγματα ερωτήσεων και πώς δουλεύει η ζωντανή τράπεζα.' },
      duels: { title: 'Eurovision μονομαχίες', blurb: 'Head-to-head μονομαχίες 3 ερωτήσεων κατά τη ζωντανή εκπομπή.' },
      scoring: {
        title: 'Μαθηματικά βαθμολογίας',
        blurb: 'Πού τροφοδοτούν προβλέψεις, μονομαχίες και quiz τον Πρωταθλητή.',
      },
      howToPlay: { title: 'Πώς να παίξεις', blurb: 'Ο οδηγός 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι τα τρόπαια.' },
      faq: { title: 'FAQ', blurb: 'Απαντήσεις σε συνηθισμένες ερωτήσεις για hosting, join και βαθμολογία.' },
    },
    withdrawn: ['Ισλανδία', 'Ιρλανδία', 'Ολλανδία', 'Σλοβενία', 'Ισπανία'],
    faq: [
      {
        q: 'Μπορώ να αλλάξω τη λίστα μου;',
        a: 'Μέχρι ο οικοδεσπότης να προχωρήσει τη φάση. Μετά, κλειδώνει.',
      },
      {
        q: 'Τι γίνεται με τις χώρες που αποκλείονται στους ημιτελικούς;',
        a: 'Το Eurovision Games βαθμολογεί με βάση το αποτέλεσμα του μεγάλου τελικού. Χώρες που δεν προκρίνονται μετράνε ως «εκτός Top 5» — μηδέν πόντοι αν τις διάλεξες.',
      },
      {
        q: 'Πώς ξέρει η εφαρμογή τα αποτελέσματα;',
        a: 'Ο οικοδεσπότης εισάγει τα αποτελέσματα κριτικής επιτροπής και televote ζωντανά κατά τη διάρκεια της εκπομπής· ή ο auto-parser τα αντλεί από την επίσημη πηγή.',
      },
    ],
  },
};
