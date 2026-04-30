import type { Locale } from '../../../lib/seo/locale';

interface RelatedItem { href: string; title: string; blurb: string }

interface ScoreRow {
  label: string;
  value: string;
  tone: 'strong' | 'muted' | 'pinkBonus';
}

export interface ScoringCopy {
  meta: { title: string; description: string; keywords: string[] };
  schema: { articleHeadline: string; articleDescription: string };
  hero: { chip: string; title: string; lede: string };
  quiz: {
    title: string;
    intro: string;
    headers: [string, string];
    rows: ScoreRow[];
    note: string;
  };
  top5: {
    title: string;
    intro: string;
    headers: [string, string];
    rows: ScoreRow[];
    note: string;
  };
  worst5: {
    title: string;
    intro: string;
    headers: [string, string];
    rows: ScoreRow[];
    note: string;
  };
  duel: {
    title: string;
    intro: string;
    headers: [string, string];
    rows: ScoreRow[];
    body: string; // contains <strong>, <em>
  };
  stealDouble: {
    title: string;
    intro: string;
    stealTitle: string;
    stealBody: string; // html
    doubleTitle: string;
    doubleBody: string; // html
    note: string; // html with <em>
  };
  penalties: {
    title: string;
    items: { strong: string; rest: string }[];
  };
  example: {
    title: string;
    intro: string;
    items: { strong: string; rest: string }[];
  };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: { items: RelatedItem[] };
  crumbs: { home: string; current: string };
}

