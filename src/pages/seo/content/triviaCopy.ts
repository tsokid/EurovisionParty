import type { Locale } from '../../../lib/seo/locale';

interface TriviaQuestion {
  q: string;
  options: string[];
  answer: string;
}

interface TriviaFaq {
  q: string;
  a: string;
}

interface TriviaCopy {
  meta: {
    title: string;
    description: string;
    schemaTitle: string;
    schemaDescription: string;
    quizName: string;
    quizAbout: string;
    keywords: string[];
  };
  crumbs: { home: string; trivia: string };
  hero: { chip: string; title: string; lede: string };
  sections: {
    whatIs: { title: string; body: string };
    samples: { title: string; intro: string; questionPrefix: string; answerLabel: string };
    categories: {
      title: string;
      easyLabel: string;
      easyBody: string;
      mediumLabel: string;
      mediumBody: string;
      hardLabel: string;
      hardBody: string;
    };
    duels: {
      title: string;
      body1Pre: string; // text before <em>Challenge</em>
      body1Em: string;
      body1Post: string;
      body2Pre: string;
      body2LinkLabel: string;
      body2Post: string;
    };
    play: {
      title: string;
      pre: string;
      linkLabel: string;
      post: string;
    };
    faqTitle: string;
    disclaimer: string;
  };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    duels: { title: string; blurb: string };
    predictions: { title: string; blurb: string };
    howToPlay: { title: string; blurb: string };
    scoring: { title: string; blurb: string };
    rules: { title: string; blurb: string };
    night: { title: string; blurb: string };
  };
  questions: TriviaQuestion[];
  faq: TriviaFaq[];
}

