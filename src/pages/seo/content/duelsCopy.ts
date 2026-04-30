import type { Locale } from '../../../lib/seo/locale';

interface DuelsFaq {
  q: string;
  a: string;
}

interface DuelsCopy {
  meta: {
    title: string;
    description: string;
    schemaTitle: string;
    schemaDescription: string;
    howToName: string;
    howToDescription: string;
    keywords: string[];
  };
  crumbs: { home: string; duels: string };
  hero: { chip: string; title: string; lede: string };
  sections: {
    whatIs: {
      title: string;
      bodyPre: string;
      bodyEm: string;
      bodyPost: string;
      bullets: { strong: string; rest: string }[];
    };
    when: {
      title: string;
      body1Pre: string;
      body1Strong1: string;
      body1Mid: string;
      body1Strong2: string;
      body1Post: string;
      ruleOfThumbStrong: string;
      ruleOfThumbBody: string;
    };
    scoring: {
      title: string;
      intro: string;
      headers: { scenario: string; points: string };
      rows: {
        zeroToOne: string;
        five: string;
        eleven: string;
        wrong: string;
        winBonus: string;
      };
      winnerScorePre: string;
      winnerScoreEm: string;
      winnerScorePost: string;
      stealLabel: string;
      stealBodyPre: string;
      stealBodyEm: string;
      stealBodyPost: string;
      doubleLabel: string;
      doubleBodyPre: string;
      doubleBodyEm: string;
      doubleBodyPost: string;
    };
    stealVsDouble: {
      title: string;
      stealHeading: string;
      stealBody: string;
      doubleHeading: string;
      doubleBodyPre: string;
      doubleBodyEm: string;
      doubleBodyPost: string;
    };
    trophies: {
      title: string;
      intro: string;
      duelistLabel: string;
      duelistBody: string;
      thiefLabel: string;
      thiefBody: string;
      seePre: string;
      scoringLink: string;
      seeMid: string;
      rulesLink: string;
      seePost: string;
    };
    faqTitle: string;
  };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    trivia: { title: string; blurb: string };
    scoring: { title: string; blurb: string };
    predictions: { title: string; blurb: string };
    howToPlay: { title: string; blurb: string };
    rules: { title: string; blurb: string };
    leave: { title: string; blurb: string };
  };
  howToSteps: { name: string; text: string }[];
  faq: DuelsFaq[];
}