export const copy: Record<Locale, ScoringCopy> = {
  en: {
    meta: {
      title: 'Eurovision Games Scoring \u2014 Exact Formulas for Predictions, Quiz & Duels',
      description:
        'The exact scoring formulas Eurovision Games uses for Top-5 and Worst-5 predictions, quiz response-time tiers, duel point math, Steal vs Double, and edge cases.',
      keywords: [
        'eurovision games scoring',
        'eurovision points formula',
        'eurovision prediction scoring',
        'eurovision duel scoring',
      ],
    },
    schema: {
      articleHeadline: 'Eurovision Games \u2014 Exact Scoring Formulas',
      articleDescription:
        'Exact scoring formulas for Eurovision Games: Top-5 and Worst-5 prediction points, quiz response-time tiers, duel point math, and Steal vs Double effects.',
    },
    hero: {
      chip: 'Scoring formulas',
      title: 'Eurovision Games \u2014 exact scoring formulas',
      lede:
        'Every action maps to a transparent point total. This page lists the exact formulas the server uses to compute Top-5 and Worst-5 predictions, quiz answers, and duel outcomes \u2014 useful if you\u2019re strategising before the show or arguing with the host afterwards.',
    },
    quiz: {
      title: 'Quiz scoring',
      intro:
        'Each quiz round is 10 questions, 4 options per question, 15-second timer. Points are tier-based on response time \u2014 fast and right pays the most.',
      headers: ['Response time', 'Points (correct)'],
      rows: [
        { label: '0\u20133 seconds', value: '12', tone: 'strong' },
        { label: '3.01\u20137 seconds', value: '8', tone: 'strong' },
        { label: '7.01\u201315 seconds', value: '4', tone: 'strong' },
        { label: 'Wrong / timeout', value: '0', tone: 'muted' },
      ],
      note:
        'Maximum quiz points per round: 10 questions \u00d7 12 = <strong>120</strong>. Default night runs 3 rounds (host configurable, 1\u20133) for a quiz cap of <strong>360</strong> points.',
    },
    top5: {
      title: 'Top-5 prediction scoring',
      intro: 'Each Top-5 pick is scored against the official combined jury + televote ranking:',
      headers: ['Result', 'Points'],
      rows: [
        { label: 'Country at the exact position you predicted', value: '50', tone: 'strong' },
        { label: 'Country in the official Top 5 but at a different position', value: '20', tone: 'strong' },
        { label: 'Country outside the Top 5', value: '0', tone: 'muted' },
      ],
      note: 'Maximum Top-5 points: 5 exact positions \u00d7 50 = <strong>250</strong>.',
    },
    worst5: {
      title: 'Worst-5 prediction scoring',
      intro:
        'Symmetrical to Top-5, scored against the official bottom 5 (last-place country = position 1 in your Worst-5 list):',
      headers: ['Result', 'Points'],
      rows: [
        { label: 'Country at the exact bottom position you predicted', value: '50', tone: 'strong' },
        { label: 'Country in the official Worst 5 but at a different position', value: '20', tone: 'strong' },
        { label: 'Country outside the Worst 5', value: '0', tone: 'muted' },
      ],
      note: 'Maximum Worst-5 points: <strong>250</strong>. Combined predictions cap: <strong>500</strong>.',
    },
    duel: {
      title: 'Duel scoring',
      intro:
        'A duel is 3 trivia questions, head-to-head. Each correct answer scores by elapsed seconds \u2014 a half-second hesitation costs you a point.',
      headers: ['Scenario', 'Points'],
      rows: [
        { label: 'Correct answer at 0\u20131 seconds', value: '11\u201312', tone: 'strong' },
        { label: 'Correct answer at 5 seconds', value: '7', tone: 'strong' },
        { label: 'Correct answer at 11 seconds', value: '1', tone: 'strong' },
        { label: 'Wrong / timeout (\u226512s)', value: '0', tone: 'muted' },
        { label: 'Win bonus (higher answer total)', value: '+12', tone: 'pinkBonus' },
      ],
      body:
        'Whoever has the higher answer total wins the duel; if tied, faster total response time breaks it. The winner also pockets a flat <strong>+12</strong> duel-win bonus. Their total earned that duel is called <em>v_winner_score</em>.',
    },
    stealDouble: {
      title: 'Steal vs Double',
      intro: 'The duel winner picks one of two effects on the points they just earned:',
      stealTitle: '\u2694\ufe0f Steal',
      stealBody:
        'Take <em>v_winner_score</em> points from the loser\u2019s banked total. Capped at what the loser actually has \u2014 you cannot take them below zero. Zero-sum swing: your gain matches their loss. Best when overtaking the leader matters more than the absolute gain.',
      doubleTitle: '\u2728 Double',
      doubleBody:
        'Add another <em>v_winner_score</em> to your own total. Loser keeps their points. Better when you\u2019re already ahead and don\u2019t want to fuel a revenge challenge \u2014 strictly better when the loser has less than <em>v_winner_score</em> banked.',
      note:
        'Both pay the same to you when the opponent has at least <em>v_winner_score</em> banked; if they don\u2019t, Double pays more.',
    },
    penalties: {
      title: 'Penalties and edge cases',
      items: [
        { strong: 'Quitting mid-game.', rest: 'Player marked away. Predictions still auto-score; quiz and duel opportunities are forfeited.' },
        { strong: 'Refused duel challenges.', rest: 'Tracked per player but no point penalty. The Duelist trophy rewards participation.' },
        { strong: 'Mid-duel disconnect.', rest: 'Unanswered questions score 0; duel resolves on whoever has more points.' },
        { strong: 'Cheating', rest: '(multi-device, AI assist): host discretion; suggested resolution is voiding affected duels and quiz rounds.' },
        { strong: 'Steal cap.', rest: 'You cannot drag the loser below zero \u2014 if they have less banked than <em>v_winner_score</em>, Steal only takes what\u2019s there.' },
      ],
    },
    example: {
      title: 'Worked example',
      intro: 'You finished the night with:',
      items: [
        { strong: 'Quiz.', rest: '18 correct out of 30, mostly tier-2 timing \u2192 <strong>~144</strong> pts.' },
        { strong: 'Predictions.', rest: '1 exact Top-5 hit (50) + 2 in-Top-5 wrong-position (40) + 1 exact Worst-5 (50) + 1 in-Worst-5 (20) = <strong>160</strong> pts.' },
        { strong: 'Duels.', rest: 'Won 2, both Steal \u2014 28 pts swung your way and another 24 stolen on the second = 52 from steals + 2 \u00d7 12 win bonus = <strong>76</strong> pts net.' },
        { strong: 'Total: 380 pts.', rest: 'Likely Champion contender on a normal night.' },
      ],
    },
    cta: {
      title: 'Try the math live',
      body: 'Spin up a room and watch the points stack.',
      primary: 'Create room',
      secondary: 'How to play',
    },
    related: {
      items: [
        { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Top 5 and Worst 5 mechanics with the 2026 country list.' },
        { href: '/duels', title: 'Duels', blurb: 'Steal vs Double strategy, per-pair caps, and trophy impact.' },
        { href: '/eurovision-trivia', title: 'Trivia', blurb: '50+ sample questions and the bank quiz/duels pull from.' },
        { href: '/rules', title: 'Rule book', blurb: 'Phase-by-phase rules, sudden death, and edge cases.' },
        { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough from create-room to trophy reveal.' },
        { href: '/eurovision-night', title: 'Eurovision night', blurb: 'Hosting guide for grand-final night with a full timeline.' },
      ],
    },
    crumbs: { home: 'Home', current: 'Scoring' },
  },
  el: {
    meta: {
      title: 'Βαθμολογία Eurovision Games \u2014 Ακριβείς Φόρμουλες για Προβλέψεις, Quiz και Μονομαχίες',
      description:
        'Οι ακριβείς φόρμουλες βαθμολογίας του Eurovision Games για προβλέψεις Top-5 και Worst-5, κλίμακες χρόνου απάντησης quiz, μαθηματικά μονομαχιών, Κλοπή vs Διπλασιασμό και ακραίες περιπτώσεις.',
      keywords: [
        'eurovision games βαθμολογία',
        'eurovision φόρμουλα πόντων',
        'eurovision προβλέψεις βαθμολογία',
        'eurovision μονομαχίες βαθμολογία',
      ],
    },
    schema: {
      articleHeadline: 'Eurovision Games \u2014 Ακριβείς Φόρμουλες Βαθμολογίας',
      articleDescription:
        'Ακριβείς φόρμουλες βαθμολογίας για Eurovision Games: πόντοι προβλέψεων Top-5 και Worst-5, κλίμακες χρόνου απάντησης quiz, μαθηματικά μονομαχιών και επιδράσεις Κλοπής vs Διπλασιασμού.',
    },
    hero: {
      chip: 'Φόρμουλες βαθμολογίας',
      title: 'Βαθμολογία και Φόρμουλες \u2014 ακριβείς φόρμουλες του Eurovision Games',
      lede:
        'Κάθε ενέργεια αντιστοιχεί σε ένα διαφανές σύνολο πόντων. Η σελίδα δείχνει τις ακριβείς φόρμουλες που χρησιμοποιεί ο server για προβλέψεις Top-5 και Worst-5, απαντήσεις quiz και αποτελέσματα μονομαχιών \u2014 χρήσιμο αν χαράζεις στρατηγική πριν την εκπομπή ή τσακώνεσαι με τον οικοδεσπότη μετά.',
    },
    quiz: {
      title: 'Βαθμολογία quiz',
      intro:
        'Κάθε γύρος quiz έχει 10 ερωτήσεις, 4 επιλογές ανά ερώτηση, χρονόμετρο 15 δευτερολέπτων. Οι πόντοι είναι κλιμακωτοί ανάλογα με τον χρόνο απάντησης \u2014 γρήγορα και σωστά πληρώνει τα περισσότερα.',
      headers: ['Χρόνος απάντησης', 'Πόντοι (σωστά)'],
      rows: [
        { label: '0\u20133 δευτερόλεπτα', value: '12', tone: 'strong' },
        { label: '3.01\u20137 δευτερόλεπτα', value: '8', tone: 'strong' },
        { label: '7.01\u201315 δευτερόλεπτα', value: '4', tone: 'strong' },
        { label: 'Λάθος / λήξη χρόνου', value: '0', tone: 'muted' },
      ],
      note:
        'Μέγιστοι πόντοι quiz ανά γύρο: 10 ερωτήσεις \u00d7 12 = <strong>120</strong>. Η προεπιλεγμένη βραδιά τρέχει 3 γύρους (παραμετροποιήσιμο από τον οικοδεσπότη, 1\u20133), για όριο quiz <strong>360</strong> πόντων.',
    },
    top5: {
      title: 'Βαθμολογία πρόβλεψης Top-5',
      intro: 'Κάθε επιλογή Top-5 βαθμολογείται με βάση την επίσημη συνδυαστική κατάταξη κριτικής επιτροπής + televote:',
      headers: ['Αποτέλεσμα', 'Πόντοι'],
      rows: [
        { label: 'Χώρα στην ακριβή θέση που προέβλεψες', value: '50', tone: 'strong' },
        { label: 'Χώρα στο επίσημο Top 5 αλλά σε διαφορετική θέση', value: '20', tone: 'strong' },
        { label: 'Χώρα εκτός Top 5', value: '0', tone: 'muted' },
      ],
      note: 'Μέγιστοι πόντοι Top-5: 5 ακριβείς θέσεις \u00d7 50 = <strong>250</strong>.',
    },
    worst5: {
      title: 'Βαθμολογία πρόβλεψης Worst-5',
      intro:
        'Συμμετρικό με το Top-5, βαθμολογείται με βάση το επίσημο bottom 5 (η τελευταία θέση = θέση 1 στη λίστα Worst-5 σου):',
      headers: ['Αποτέλεσμα', 'Πόντοι'],
      rows: [
        { label: 'Χώρα στην ακριβή τελευταία θέση που προέβλεψες', value: '50', tone: 'strong' },
        { label: 'Χώρα στο επίσημο Worst 5 αλλά σε διαφορετική θέση', value: '20', tone: 'strong' },
        { label: 'Χώρα εκτός Worst 5', value: '0', tone: 'muted' },
      ],
      note: 'Μέγιστοι πόντοι Worst-5: <strong>250</strong>. Συνδυαστικό όριο προβλέψεων: <strong>500</strong>.',
    },
    duel: {
      title: 'Βαθμολογία μονομαχίας',
      intro:
        'Μια μονομαχία είναι 3 ερωτήσεις trivia, ένας προς έναν. Κάθε σωστή απάντηση βαθμολογείται ανά δευτερόλεπτο που πέρασε \u2014 μισό δευτερόλεπτο δισταγμός κοστίζει έναν πόντο.',
      headers: ['Σενάριο', 'Πόντοι'],
      rows: [
        { label: 'Σωστή απάντηση στα 0\u20131 δευτερόλεπτα', value: '11\u201312', tone: 'strong' },
        { label: 'Σωστή απάντηση στα 5 δευτερόλεπτα', value: '7', tone: 'strong' },
        { label: 'Σωστή απάντηση στα 11 δευτερόλεπτα', value: '1', tone: 'strong' },
        { label: 'Λάθος / λήξη χρόνου (\u226512δ)', value: '0', tone: 'muted' },
        { label: 'Μπόνους νίκης (υψηλότερο σύνολο απαντήσεων)', value: '+12', tone: 'pinkBonus' },
      ],
      body:
        'Όποιος έχει το υψηλότερο σύνολο απαντήσεων κερδίζει τη μονομαχία· σε ισοπαλία, σπάει ο γρηγορότερος συνολικός χρόνος απάντησης. Ο νικητής παίρνει επίσης σταθερό μπόνους νίκης <strong>+12</strong>. Το σύνολο που κέρδισε σε εκείνη τη μονομαχία ονομάζεται <em>v_winner_score</em>.',
    },
    stealDouble: {
      title: 'Κλοπή vs Διπλασιασμός',
      intro: 'Ο νικητής της μονομαχίας διαλέγει μία από δύο επιδράσεις στους πόντους που μόλις κέρδισε:',
      stealTitle: '\u2694\ufe0f Κλοπή',
      stealBody:
        'Πάρε <em>v_winner_score</em> πόντους από το κατοχυρωμένο σύνολο του ηττημένου. Με όριο όσα έχει πραγματικά ο ηττημένος \u2014 δεν μπορείς να τον πας κάτω από το μηδέν. Μηδενικού αθροίσματος μετατόπιση: το κέρδος σου ισούται με την απώλειά του. Καλύτερο όταν η προσπέραση του πρώτου μετράει περισσότερο από το απόλυτο κέρδος.',
      doubleTitle: '\u2728 Διπλασιασμός',
      doubleBody:
        'Πρόσθεσε άλλο ένα <em>v_winner_score</em> στο δικό σου σύνολο. Ο ηττημένος κρατά τους πόντους του. Καλύτερο όταν είσαι ήδη μπροστά και δεν θες να τροφοδοτήσεις πρόκληση εκδίκησης \u2014 αυστηρά καλύτερο όταν ο ηττημένος έχει λιγότερα από <em>v_winner_score</em> κατοχυρωμένα.',
      note:
        'Και τα δύο πληρώνουν το ίδιο σε σένα όταν ο αντίπαλος έχει τουλάχιστον <em>v_winner_score</em> κατοχυρωμένα· αν δεν έχει, ο Διπλασιασμός πληρώνει περισσότερα.',
    },
    penalties: {
      title: 'Ποινές και ακραίες περιπτώσεις',
      items: [
        { strong: 'Αποχώρηση μέσα στο παιχνίδι.', rest: 'Ο παίκτης μαρκάρεται απών. Οι προβλέψεις βαθμολογούνται αυτόματα· οι ευκαιρίες quiz και μονομαχιών χάνονται.' },
        { strong: 'Αρνημένες προκλήσεις μονομαχιών.', rest: 'Καταγράφονται ανά παίκτη αλλά χωρίς ποινή πόντων. Το τρόπαιο Μονομάχος ανταμείβει τη συμμετοχή.' },
        { strong: 'Αποσύνδεση μέσα σε μονομαχία.', rest: 'Οι αναπάντητες ερωτήσεις παίρνουν 0· η μονομαχία κρίνεται από όποιον έχει περισσότερους πόντους.' },
        { strong: 'Ζαβολιά', rest: '(πολλαπλές συσκευές, βοήθεια AI): στη διακριτική ευχέρεια του οικοδεσπότη· προτεινόμενη λύση είναι η ακύρωση των μονομαχιών και γύρων quiz που επηρεάστηκαν.' },
        { strong: 'Όριο Κλοπής.', rest: 'Δεν μπορείς να σύρεις τον ηττημένο κάτω από το μηδέν \u2014 αν έχει λιγότερα κατοχυρωμένα από <em>v_winner_score</em>, η Κλοπή παίρνει μόνο όσα υπάρχουν.' },
      ],
    },
    example: {
      title: 'Λυμένο παράδειγμα',
      intro: 'Τελείωσες τη βραδιά με:',
      items: [
        { strong: 'Quiz.', rest: '18 σωστές στις 30, κυρίως κλίμακας 2 ως προς τον χρόνο \u2192 <strong>~144</strong> πόντοι.' },
        { strong: 'Προβλέψεις.', rest: '1 ακριβής Top-5 (50) + 2 εντός Top-5 σε λάθος θέση (40) + 1 ακριβής Worst-5 (50) + 1 εντός Worst-5 (20) = <strong>160</strong> πόντοι.' },
        { strong: 'Μονομαχίες.', rest: 'Κερδισμένες 2, και οι δύο Κλοπή \u2014 28 πόντοι ήρθαν προς εσένα και άλλοι 24 κλεμμένοι στη δεύτερη = 52 από κλοπές + 2 \u00d7 12 μπόνους νίκης = <strong>76</strong> πόντοι καθαρά.' },
        { strong: 'Σύνολο: 380 πόντοι.', rest: 'Πιθανός διεκδικητής τίτλου Πρωταθλητή σε μια κανονική βραδιά.' },
      ],
    },
    cta: {
      title: 'Δοκίμασε τα μαθηματικά ζωντανά',
      body: 'Φτιάξε ένα δωμάτιο και δες τους πόντους να μαζεύονται.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Πώς παίζεται',
    },
    related: {
      items: [
        { href: '/eurovision-2026-predictions', title: 'Προβλέψεις', blurb: 'Μηχανική Top 5 και Worst 5 με τη λίστα χωρών 2026.' },
        { href: '/duels', title: 'Μονομαχίες', blurb: 'Στρατηγική Κλοπής vs Διπλασιασμού, όρια ανά ζευγάρι και επίδραση στα τρόπαια.' },
        { href: '/eurovision-trivia', title: 'Trivia', blurb: '50+ ενδεικτικές ερωτήσεις και η τράπεζα από όπου τραβάνε quiz/μονομαχίες.' },
        { href: '/rules', title: 'Κανονισμός', blurb: 'Κανόνες ανά φάση, sudden death και ακραίες περιπτώσεις.' },
        { href: '/how-to-play', title: 'Πώς παίζεται', blurb: 'Οδηγός εγκατάστασης 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.' },
        { href: '/eurovision-night', title: 'Eurovision night', blurb: 'Οδηγός hosting για τη βραδιά του τελικού με πλήρες χρονοδιάγραμμα.' },
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Βαθμολογία' },
  },
};
