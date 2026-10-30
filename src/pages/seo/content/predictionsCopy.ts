import type { Locale } from '../../../lib/seo/locale';
import type { ContestTexts } from './contestText';

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
      /** Before the final: the competing entries. */
      title: string;
      intro: string;
      hostSuffix: string;
      runningOrder: string;
      /** Once the final is decided: the ranking with places. */
      resultsTitle: string;
      resultsIntro: string;
      /** Place cell of a country that did not reach the final. */
      notInFinal: string;
      /** No entries known yet. */
      empty: string;
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
  faq: PredictionsFaq[];
}

/** Copy for the permanent predictions guide; the live contest's facts come from the ContestTexts. */
export const copy = ({ en: t, el: g }: ContestTexts): Record<Locale, PredictionsCopy> => ({
  en: {
    meta: {
      title: 'Eurovision Predictions Game: Top 5 / Worst 5 Format & Strategy',
      description:
        `A complete predictions guide for Eurovision ${t.year} ${t.cityIn}: the competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips.`,
      schemaTitle: 'Eurovision Predictions Game: Top 5 / Worst 5 Format',
      schemaDescription:
        `A complete predictions guide for Eurovision ${t.year} ${t.cityIn}: the competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips.`,
      keywords: [
        `eurovision ${t.year} predictions`,
        `eurovision ${t.year} top 5`,
        `eurovision ${t.year} worst 5`,
        'eurovision predictions game',
        `eurovision ${t.year} lineup`,
      ],
    },
    crumbs: { home: 'Home', predictions: 'Predictions' },
    hero: {
      chip: 'Predictions game',
      title: 'Eurovision predictions game — Top 5 and Worst 5 format',
      lede:
        `Eurovision ${t.year} takes place ${t.cityIn}${t.host ? `, ${t.host}` : ''}, with the grand final on ${t.finalDay}. In Eurovision Games each player builds two prediction lists — Top 5 and Worst 5 — before the show starts, then watches them auto-score against the official jury and televote results in real time.`,
    },
    sections: {
      lineup: {
        title: `The Eurovision ${t.year} line-up`,
        intro: `${t.lineup} countries are confirmed for Eurovision ${t.year} across two semi-finals and the grand final:`,
        hostSuffix: ' (host)',
        runningOrder:
          'The grand-final running order is fixed after the second semi-final; this page updates with live entries as they are confirmed.',
        resultsTitle: `Eurovision ${t.year} final ranking`,
        resultsIntro: `Eurovision ${t.year} is decided. Here is the final ranking of all ${t.lineup} countries, so you can check your Top 5 and Worst 5:`,
        notInFinal: 'Semi-final',
        empty: `The Eurovision ${t.year} line-up is not confirmed yet; this page lists the entries as soon as it is.`,
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
            rest: ' Host countries rarely win, but they rarely finish last either.',
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
        a: 'The host enters jury and televote results live during the show; or they update automatically from the official source.',
      },
    ],
  },
  el: {
    meta: {
      title: 'Παιχνίδι Προβλέψεων Eurovision: Φόρμα Top 5 / Worst 5 και Στρατηγική',
      description:
        `Ένας πλήρης οδηγός προβλέψεων για την Eurovision ${g.year} ${g.cityIn}: οι συμμετέχουσες χώρες, η φόρμα Top 5 / Worst 5, μαθηματικά βαθμολογίας και συμβουλές στρατηγικής.`,
      schemaTitle: 'Παιχνίδι Προβλέψεων Eurovision: Φόρμα Top 5 / Worst 5',
      schemaDescription:
        `Ένας πλήρης οδηγός προβλέψεων για την Eurovision ${g.year} ${g.cityIn}: οι συμμετέχουσες χώρες, η φόρμα Top 5 / Worst 5, μαθηματικά βαθμολογίας και συμβουλές στρατηγικής.`,
      keywords: [
        `προβλέψεις eurovision ${g.year}`,
        `eurovision ${g.year} top 5`,
        `eurovision ${g.year} worst 5`,
        'παιχνίδι προβλέψεων eurovision',
        `λίστα χωρών eurovision ${g.year}`,
      ],
    },
    crumbs: { home: 'Αρχική', predictions: 'Προβλέψεις' },
    hero: {
      chip: 'Παιχνίδι προβλέψεων',
      title: 'Παιχνίδι προβλέψεων Eurovision — Φόρμα Top 5 και Worst 5',
      lede:
        `Η Eurovision ${g.year} διεξάγεται ${g.cityIn}${g.host ? ` (${g.host})` : ''}, με τον μεγάλο τελικό το ${g.finalDay}. Στο Eurovision Games κάθε παίκτης φτιάχνει δύο λίστες προβλέψεων — Top 5 και Worst 5 — πριν ξεκινήσει η εκπομπή, και τις βλέπει να βαθμολογούνται αυτόματα σε πραγματικό χρόνο με βάση τα επίσημα αποτελέσματα κριτικής επιτροπής και televote.`,
    },
    sections: {
      lineup: {
        title: `Οι συμμετοχές της Eurovision ${g.year}`,
        intro: `${g.lineup} χώρες έχουν επιβεβαιωθεί για την Eurovision ${g.year} σε δύο ημιτελικούς και τον μεγάλο τελικό:`,
        hostSuffix: ' (οικοδεσπότης)',
        resultsTitle: `Η τελική κατάταξη της Eurovision ${g.year}`,
        resultsIntro: `Η Eurovision ${g.year} κρίθηκε. Αυτή είναι η τελική κατάταξη και των ${g.lineup} χωρών, για να ελέγξεις το Top 5 και το Worst 5 σου:`,
        notInFinal: 'Ημιτελικός',
        empty: `Οι συμμετοχές της Eurovision ${g.year} δεν έχουν επιβεβαιωθεί ακόμη· η σελίδα τις δείχνει μόλις ανακοινωθούν.`,
        runningOrder:
          'Η σειρά εμφάνισης του μεγάλου τελικού οριστικοποιείται μετά τον δεύτερο ημιτελικό· η σελίδα ενημερώνεται με ζωντανές συμμετοχές μόλις επιβεβαιωθούν.',
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
            rest: ' Οι χώρες-οικοδεσπότες σπάνια κερδίζουν, αλλά σπάνια τερματίζουν και τελευταίες.',
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
        a: 'Ο οικοδεσπότης εισάγει τα αποτελέσματα κριτικής επιτροπής και televote ζωντανά κατά τη διάρκεια της εκπομπής· ή ενημερώνονται αυτόματα από την επίσημη πηγή.',
      },
    ],
  },
});