export const copy: Record<Locale, DuelsCopy> = {
  en: {
    meta: {
      title: 'Eurovision Duels \u2014 Head-to-Head Trivia for the Live Show',
      description:
        'Challenge friends to 3-question Eurovision trivia duels during the live show. Steal their points or double your own. Full rules, scoring, and strategy.',
      schemaTitle: 'Eurovision Duels — Head-to-Head Trivia During the Live Show',
      schemaDescription:
        'Rules, scoring, and strategy for 3-question head-to-head Eurovision trivia duels. Steal points or double your own.',
      howToName: 'How to win a Eurovision duel',
      howToDescription:
        'A 3-question, 12-second-per-question head-to-head trivia battle. Speed plus accuracy wins; Steal or Double doubles down.',
      keywords: [
        'eurovision duels',
        'eurovision trivia game',
        'head to head eurovision quiz',
        'eurovision party game',
        'steal points eurovision',
        'eurovision live show game',
      ],
    },
    crumbs: { home: 'Home', duels: 'Duels' },
    hero: {
      chip: 'Live-show feature',
      title: 'Eurovision duels — head-to-head trivia during the live show',
      lede:
        'A duel turns the dead air between performances into a battlefield. Challenge anyone in your room to a 3-question Eurovision trivia fight — winner steals their points or doubles their own. Two of the five end-of-night trophies (Duelist, Thief) are decided here.',
    },
    sections: {
      whatIs: {
        title: 'What is a Eurovision duel?',
        bodyPre:
          'A duel is a private 3-question Eurovision trivia round between exactly two players in the same room. Both players answer the same questions on a 12-second timer. The first question fires once the challenger accepts; everyone else in the room sees a discreet ',
        bodyEm: '"duel in progress"',
        bodyPost: ' chip but the questions stay private until the duel ends.',
        bullets: [
          { strong: '3 questions.', rest: " Pulled from the Eurovision trivia bank, weighted toward the room's decade preference." },
          { strong: '12 seconds per question.', rest: ' Score = 12 minus elapsed seconds, rounded down. Wrong or out of time = 0.' },
          { strong: 'Winner takes the bigger answer total', rest: ' — plus a flat +12 win bonus.' },
          {
            strong: 'Steal or Double.',
            rest: ' Winner picks one. Loser keeps their points if Double; loses up to winner_score if Steal.',
          },
        ],
      },
      when: {
        title: 'When duels are available',
        body1Pre: 'Duels unlock from the ',
        body1Strong1: 'Live Show',
        body1Mid: ' phase onward. During the ',
        body1Strong2: 'Preshow',
        body1Post:
          " phase (lobby + predictions) all duel buttons are inactive — that's also when Quiz mode is open. Once the broadcast starts and the host advances to Live Show, Quiz locks and duels open. Both stay open through Results and Winners reveal.",
        ruleOfThumbStrong: 'Phase rule of thumb:',
        ruleOfThumbBody:
          ' Quiz is the warm-up, duels are the main event. You build score with predictions before the show, defend it with quiz before kick-off, then attack rivals with duels during commercial breaks.',
      },
      scoring: {
        title: 'Scoring math',
        intro: 'The formula rewards speed and accuracy equally — a half-second hesitation costs you a point.',
        headers: { scenario: 'Scenario', points: 'Points' },
        rows: {
          zeroToOne: 'Correct answer at 0–1 seconds',
          five: 'Correct answer at 5 seconds',
          eleven: 'Correct answer at 11 seconds',
          wrong: 'Wrong / timeout',
          winBonus: 'Win bonus',
        },
        winnerScorePre: "The winner's total earned that duel is called ",
        winnerScoreEm: 'winner_score',
        winnerScorePost: '. They then pick:',
        stealLabel: 'Steal',
        stealBodyPre: ' — take ',
        stealBodyEm: 'winner_score',
        stealBodyPost:
          " from the loser's banked total. Capped at what the loser actually has (you cannot take them below zero).",
        doubleLabel: 'Double',
        doubleBodyPre: ' — add another ',
        doubleBodyEm: 'winner_score',
        doubleBodyPost: ' to yourself. Loser keeps their score.',
      },
      stealVsDouble: {
        title: 'Steal vs Double — when each one wins',
        stealHeading: '⚔️ Steal',
        stealBody:
          "Zero-sum swing — your gain is matched by their loss. Use it when overtaking the leader matters more than the absolute gain (mid-show, leaderboard tight, you're second by 30 points).",
        doubleHeading: '✨ Double',
        doubleBodyPre:
          " Flat add — better when you're already ahead and don't want to fuel a revenge challenge. Strictly better when the loser has less than ",
        doubleBodyEm: 'winner_score',
        doubleBodyPost: ' banked (no points to steal anyway).',
      },
      trophies: {
        title: 'How duels feed the trophies',
        intro: 'Two of the five end-of-night trophies come straight from duel data:',
        duelistLabel: 'Duelist',
        duelistBody: ' — most duels won across the night.',
        thiefLabel: 'Thief',
        thiefBody: ' — most points taken via Steal.',
        seePre: 'See the ',
        scoringLink: 'full scoring page',
        seeMid: ' for how Duelist and Thief feed into the Champion total, and the ',
        rulesLink: 'rule book',
        seePost: ' for sudden-death tiebreaks when two players tie a trophy category.',
      },
      faqTitle: 'Frequently asked questions',
    },
    cta: {
      title: 'Start a room and challenge your friends',
      body:
        'Duels open the moment the host advances to Live Show. Spin up a room in 60 seconds and have the link ready before the first song airs.',
      primary: 'Create room',
      secondary: 'How to play',
    },
    related: {
      trivia: { title: 'Eurovision trivia', blurb: '50+ sample questions plus the bank duels pull from.' },
      scoring: { title: 'Full scoring formulas', blurb: 'Where Steal and Double feed into Champion / Thief / Duelist.' },
      predictions: {
        title: '2026 predictions',
        blurb: 'Lock Top 5 and Worst 5 before the show — points stack with duels.',
      },
      howToPlay: { title: 'How to play in 60 seconds', blurb: 'Setup walkthrough from create-room to trophy reveal.' },
      rules: { title: 'Rule book', blurb: 'Sudden death, refused duels, and tiebreak protocol.' },
      leave: { title: 'Leaving or deleting a room', blurb: 'What happens to your duel record if you leave mid-show.' },
    },
    howToSteps: [
      {
        name: 'Pick an opponent',
        text: "During the Live Show phase, tap any other player\u2019s name in the room and choose Challenge.",
      },
      {
        name: 'Answer fast',
        text: 'Each correct answer scores 12 minus elapsed seconds. A 1-second hesitation costs a full point.',
      },
      { name: 'Win on total', text: 'Highest answer total wins the duel and gets a flat +12 win bonus.' },
      {
        name: 'Steal or Double',
        text: 'Winner picks: Steal takes points from the loser, Double adds points to themselves. Loser keeps points if Double.',
      },
    ],
    faq: [
      {
        q: 'What is a Eurovision duel?',
        a: 'A duel is a 3-question, head-to-head trivia battle between two players in the same Eurovision Games room. The winner can either steal points from the loser or double their own points. Duels happen live during the show — typically during ad breaks or postcard interludes.',
      },
      {
        q: 'When can I duel?',
        a: 'Duels unlock from the Live Show phase and stay open through results. They are locked during Preshow (lobby + predictions). Quiz mode is also locked once Live Show starts — duels replace it.',
      },
      {
        q: 'How many duels can I have with one person?',
        a: 'There is a default per-pair cap (3 duels, max 10) baked into the system. The cap counts rematches, so you cannot grind one opponent for points all night.',
      },
      {
        q: 'How are duel points calculated?',
        a: 'Each correct answer scores 12 minus elapsed seconds (12 at 0s, 1 at 11s, 0 after 12s or wrong). Whoever has the higher answer total wins the duel and gets a flat +12 bonus on top. The winner then chooses Steal (take winner_score from the loser) or Double (add winner_score to themselves).',
      },
    ],
  },
  el: {
    meta: {
      title: 'Eurovision Μονομαχίες \u2014 Head-to-Head Trivia για τη Ζωντανή Εκπομπή',
      description:
        'Πρόκαλεσε φίλους σε μονομαχίες Eurovision trivia 3 ερωτήσεων κατά τη ζωντανή εκπομπή. Κλέψε τους πόντους τους ή διπλασίασε τους δικούς σου. Πλήρεις κανόνες, βαθμολογία και στρατηγική.',
      schemaTitle: 'Eurovision Μονομαχίες — Head-to-Head Trivia κατά τη Ζωντανή Εκπομπή',
      schemaDescription:
        'Κανόνες, βαθμολογία και στρατηγική για head-to-head μονομαχίες Eurovision trivia 3 ερωτήσεων. Κλέψε πόντους ή διπλασίασε τους δικούς σου.',
      howToName: 'Πώς να κερδίσεις μια μονομαχία Eurovision',
      howToDescription:
        'Μια head-to-head μονομαχία trivia 3 ερωτήσεων με 12 δευτερόλεπτα ανά ερώτηση. Ταχύτητα και ακρίβεια κερδίζουν· Κλοπή ή Διπλασιασμός ανεβάζει το ρίσκο.',
      keywords: [
        'eurovision μονομαχίες',
        'eurovision trivia παιχνίδι',
        'head to head eurovision quiz',
        'eurovision party παιχνίδι',
        'κλοπή πόντων eurovision',
        'eurovision live show παιχνίδι',
      ],
    },
    crumbs: { home: 'Αρχική', duels: 'Μονομαχίες' },
    hero: {
      chip: 'Λειτουργία ζωντανής εκπομπής',
      title: 'Eurovision μονομαχίες — head-to-head trivia κατά τη ζωντανή εκπομπή',
      lede:
        'Μια μονομαχία μετατρέπει τον νεκρό χρόνο ανάμεσα στις εμφανίσεις σε πεδίο μάχης. Πρόκαλεσε οποιονδήποτε στο δωμάτιό σου σε μια μάχη Eurovision trivia 3 ερωτήσεων — ο νικητής κλέβει τους πόντους του ή διπλασιάζει τους δικούς του. Δύο από τα πέντε τρόπαια της βραδιάς (Μονομάχος, Κλέφτης) κρίνονται εδώ.',
    },
    sections: {
      whatIs: {
        title: 'Τι είναι μια μονομαχία Eurovision;',
        bodyPre:
          'Η μονομαχία είναι ένας ιδιωτικός γύρος Eurovision trivia 3 ερωτήσεων ανάμεσα σε ακριβώς δύο παίκτες στο ίδιο δωμάτιο. Και οι δύο παίκτες απαντούν στις ίδιες ερωτήσεις σε χρονόμετρο 12 δευτερολέπτων. Η πρώτη ερώτηση εκκινεί μόλις ο προκαλούμενος δεχτεί· όλοι οι υπόλοιποι στο δωμάτιο βλέπουν ένα διακριτικό ',
        bodyEm: '«μονομαχία σε εξέλιξη»',
        bodyPost: ' chip, αλλά οι ερωτήσεις παραμένουν ιδιωτικές μέχρι να τελειώσει η μονομαχία.',
        bullets: [
          {
            strong: '3 ερωτήσεις.',
            rest: ' Αντλούνται από την τράπεζα Eurovision trivia, με βάρος προς την προτίμηση δεκαετίας του δωματίου.',
          },
          {
            strong: '12 δευτερόλεπτα ανά ερώτηση.',
            rest:
              ' Βαθμολογία = 12 μείον τα δευτερόλεπτα που πέρασαν, στρογγυλοποίηση προς τα κάτω. Λάθος ή υπέρβαση χρόνου = 0.',
          },
          {
            strong: 'Ο νικητής παίρνει το μεγαλύτερο σύνολο απαντήσεων',
            rest: ' — συν ένα flat bonus νίκης +12.',
          },
          {
            strong: 'Κλοπή ή Διπλασιασμός.',
            rest:
              ' Ο νικητής διαλέγει. Ο ηττημένος κρατάει τους πόντους του στον Διπλασιασμό· χάνει έως winner_score στην Κλοπή.',
          },
        ],
      },
      when: {
        title: 'Πότε είναι διαθέσιμες οι μονομαχίες',
        body1Pre: 'Οι μονομαχίες ξεκλειδώνουν από τη φάση ',
        body1Strong1: 'Ζωντανή Εκπομπή',
        body1Mid: ' και μετά. Κατά τη φάση ',
        body1Strong2: 'Pre-show',
        body1Post:
          ' (lobby + προβλέψεις) όλα τα κουμπιά μονομαχίας είναι ανενεργά — εκείνη τη στιγμή είναι ανοιχτή και η λειτουργία Quiz. Μόλις ξεκινήσει η εκπομπή και ο οικοδεσπότης προχωρήσει στη Ζωντανή Εκπομπή, το Quiz κλειδώνει και οι μονομαχίες ανοίγουν. Και τα δύο μένουν ανοιχτά μέχρι την αποκάλυψη Αποτελεσμάτων και Νικητών.',
        ruleOfThumbStrong: 'Κανόνας φάσεων με μια ματιά:',
        ruleOfThumbBody:
          ' Το Quiz είναι το ζέσταμα, οι μονομαχίες είναι το κυρίως πιάτο. Χτίζεις βαθμολογία με προβλέψεις πριν την εκπομπή, την υπερασπίζεσαι με quiz πριν την έναρξη και μετά επιτίθεσαι σε αντιπάλους με μονομαχίες κατά τα διαφημιστικά διαλείμματα.',
      },
      scoring: {
        title: 'Μαθηματικά βαθμολογίας',
        intro:
          'Ο τύπος επιβραβεύει εξίσου ταχύτητα και ακρίβεια — ένας δισταγμός μισού δευτερολέπτου σου κοστίζει έναν πόντο.',
        headers: { scenario: 'Σενάριο', points: 'Πόντοι' },
        rows: {
          zeroToOne: 'Σωστή απάντηση στα 0–1 δευτερόλεπτα',
          five: 'Σωστή απάντηση στα 5 δευτερόλεπτα',
          eleven: 'Σωστή απάντηση στα 11 δευτερόλεπτα',
          wrong: 'Λάθος / υπέρβαση χρόνου',
          winBonus: 'Bonus νίκης',
        },
        winnerScorePre: 'Το σύνολο που κέρδισε ο νικητής σε αυτή τη μονομαχία ονομάζεται ',
        winnerScoreEm: 'winner_score',
        winnerScorePost: '. Έπειτα διαλέγει:',
        stealLabel: 'Κλοπή',
        stealBodyPre: ' — πάρε ',
        stealBodyEm: 'winner_score',
        stealBodyPost:
          ' από το αποθηκευμένο σύνολο του ηττημένου. Έχει ταβάνι όσα έχει πραγματικά ο ηττημένος (δεν μπορείς να τον βάλεις κάτω από το μηδέν).',
        doubleLabel: 'Διπλασιασμός',
        doubleBodyPre: ' — πρόσθεσε άλλο ένα ',
        doubleBodyEm: 'winner_score',
        doubleBodyPost: ' στον εαυτό σου. Ο ηττημένος κρατάει τη βαθμολογία του.',
      },
      stealVsDouble: {
        title: 'Κλοπή vs Διπλασιασμός — πότε κερδίζει η καθεμία',
        stealHeading: '⚔️ Κλοπή',
        stealBody:
          'Μηδενικού αθροίσματος ταλάντωση — το κέρδος σου εξισώνεται με τη δική του απώλεια. Χρησιμοποίησέ την όταν η προσπέραση του πρωτοπόρου μετράει περισσότερο από το απόλυτο κέρδος (στη μέση της εκπομπής, με τον πίνακα στενό, είσαι δεύτερος με διαφορά 30 πόντων).',
        doubleHeading: '✨ Διπλασιασμός',
        doubleBodyPre:
          ' Καθαρή πρόσθεση — καλύτερος όταν είσαι ήδη μπροστά και δεν θέλεις να τροφοδοτήσεις πρόκληση εκδίκησης. Σαφώς καλύτερος όταν ο ηττημένος έχει λιγότερα από ',
        doubleBodyEm: 'winner_score',
        doubleBodyPost: ' αποθηκευμένα (δεν υπάρχουν πόντοι να κλέψεις ούτως ή άλλως).',
      },
      trophies: {
        title: 'Πώς οι μονομαχίες τροφοδοτούν τα τρόπαια',
        intro: 'Δύο από τα πέντε τρόπαια της βραδιάς προέρχονται απευθείας από τα δεδομένα μονομαχιών:',
        duelistLabel: 'Μονομάχος',
        duelistBody: ' — οι περισσότερες νίκες σε μονομαχίες όλη τη βραδιά.',
        thiefLabel: 'Κλέφτης',
        thiefBody: ' — οι περισσότεροι πόντοι που πάρθηκαν με Κλοπή.',
        seePre: 'Δες την ',
        scoringLink: 'πλήρη σελίδα βαθμολογίας',
        seeMid: ' για το πώς ο Μονομάχος και ο Κλέφτης τροφοδοτούν τον Πρωταθλητή, και τον ',
        rulesLink: 'κανονισμό',
        seePost: ' για sudden-death tiebreak όταν δύο παίκτες ισοβαθμούν σε κατηγορία τροπαίου.',
      },
      faqTitle: 'Συχνές ερωτήσεις',
    },
    cta: {
      title: 'Άνοιξε δωμάτιο και πρόκαλεσε τους φίλους σου',
      body:
        'Οι μονομαχίες ανοίγουν τη στιγμή που ο οικοδεσπότης προχωρά στη Ζωντανή Εκπομπή. Στήσε ένα δωμάτιο σε 60 δευτερόλεπτα και έχε έτοιμο το link πριν παίξει το πρώτο τραγούδι.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Πώς να παίξεις',
    },
    related: {
      trivia: {
        title: 'Eurovision trivia',
        blurb: '50+ δείγματα ερωτήσεων και η τράπεζα από όπου αντλούν οι μονομαχίες.',
      },
      scoring: {
        title: 'Πλήρη μαθηματικά βαθμολογίας',
        blurb: 'Πού τροφοδοτούν Κλοπή και Διπλασιασμός τον Πρωταθλητή / Κλέφτη / Μονομάχο.',
      },
      predictions: {
        title: 'Προβλέψεις 2026',
        blurb: 'Κλείδωσε Top 5 και Worst 5 πριν την εκπομπή — οι πόντοι αθροίζονται με τις μονομαχίες.',
      },
      howToPlay: {
        title: 'Πώς να παίξεις σε 60 δευτερόλεπτα',
        blurb: 'Οδηγός στησίματος από τη δημιουργία δωματίου μέχρι τα τρόπαια.',
      },
      rules: { title: 'Κανονισμός', blurb: 'Sudden death, απορριμμένες μονομαχίες και πρωτόκολλο tiebreak.' },
      leave: {
        title: 'Έξοδος ή διαγραφή δωματίου',
        blurb: 'Τι συμβαίνει με το ιστορικό μονομαχιών σου αν φύγεις στη μέση της εκπομπής.',
      },
    },
    howToSteps: [
      {
        name: 'Διάλεξε αντίπαλο',
        text:
          'Στη φάση Ζωντανή Εκπομπή, πάτησε το όνομα οποιουδήποτε άλλου παίκτη στο δωμάτιο και διάλεξε Πρόκληση.',
      },
      {
        name: 'Απάντα γρήγορα',
        text:
          'Κάθε σωστή απάντηση βαθμολογείται 12 μείον τα δευτερόλεπτα που πέρασαν. Ένας δισταγμός 1 δευτερολέπτου κοστίζει έναν ολόκληρο πόντο.',
      },
      {
        name: 'Νίκη στο σύνολο',
        text: 'Το μεγαλύτερο σύνολο απαντήσεων κερδίζει τη μονομαχία και παίρνει flat bonus νίκης +12.',
      },
      {
        name: 'Κλοπή ή Διπλασιασμός',
        text:
          'Ο νικητής διαλέγει: Κλοπή παίρνει πόντους από τον ηττημένο, Διπλασιασμός προσθέτει πόντους στον εαυτό του. Ο ηττημένος κρατάει τους πόντους του στον Διπλασιασμό.',
      },
    ],
    faq: [
      {
        q: 'Τι είναι μια μονομαχία Eurovision;',
        a: 'Η μονομαχία είναι μια head-to-head μάχη trivia 3 ερωτήσεων ανάμεσα σε δύο παίκτες στο ίδιο δωμάτιο Eurovision Games. Ο νικητής μπορεί είτε να κλέψει πόντους από τον ηττημένο είτε να διπλασιάσει τους δικούς του. Οι μονομαχίες γίνονται ζωντανά κατά τη διάρκεια της εκπομπής — συνήθως σε διαφημιστικά διαλείμματα ή στα postcard intervals.',
      },
      {
        q: 'Πότε μπορώ να μονομαχήσω;',
        a: 'Οι μονομαχίες ξεκλειδώνουν από τη φάση Ζωντανή Εκπομπή και παραμένουν ανοιχτές μέχρι τα αποτελέσματα. Είναι κλειδωμένες κατά το Pre-show (lobby + προβλέψεις). Η λειτουργία Quiz επίσης κλειδώνει μόλις ξεκινήσει η Ζωντανή Εκπομπή — οι μονομαχίες την αντικαθιστούν.',
      },
      {
        q: 'Πόσες μονομαχίες μπορώ να έχω με ένα άτομο;',
        a: 'Υπάρχει προεπιλεγμένο όριο ανά ζευγάρι (3 μονομαχίες, μέγιστο 10) ενσωματωμένο στο παιχνίδι. Το όριο μετράει τις ρεβάνς, οπότε δεν μπορείς να εκμεταλλεύεσαι έναν αντίπαλο για πόντους όλη τη βραδιά.',
      },
      {
        q: 'Πώς υπολογίζονται οι πόντοι μονομαχίας;',
        a: 'Κάθε σωστή απάντηση βαθμολογείται 12 μείον τα δευτερόλεπτα που πέρασαν (12 στα 0s, 1 στα 11s, 0 μετά τα 12s ή σε λάθος). Όποιος έχει το μεγαλύτερο σύνολο απαντήσεων κερδίζει τη μονομαχία και παίρνει flat bonus +12 από πάνω. Ο νικητής έπειτα διαλέγει Κλοπή (παίρνει winner_score από τον ηττημένο) ή Διπλασιασμό (προσθέτει winner_score στον εαυτό του).',
      },
    ],
  },
};