export const copy: Record<Locale, TriviaCopy> = {
  en: {
    meta: {
      title: 'Eurovision Trivia — 10 Sample Questions + How to Play Live',
      description:
        'A 10-question Eurovision trivia sampler with answers, plus how to run head-to-head trivia duels live during the broadcast.',
      schemaTitle: 'Eurovision Trivia — Sample Questions and How to Play Live',
      schemaDescription:
        'A 10-question Eurovision trivia sampler with answers, plus how to run head-to-head trivia duels live during the broadcast.',
      quizName: 'Eurovision Trivia — 10 Sample Questions',
      quizAbout: 'Eurovision Song Contest history, voting, and winners',
      keywords: [
        'eurovision trivia',
        'eurovision quiz',
        'eurovision trivia questions',
        'eurovision quiz game',
        'eurovision quiz with friends',
      ],
    },
    crumbs: { home: 'Home', trivia: 'Eurovision trivia' },
    hero: {
      chip: 'Trivia + duels',
      title: 'Eurovision trivia — sample questions and how to play live',
      lede:
        'Eurovision trivia is a question-and-answer format about the history, voting, and winners of the Eurovision Song Contest. In Eurovision Games, trivia is the duel mechanic: any two players can challenge each other to a head-to-head 3-question round during the broadcast, and the winner steals points from the loser.',
    },
    sections: {
      whatIs: {
        title: 'What is Eurovision trivia?',
        body:
          "The Eurovision Song Contest has been running since 1956, with 50+ countries competing across 69 grand finals (1956-2025; 2020 cancelled) — that's a deep well of trivia. Categories that come up most: winners by year, voting milestones, language rules, scoring changes, country debuts and withdrawals, viral entries, controversies, and song titles.",
      },
      samples: {
        title: 'Sample questions (with answers)',
        intro: 'Ten questions pulled from the live bank — try them before you challenge a friend.',
        questionPrefix: 'Q',
        answerLabel: 'Answer:',
      },
      categories: {
        title: 'Categories and difficulty tiers',
        easyLabel: 'Easy:',
        easyBody: 'winners by country, the douze points rule, host city.',
        mediumLabel: 'Medium:',
        mediumBody: 'song titles, year-of-debut, semi-final placements.',
        hardLabel: 'Hard:',
        hardBody: 'voting reform years, withdrawals, controversies, language rules.',
      },
      duels: {
        title: 'How duels work in Eurovision Games',
        body1Pre: "Click any other player's name in the live leaderboard, hit ",
        body1Em: 'Challenge',
        body1Post:
          ", and a 3-question duel pops up on both your screens. Each player has 15 seconds per question. Whoever gets more correct wins; faster correct answers break a tie. The winner steals points from the loser. Each pair has a default cap of 3 duels per night (max 10), rematches counted, so you can't farm one weaker opponent.",
        body2Pre:
          'For the full duel rule book — scoring math, Steal vs Double, and the Duelist/Thief trophies — see the ',
        body2LinkLabel: 'dedicated duels page',
        body2Post: '.',
      },
      play: {
        title: 'Play live',
        pre:
          'Trivia happens during the show. Best windows: between underwhelming entries, during the interval act, and through the jury vote. ',
        linkLabel: 'Create a room',
        post: ' on Eurovision Games and invite up to 19 friends to play.',
      },
      faqTitle: 'Frequently asked questions',
      disclaimer: 'Questions are drawn from a curated bank and have not been individually fact-checked. This is a party game for fun — treat answers as entertainment.',
    },
    cta: {
      title: 'Quiz your friends tonight',
      body: 'Open a room and trigger your first round in 60 seconds.',
      primary: 'Create',
      secondary: 'How to play',
    },
    related: {
      duels: { title: 'Eurovision duels', blurb: 'Head-to-head 3-question duels during the live show.' },
      predictions: { title: '2026 predictions', blurb: 'Top 5 and Worst 5 format, scoring, and strategy.' },
      howToPlay: { title: 'How to play', blurb: 'The 60-second walkthrough from create-room to trophy reveal.' },
      scoring: { title: 'Scoring formulas', blurb: 'How quiz, duel, and prediction points feed the Champion total.' },
      rules: { title: 'Rule book', blurb: 'Sudden death, refused duels, and tiebreak protocol.' },
      night: { title: 'Eurovision night', blurb: 'The 10-step playbook for hosting a watch party.' },
    },
    questions: [
      {
        q: 'Which country has won Eurovision the most times?',
        options: ['Sweden', 'Ireland', 'United Kingdom', 'France'],
        answer: 'Ireland and Sweden tie with 7 wins each (Sweden caught up in 2023 with Loreen).',
      },
      {
        q: 'In what year did ABBA win Eurovision?',
        options: ['1972', '1974', '1976', '1980'],
        answer: '1974, with "Waterloo" representing Sweden.',
      },
      {
        q: 'Where will Eurovision 2026 be held?',
        options: ['Stockholm', 'Vienna', 'Liverpool', 'Madrid'],
        answer: 'Vienna, Austria — JJ won 2025 in Basel.',
      },
      {
        q: 'What does the "douze points" award?',
        options: ['10 points', '12 points', '8 points', '7 points'],
        answer: '12 points — the highest score a jury or country can give in a single vote.',
      },
      {
        q: 'Which country has competed the most times without winning?',
        options: ['Cyprus', 'Iceland', 'Malta', 'Bulgaria'],
        answer: 'Cyprus — runner-up multiple times, never first.',
      },
      {
        q: "What was Conchita Wurst\u2019s winning song in 2014?",
        options: ['Heroes', 'Rise Like a Phoenix', 'Euphoria', 'Toy'],
        answer: 'Rise Like a Phoenix (Austria, 2014).',
      },
      {
        q: 'Which country withdrew from Eurovision after winning multiple early contests, then returned in 2011?',
        options: ['Italy', 'Monaco', 'Yugoslavia', 'Luxembourg'],
        answer: 'Italy — winners in 1964 and 1990, withdrew in 1997, returned in 2011.',
      },
      {
        q: 'How many points did Loreen score with "Tattoo" in 2023?',
        options: ['340', '440', '583', '628'],
        answer: '583 — winning Sweden its 7th title.',
      },
      {
        q: 'What is the maximum number of points a country can earn in the modern voting system?',
        options: ['400', '500', '600', '744'],
        answer:
          'Effectively unbounded; in practice the record sits around 758 (Salvador Sobral, Portugal 2017).',
      },
      {
        q: 'In what year did Eurovision allow public televoting for the first time across most participating countries?',
        options: ['1991', '1997', '2001', '2009'],
        answer: '1997 — five countries trialled televoting; it expanded rapidly thereafter.',
      },
    ],
    faq: [
      {
        q: 'How are trivia questions chosen?',
        a: "Questions are pulled from a curated Eurovision trivia bank covering winners, voting milestones, language rules, country debuts, and viral moments. The room\u2019s decade preference biases which era questions skew toward.",
      },
      {
        q: 'How long do I have to answer?',
        a: 'Each question runs on a 12-second timer in duels. Score = 12 minus elapsed seconds, so a 1-second hesitation costs a full point. Wrong answers and timeouts score zero.',
      },
      {
        q: 'Can I duel the same player repeatedly?',
        a: 'There is a default per-pair cap baked into the system — 3 duels, max 10. Rematches count, so you cannot grind a single weaker opponent for points.',
      },
      {
        q: 'Is there a solo trivia mode?',
        a: 'Yes — Quiz mode runs during the Preshow phase before duels unlock. The host triggers fast-fire rounds; everyone answers in parallel and scores stack into the predictions total.',
      },
    ],
  },
  el: {
    meta: {
      title: 'Eurovision Trivia — 10 Δείγματα Ερωτήσεων + Πώς να Παίξεις Ζωντανά',
      description:
        'Ένα δείγμα 10 ερωτήσεων Eurovision trivia με απαντήσεις, καθώς και πώς να τρέξεις head-to-head trivia μονομαχίες ζωντανά κατά τη διάρκεια της εκπομπής.',
      schemaTitle: 'Eurovision Trivia — Δείγματα ερωτήσεων και πώς να παίξεις ζωντανά',
      schemaDescription:
        'Ένα δείγμα 10 ερωτήσεων Eurovision trivia με απαντήσεις, καθώς και πώς να τρέξεις head-to-head trivia μονομαχίες ζωντανά κατά τη διάρκεια της εκπομπής.',
      quizName: 'Eurovision Trivia — 10 Δείγματα Ερωτήσεων',
      quizAbout: 'Ιστορία, ψηφοφορία και νικητές του Διαγωνισμού Τραγουδιού Eurovision',
      keywords: [
        'eurovision trivia',
        'eurovision quiz',
        'ερωτήσεις eurovision trivia',
        'eurovision quiz παιχνίδι',
        'eurovision quiz με φίλους',
      ],
    },
    crumbs: { home: 'Αρχική', trivia: 'Eurovision trivia' },
    hero: {
      chip: 'Trivia + μονομαχίες',
      title: 'Eurovision trivia — δείγματα ερωτήσεων και πώς να παίξεις ζωντανά',
      lede:
        'Το Eurovision trivia είναι ένα παιχνίδι ερωταπαντήσεων γύρω από την ιστορία, την ψηφοφορία και τους νικητές του Διαγωνισμού Τραγουδιού Eurovision. Στο Eurovision Games, το trivia είναι ο μηχανισμός των μονομαχιών: δύο παίκτες μπορούν να προκαλέσουν ο ένας τον άλλον σε ένα head-to-head γύρο 3 ερωτήσεων κατά τη διάρκεια της εκπομπής, και ο νικητής κλέβει πόντους από τον ηττημένο.',
    },
    sections: {
      whatIs: {
        title: 'Τι είναι το Eurovision trivia;',
        body:
          'Ο Διαγωνισμός Τραγουδιού Eurovision διεξάγεται από το 1956, με 50+ χώρες να αγωνίζονται σε 69 μεγάλους τελικούς (1956-2025· 2020 ακυρώθηκε) — μια τεράστια δεξαμενή trivia. Οι κατηγορίες που εμφανίζονται πιο συχνά: νικητές ανά έτος, σταθμοί στην ψηφοφορία, κανόνες γλώσσας, αλλαγές βαθμολογίας, πρώτες συμμετοχές και αποχωρήσεις χωρών, viral συμμετοχές, αντιπαραθέσεις και τίτλοι τραγουδιών.',
      },
      samples: {
        title: 'Δείγματα ερωτήσεων (με απαντήσεις)',
        intro:
          'Δέκα ερωτήσεις από τη ζωντανή τράπεζα — δοκίμασέ τες πριν προκαλέσεις έναν φίλο.',
        questionPrefix: 'Ε',
        answerLabel: 'Απάντηση:',
      },
      categories: {
        title: 'Κατηγορίες και επίπεδα δυσκολίας',
        easyLabel: 'Εύκολο:',
        easyBody: 'νικητές ανά χώρα, ο κανόνας douze points, η πόλη-οικοδεσπότης.',
        mediumLabel: 'Μεσαίο:',
        mediumBody: 'τίτλοι τραγουδιών, έτος πρώτης συμμετοχής, θέσεις στους ημιτελικούς.',
        hardLabel: 'Δύσκολο:',
        hardBody: 'έτη μεταρρύθμισης ψηφοφορίας, αποχωρήσεις, αντιπαραθέσεις, κανόνες γλώσσας.',
      },
      duels: {
        title: 'Πώς λειτουργούν οι μονομαχίες στο Eurovision Games',
        body1Pre: 'Κάνε κλικ στο όνομα οποιουδήποτε άλλου παίκτη στον ζωντανό πίνακα βαθμολογίας, πάτησε ',
        body1Em: 'Πρόκληση',
        body1Post:
          ', και μια μονομαχία 3 ερωτήσεων εμφανίζεται στις οθόνες και των δύο. Κάθε παίκτης έχει 15 δευτερόλεπτα ανά ερώτηση. Όποιος βρει τις περισσότερες σωστές κερδίζει· σε ισοπαλία ξεχωρίζει η ταχύτητα της σωστής απάντησης. Ο νικητής κλέβει πόντους από τον ηττημένο. Κάθε ζευγάρι έχει προεπιλεγμένο όριο 3 μονομαχιών ανά βραδιά (μέγιστο 10), οι ρεβάνς μετράνε, οπότε δεν μπορείς να εκμεταλλευτείς έναν αδύναμο αντίπαλο.',
        body2Pre:
          'Για τον πλήρη κανονισμό μονομαχιών — μαθηματικά βαθμολογίας, Κλοπή vs Διπλασιασμός, και τα τρόπαια Μονομάχου/Κλέφτη — δες την ',
        body2LinkLabel: 'ειδική σελίδα μονομαχιών',
        body2Post: '.',
      },
      play: {
        title: 'Παίξε ζωντανά',
        pre:
          'Το trivia γίνεται κατά τη διάρκεια της εκπομπής. Καλύτερα παράθυρα: ανάμεσα σε αδιάφορες συμμετοχές, στο interval act και κατά την ψηφοφορία της κριτικής επιτροπής. ',
        linkLabel: 'Δημιούργησε ένα δωμάτιο',
        post: ' στο Eurovision Games και κάλεσε έως 19 φίλους να παίξουν.',
      },
      faqTitle: 'Συχνές ερωτήσεις',
      disclaimer: 'Οι ερωτήσεις αντλούνται από επιμελημένη τράπεζα και δεν έχουν επαληθευτεί μεμονωμένα. Πρόκειται για party game για διασκέδαση.',
    },
    cta: {
      title: 'Κάνε quiz στους φίλους σου απόψε',
      body: 'Άνοιξε ένα δωμάτιο και ξεκίνα τον πρώτο γύρο σε 60 δευτερόλεπτα.',
      primary: 'Δημιουργία',
      secondary: 'Πώς να παίξεις',
    },
    related: {
      duels: { title: 'Eurovision μονομαχίες', blurb: 'Head-to-head μονομαχίες 3 ερωτήσεων κατά τη ζωντανή εκπομπή.' },
      predictions: { title: 'Προβλέψεις 2026', blurb: 'Φόρμα Top 5 και Worst 5, βαθμολογία και στρατηγική.' },
      howToPlay: { title: 'Πώς να παίξεις', blurb: 'Ο οδηγός 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι τα τρόπαια.' },
      scoring: { title: 'Μαθηματικά βαθμολογίας', blurb: 'Πώς οι πόντοι από quiz, μονομαχίες και προβλέψεις τροφοδοτούν τον Πρωταθλητή.' },
      rules: { title: 'Κανονισμός', blurb: 'Sudden death, απορριμμένες μονομαχίες και πρωτόκολλο tiebreak.' },
      night: { title: 'Βραδιά Eurovision', blurb: 'Το playbook 10 βημάτων για να φιλοξενήσεις ένα watch party.' },
    },
    questions: [
      {
        q: 'Ποια χώρα έχει κερδίσει τις περισσότερες φορές την Eurovision;',
        options: ['Sweden', 'Ireland', 'United Kingdom', 'France'],
        answer: 'Ιρλανδία και Σουηδία ισοπαλούν με 7 νίκες η καθεμία (η Σουηδία ισοφάρισε το 2023 με τη Loreen).',
      },
      {
        q: 'Σε ποια χρονιά κέρδισαν οι ABBA την Eurovision;',
        options: ['1972', '1974', '1976', '1980'],
        answer: '1974, με το «Waterloo» εκπροσωπώντας τη Σουηδία.',
      },
      {
        q: 'Πού θα διεξαχθεί η Eurovision 2026;',
        options: ['Stockholm', 'Vienna', 'Liverpool', 'Madrid'],
        answer: 'Βιέννη, Αυστρία — ο JJ κέρδισε το 2025 στη Βασιλεία.',
      },
      {
        q: 'Πόσους πόντους δίνει το «douze points»;',
        options: ['10 points', '12 points', '8 points', '7 points'],
        answer:
          '12 πόντους — η υψηλότερη βαθμολογία που μπορεί να δώσει μια κριτική επιτροπή ή μια χώρα σε μία ψηφοφορία.',
      },
      {
        q: 'Ποια χώρα έχει συμμετάσχει τις περισσότερες φορές χωρίς να κερδίσει ποτέ;',
        options: ['Cyprus', 'Iceland', 'Malta', 'Bulgaria'],
        answer: 'Κύπρος — δεύτερη πολλές φορές, ποτέ πρώτη.',
      },
      {
        q: 'Ποιο ήταν το νικητήριο τραγούδι της Conchita Wurst το 2014;',
        options: ['Heroes', 'Rise Like a Phoenix', 'Euphoria', 'Toy'],
        answer: 'Rise Like a Phoenix (Αυστρία, 2014).',
      },
      {
        q: 'Ποια χώρα αποχώρησε από την Eurovision αφού κέρδισε αρκετές φορές στις πρώτες δεκαετίες, και επέστρεψε το 2011;',
        options: ['Italy', 'Monaco', 'Yugoslavia', 'Luxembourg'],
        answer: 'Ιταλία — νίκες το 1964 και το 1990, αποχώρηση το 1997, επιστροφή το 2011.',
      },
      {
        q: 'Πόσους πόντους πέτυχε η Loreen με το «Tattoo» το 2023;',
        options: ['340', '440', '583', '628'],
        answer: '583 — χαρίζοντας στη Σουηδία τον 7ο τίτλο της.',
      },
      {
        q: 'Ποιος είναι ο μέγιστος αριθμός πόντων που μπορεί να συγκεντρώσει μια χώρα στο σύγχρονο σύστημα ψηφοφορίας;',
        options: ['400', '500', '600', '744'],
        answer:
          'Στην πράξη χωρίς όριο· το ρεκόρ είναι περίπου 758 (Salvador Sobral, Πορτογαλία 2017).',
      },
      {
        q: 'Σε ποιο έτος επέτρεψε η Eurovision για πρώτη φορά τη δημόσια τηλεψηφοφορία στις περισσότερες συμμετέχουσες χώρες;',
        options: ['1991', '1997', '2001', '2009'],
        answer: '1997 — πέντε χώρες δοκίμασαν το televote· επεκτάθηκε ραγδαία στη συνέχεια.',
      },
    ],
    faq: [
      {
        q: 'Πώς επιλέγονται οι ερωτήσεις trivia;',
        a: 'Οι ερωτήσεις αντλούνται από μια επιμελημένη τράπεζα Eurovision trivia που καλύπτει νικητές, σταθμούς ψηφοφορίας, κανόνες γλώσσας, πρώτες συμμετοχές χωρών και viral στιγμές. Η προτίμηση δεκαετίας του δωματίου επηρεάζει σε ποια εποχή δίνουν έμφαση οι ερωτήσεις.',
      },
      {
        q: 'Πόσο χρόνο έχω για να απαντήσω;',
        a: 'Κάθε ερώτηση τρέχει σε χρονόμετρο 12 δευτερολέπτων στις μονομαχίες. Βαθμολογία = 12 μείον τα δευτερόλεπτα που πέρασαν, οπότε ένας δισταγμός 1 δευτερολέπτου κοστίζει έναν ολόκληρο πόντο. Λάθος απαντήσεις και υπερβάσεις χρόνου παίρνουν μηδέν.',
      },
      {
        q: 'Μπορώ να μονομαχώ ξανά και ξανά τον ίδιο παίκτη;',
        a: 'Υπάρχει προεπιλεγμένο όριο ανά ζευγάρι ενσωματωμένο στο παιχνίδι — 3 μονομαχίες, μέγιστο 10. Οι ρεβάνς μετράνε, οπότε δεν μπορείς να εκμεταλλεύεσαι έναν πιο αδύναμο αντίπαλο για πόντους.',
      },
      {
        q: 'Υπάρχει solo λειτουργία trivia;',
        a: 'Ναι — η λειτουργία Quiz τρέχει κατά τη φάση Pre-show, πριν ξεκλειδώσουν οι μονομαχίες. Ο οικοδεσπότης ξεκινάει γρήγορους γύρους· όλοι απαντούν παράλληλα και οι πόντοι προστίθενται στο σύνολο των προβλέψεων.',
      },
    ],
  },
};
