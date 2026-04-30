import type { Locale } from '../../../lib/seo/locale';

interface RelatedItem {
  href: string;
  title: string;
  blurb: string;
}

interface Step {
  name: string;
  text: string;
}

interface PredictionItem {
  label: string;
  body: string;
}

export interface HowToPlayCopy {
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
  schema: {
    articleHeadline: string;
    articleDescription: string;
    howToName: string;
    howToDescription: string;
    steps: Step[];
  };
  hero: {
    chip: string;
    title: string;
    lede: string;
  };
  setup: {
    title: string;
    intro: string;
    items: { strong: string; rest: string }[];
  };
  predictions: {
    title: string;
    intro: string;
    items: PredictionItem[];
  };
  duels: {
    title: string;
    intro: string;
    cardTitle: string;
    cardBody: string; // contains rich html via dangerouslySetInnerHTML? we'll inline as JSX; keep as plain string with placeholders
    capLine: string;
  };
  scoring: {
    title: string;
    intro: string;
    items: { strong: string; rest: string }[];
  };
  trophies: {
    title: string;
    intro: string;
    items: { strong: string; rest: string }[];
    note: string;
  };
  suddenDeath: {
    title: string;
    body: string;
  };
  whatYouNeed: {
    title: string;
    items: { strong: string; rest: string }[];
  };
  cta: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
  related: {
    items: RelatedItem[];
  };
  crumbs: { home: string; current: string };
}

export const copy: Record<Locale, HowToPlayCopy> = {
  en: {
    meta: {
      title: 'How to Play Eurovision Games \u2014 2-Minute Setup Guide',
      description:
        'Quick guide to running a Eurovision watch party with predictions, trivia duels, and live scoring. Setup takes 60 seconds, supports 2-20 players, no app install.',
      keywords: [
        'eurovision games how to play',
        'eurovision party game setup',
        'free eurovision watch party game',
        'eurovision rules',
        'eurovision drinking game alternative',
      ],
    },
    schema: {
      articleHeadline: 'How to Play Eurovision Games \u2014 2-Minute Setup Guide',
      articleDescription:
        'Step-by-step guide to running a Eurovision watch party with predictions, trivia duels, and live scoring. Setup takes 60 seconds.',
      howToName: 'How to play Eurovision Games',
      howToDescription:
        'A 60-second setup that takes you from create-room to trophy reveal across the full Eurovision broadcast.',
      steps: [
        { name: 'Create a room', text: 'Click "Create Room", set max players (2-20) and quiz rounds (1-3).' },
        { name: 'Invite friends', text: 'Share the 6-character room code, link, and auto-generated room password. Friends join in their browser, no app install.' },
        { name: 'Lock predictions', text: 'Each player picks their Top 5 and Worst 5 of Eurovision 2026. Picks lock when the host advances the phase.' },
        { name: 'Battle in duels', text: 'During the live show, challenge friends to head-to-head 3-question trivia duels. Steal points or double your own.' },
        { name: 'Watch live scoring', text: 'As Eurovision jury and televote results land, predictions auto-score and the leaderboard updates in real time.' },
        { name: 'Crown winners', text: 'Five trophies reveal at the end: Champion, Thief, Duelist, Oracle, Guru. Optional sudden-death tiebreak settles ties.' },
      ],
    },
    hero: {
      chip: 'Setup guide',
      title: 'How to play Eurovision Games in 60 seconds',
      lede:
        'A free, browser-based party game for the Eurovision Song Contest. Players predict the Top 5 and Worst 5, battle in head-to-head trivia duels, and chase five winner trophies \u2014 all while the show is on. No app, no account for guests, 2 to 20 players.',
    },
    setup: {
      title: 'Setup in 60 seconds',
      intro:
        'One host signs in (magic-link email \u2014 no password). Everyone else joins from a link. The whole flow from empty browser tab to locked-in predictions is a single minute.',
      items: [
        { strong: 'Create the room (10s).', rest: 'Click <em>Create Room</em>. Pick quiz rounds (default 3) and max players (up to 20). A 6-character room code appears.' },
        { strong: 'Invite friends (20s).', rest: 'Share the code, the join link, and the auto-generated room password (included in the share message). Phone or laptop, any modern browser.' },
        { strong: 'Lock predictions (5 min before kick-off).', rest: 'Every player builds a Top 5 and Worst 5. Picks lock when the host advances past the predictions phase.' },
        { strong: 'Trivia warm-up.', rest: 'Quiz rounds run during the predictions phase as filler \u2014 points carry into the night total.' },
        { strong: 'Live show \u2014 duel time.', rest: 'Once the host advances to Live Show, quiz closes and duels open. Challenge anyone in the room.' },
        { strong: 'Trophy reveal.', rest: 'When results are entered, the room moves to Final and five winners are crowned.' },
      ],
    },
    predictions: {
      title: 'Lock predictions',
      intro:
        'Predictions are the bedrock of the night \u2014 they score automatically the moment Eurovision results come in, so they reward homework and a bit of nerve.',
      items: [
        { label: 'Top 5.', body: 'The five countries you think will finish 1\u20135 in the official combined ranking, in your predicted order.' },
        { label: 'Worst 5.', body: 'The five countries you think will finish bottom of the leaderboard, ordered last-place first.' },
        { label: 'No overlap.', body: 'A country can appear in only one list per player.' },
        { label: 'Order matters.', body: 'An exact-position hit pays 50 points; a country that lands in the right list at the wrong rank pays 20.' },
        { label: 'Hard lock.', body: 'Once the host advances past Predictions, no edits. Late joiners can still play trivia and duels but cannot enter predictions.' },
      ],
    },
    duels: {
      title: 'Trivia duels during the show',
      intro:
        'A duel is a 3-question Eurovision trivia battle between two players in the room. Questions fire on a 12-second timer; speed and accuracy both count.',
      cardTitle: 'How a duel plays out',
      cardBody:
        'Tap any other player\u2019s name during the live show and choose <em>Challenge</em>. Both players answer the same 3 questions in private. The higher answer total wins the duel and pockets a flat <strong>+12</strong> bonus. The winner then picks <strong>Steal</strong> (take points from the loser) or <strong>Double</strong> (add the same to themselves).',
      capLine:
        'A default cap of 3 duels per pair (max 10), with rematches counted, prevents grinding one opponent for points all night. Refused challenges don\u2019t count against the cap.',
    },
    scoring: {
      title: 'Live scoring',
      intro:
        'As Eurovision jury and televote results come in, predictions auto-score against the official combined ranking and the leaderboard updates instantly for everyone in the room.',
      items: [
        { strong: 'Top 5 / Worst 5', rest: 'score against the final combined ranking the moment results land.' },
        { strong: 'Quiz points', rest: 'are banked from the predictions phase and never change.' },
        { strong: 'Duel points', rest: 'swing in real time as duels resolve through the broadcast.' },
        { strong: 'Either', rest: 'the host enters jury and televote results live, or the auto-parser pulls them on grand-final night.' },
      ],
    },
    trophies: {
      title: 'Five winner trophies',
      intro: 'At the end of the night, five trophy cards reveal in sequence:',
      items: [
        { strong: 'Champion', rest: '\u2014 most total points across every phase. The headline title.' },
        { strong: 'Thief', rest: '\u2014 most points stolen via duel Steal effects.' },
        { strong: 'Duelist', rest: '\u2014 most duels won across the night.' },
        { strong: 'Oracle', rest: '\u2014 highest prediction-only score (Top 5 + Worst 5 totals).' },
        { strong: 'Guru', rest: '\u2014 most correct trivia answers across quiz and duels combined.' },
      ],
      note:
        'One player can win multiple trophies. Co-winners (2\u20135 tied) split a single trophy unless the host triggers sudden death.',
    },
    suddenDeath: {
      title: 'Sudden-death tiebreak',
      body:
        'For any tied trophy category, the host can open a 20-second sudden-death round. One trivia question, all tied players answer in parallel \u2014 fastest correct answer wins the title outright. If nobody is correct, the co-winner status persists.',
    },
    whatYouNeed: {
      title: 'What you need',
      items: [
        { strong: 'A modern browser.', rest: 'Chrome 120+, Safari 17+, Firefox 121+, Edge 120+ \u2014 phone or desktop. PWA install on iOS and Android.' },
        { strong: '2 to 20 players.', rest: 'Couples can share a single device.' },
        { strong: 'The Eurovision broadcast.', rest: 'TV, official stream, or the EBU\u2019s YouTube live feed \u2014 anything that lets you watch in real time.' },
        { strong: 'No payment, no install, no account for guests.', rest: 'Only the host signs in.' },
      ],
    },
    cta: {
      title: 'Start a room now',
      body: '60 seconds, no install, no account.',
      primary: 'Create room',
      secondary: 'Eurovision night',
    },
    related: {
      items: [
        { href: '/eurovision-2026-predictions', title: 'Predictions explained', blurb: 'Top 5 and Worst 5 mechanics, scoring, and 2026 country list.' },
        { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '50+ sample questions and the bank quiz/duels pull from.' },
        { href: '/duels', title: 'Duel deep-dive', blurb: 'Steal vs Double strategy, per-pair caps, and trophy impact.' },
        { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact point math behind every prediction, quiz answer, and duel.' },
        { href: '/rules', title: 'Full rule book', blurb: 'Phase-by-phase rules, disconnect policy, and edge cases.' },
        { href: '/faq', title: 'FAQ', blurb: 'Quick answers on creating rooms, joining, and leaving mid-night.' },
      ],
    },
    crumbs: { home: 'Home', current: 'How to play' },
  },
  el: {
    meta: {
      title: 'Πώς Παίζεται το Eurovision Games \u2014 Οδηγός 2 λεπτών',
      description:
        'Σύντομος οδηγός για να στήσεις ένα Eurovision watch party με προβλέψεις, μονομαχίες trivia και live βαθμολογία. Η εγκατάσταση παίρνει 60 δευτερόλεπτα, για 2-20 παίκτες, χωρίς εφαρμογή.',
      keywords: [
        'eurovision games πώς παίζεται',
        'eurovision party παιχνίδι',
        'δωρεάν eurovision watch party',
        'eurovision κανόνες',
        'eurovision drinking game εναλλακτική',
      ],
    },
    schema: {
      articleHeadline: 'Πώς Παίζεται το Eurovision Games \u2014 Οδηγός 2 λεπτών',
      articleDescription:
        'Βήμα προς βήμα οδηγός για να στήσεις ένα Eurovision watch party με προβλέψεις, μονομαχίες trivia και live βαθμολογία. Η εγκατάσταση παίρνει 60 δευτερόλεπτα.',
      howToName: 'Πώς να παίξεις το Eurovision Games',
      howToDescription:
        'Εγκατάσταση 60 δευτερολέπτων που σε πάει από τη δημιουργία δωματίου μέχρι την αποκάλυψη των τροπαίων μέσα από όλη τη μετάδοση της Eurovision.',
      steps: [
        { name: 'Δημιουργία δωματίου', text: 'Πάτα "Δημιουργία Δωματίου", όρισε μέγιστους παίκτες (2-20) και γύρους quiz (1-3).' },
        { name: 'Πρόσκληση φίλων', text: 'Μοιράσου τον 6ψήφιο κωδικό δωματίου, τον σύνδεσμο και τον αυτόματο κωδικό δωματίου. Οι φίλοι μπαίνουν από τον browser τους, χωρίς εφαρμογή.' },
        { name: 'Κλείδωμα προβλέψεων', text: 'Κάθε παίκτης διαλέγει το Top 5 και Worst 5 για τη Eurovision 2026. Οι επιλογές κλειδώνουν όταν ο οικοδεσπότης προχωρά τη φάση.' },
        { name: 'Μάχη στις μονομαχίες', text: 'Στη ζωντανή εκπομπή, προκάλεσε φίλους σε μονομαχίες trivia 3 ερωτήσεων ένας προς έναν. Κλέψε πόντους ή διπλασίασε τους δικούς σου.' },
        { name: 'Live βαθμολογία', text: 'Καθώς έρχονται τα αποτελέσματα κριτικής επιτροπής και televote, οι προβλέψεις βαθμολογούνται αυτόματα και ο πίνακας βαθμολογίας ενημερώνεται σε πραγματικό χρόνο.' },
        { name: 'Στέψη νικητών', text: 'Στο τέλος αποκαλύπτονται πέντε τρόπαια: Πρωταθλητής, Κλέφτης, Μονομάχος, Μάντης, Γκουρού. Προαιρετικό sudden death σπάει τις ισοπαλίες.' },
      ],
    },
    hero: {
      chip: 'Οδηγός εκκίνησης',
      title: 'Πώς Παίζεται το Eurovision Games σε 60 δευτερόλεπτα',
      lede:
        'Ένα δωρεάν παιχνίδι μέσα στον browser για τον διαγωνισμό τραγουδιού της Eurovision. Οι παίκτες προβλέπουν το Top 5 και το Worst 5, μάχονται σε μονομαχίες trivia ένας προς έναν και κυνηγούν πέντε τρόπαια \u2014 όλα ενώ παίζει η εκπομπή. Χωρίς εφαρμογή, χωρίς λογαριασμό για τους καλεσμένους, από 2 έως 20 παίκτες.',
    },
    setup: {
      title: 'Εγκατάσταση σε 60 δευτερόλεπτα',
      intro:
        'Ένας οικοδεσπότης συνδέεται (magic-link στο email \u2014 χωρίς κωδικό). Όλοι οι άλλοι μπαίνουν από έναν σύνδεσμο. Όλη η ροή από την κενή καρτέλα του browser μέχρι τις κλειδωμένες προβλέψεις είναι ένα λεπτό.',
      items: [
        { strong: 'Φτιάξε το δωμάτιο (10δ).', rest: 'Πάτα <em>Δημιουργία Δωματίου</em>. Διάλεξε γύρους quiz (προεπιλογή 3) και μέγιστους παίκτες (έως 20). Εμφανίζεται ένας 6ψήφιος κωδικός δωματίου.' },
        { strong: 'Κάλεσε φίλους (20δ).', rest: 'Μοιράσου τον κωδικό, τον σύνδεσμο και τον αυτόματο κωδικό δωματίου (περιέχεται στο μήνυμα). Κινητό ή laptop, οποιοσδήποτε σύγχρονος browser.' },
        { strong: 'Κλείδωσε προβλέψεις (5 λεπτά πριν την έναρξη).', rest: 'Κάθε παίκτης φτιάχνει ένα Top 5 και ένα Worst 5. Οι επιλογές κλειδώνουν όταν ο οικοδεσπότης περάσει τη φάση των προβλέψεων.' },
        { strong: 'Προθέρμανση trivia.', rest: 'Οι γύροι quiz τρέχουν στη φάση των προβλέψεων ως γέμισμα \u2014 οι πόντοι μετράνε στο σύνολο της βραδιάς.' },
        { strong: 'Ζωντανή εκπομπή \u2014 ώρα για μονομαχίες.', rest: 'Μόλις ο οικοδεσπότης περάσει στη Ζωντανή Εκπομπή, το quiz κλείνει και ανοίγουν οι μονομαχίες. Προκάλεσε όποιον θες στο δωμάτιο.' },
        { strong: 'Αποκάλυψη τροπαίων.', rest: 'Όταν καταχωρηθούν τα αποτελέσματα, το δωμάτιο πάει σε Final και στέφονται πέντε νικητές.' },
      ],
    },
    predictions: {
      title: 'Κλείδωμα προβλέψεων',
      intro:
        'Οι προβλέψεις είναι ο πυρήνας της βραδιάς \u2014 βαθμολογούνται αυτόματα τη στιγμή που έρχονται τα αποτελέσματα της Eurovision, οπότε ανταμείβουν τη μελέτη και λίγο τσαγανό.',
      items: [
        { label: 'Top 5.', body: 'Οι πέντε χώρες που πιστεύεις ότι θα τερματίσουν 1\u20135 στην επίσημη συνδυαστική κατάταξη, με τη σειρά που προβλέπεις.' },
        { label: 'Worst 5.', body: 'Οι πέντε χώρες που πιστεύεις ότι θα μείνουν στον πάτο, με πρώτη την τελευταία θέση.' },
        { label: 'Χωρίς επικάλυψη.', body: 'Μια χώρα μπορεί να εμφανιστεί σε μία μόνο λίστα ανά παίκτη.' },
        { label: 'Η σειρά μετράει.', body: 'Ακριβής θέση δίνει 50 πόντους· χώρα στη σωστή λίστα αλλά σε λάθος θέση δίνει 20.' },
        { label: 'Σκληρό κλείδωμα.', body: 'Μόλις ο οικοδεσπότης περάσει τις Προβλέψεις, καμία επεξεργασία. Όσοι μπουν αργότερα παίζουν trivia και μονομαχίες αλλά δεν μπορούν να καταχωρήσουν προβλέψεις.' },
      ],
    },
    duels: {
      title: 'Μονομαχίες trivia μέσα στην εκπομπή',
      intro:
        'Μια μονομαχία είναι μια μάχη trivia 3 ερωτήσεων μεταξύ δύο παικτών στο δωμάτιο. Οι ερωτήσεις τρέχουν σε χρονόμετρο 12 δευτερολέπτων· μετράει και η ταχύτητα και η ακρίβεια.',
      cardTitle: 'Πώς εξελίσσεται μια μονομαχία',
      cardBody:
        'Πάτα το όνομα οποιουδήποτε άλλου παίκτη στη ζωντανή εκπομπή και διάλεξε <em>Πρόκληση</em>. Και οι δύο παίκτες απαντούν τις ίδιες 3 ερωτήσεις σε ιδιωτικό περιβάλλον. Όποιος έχει το υψηλότερο σύνολο κερδίζει τη μονομαχία και παίρνει σταθερό μπόνους <strong>+12</strong>. Ο νικητής μετά διαλέγει <strong>Κλοπή</strong> (παίρνει πόντους από τον ηττημένο) ή <strong>Διπλασιασμό</strong> (προσθέτει τους ίδιους στον εαυτό του).',
      capLine:
        'Προεπιλεγμένο όριο 3 μονομαχιών ανά ζευγάρι (μέγιστο 10), με τις ρεβάνς να μετράνε, για να μην τα «βγάζει» κανείς από έναν παίκτη όλο το βράδυ. Οι αρνημένες προκλήσεις δεν μετράνε στο όριο.',
    },
    scoring: {
      title: 'Live βαθμολογία',
      intro:
        'Καθώς έρχονται τα αποτελέσματα κριτικής επιτροπής και televote της Eurovision, οι προβλέψεις βαθμολογούνται αυτόματα με βάση την επίσημη συνδυαστική κατάταξη και ο πίνακας βαθμολογίας ενημερώνεται ακαριαία για όλους στο δωμάτιο.',
      items: [
        { strong: 'Top 5 / Worst 5', rest: 'βαθμολογούνται με βάση την τελική συνδυαστική κατάταξη τη στιγμή που έρχονται τα αποτελέσματα.' },
        { strong: 'Πόντοι quiz', rest: 'κατοχυρώνονται από τη φάση των προβλέψεων και δεν αλλάζουν.' },
        { strong: 'Πόντοι μονομαχιών', rest: 'παίζουν σε πραγματικό χρόνο καθώς οι μονομαχίες κλείνουν στη μετάδοση.' },
        { strong: 'Είτε', rest: 'ο οικοδεσπότης καταχωρεί ζωντανά τα αποτελέσματα κριτικής επιτροπής και televote, είτε ο auto-parser τα τραβάει τη βραδιά του τελικού.' },
      ],
    },
    trophies: {
      title: 'Πέντε τρόπαια νικητών',
      intro: 'Στο τέλος της βραδιάς αποκαλύπτονται διαδοχικά πέντε κάρτες τροπαίων:',
      items: [
        { strong: 'Πρωταθλητής', rest: '\u2014 περισσότεροι συνολικοί πόντοι σε όλες τις φάσεις. Ο κεντρικός τίτλος.' },
        { strong: 'Κλέφτης', rest: '\u2014 περισσότεροι πόντοι κλεμμένοι μέσω Κλοπής σε μονομαχίες.' },
        { strong: 'Μονομάχος', rest: '\u2014 περισσότερες μονομαχίες κερδισμένες σε όλη τη βραδιά.' },
        { strong: 'Μάντης', rest: '\u2014 υψηλότερη βαθμολογία προβλέψεων (σύνολα Top 5 + Worst 5).' },
        { strong: 'Γκουρού', rest: '\u2014 περισσότερες σωστές απαντήσεις trivia σε quiz και μονομαχίες μαζί.' },
      ],
      note:
        'Ένας παίκτης μπορεί να κερδίσει πολλά τρόπαια. Συν-νικητές (2\u20135 ισόπαλοι) μοιράζονται ένα τρόπαιο εκτός αν ο οικοδεσπότης ενεργοποιήσει sudden death.',
    },
    suddenDeath: {
      title: 'Sudden death για ισοπαλίες',
      body:
        'Για κάθε κατηγορία τροπαίου με ισοπαλία, ο οικοδεσπότης μπορεί να ανοίξει έναν γύρο sudden death 20 δευτερολέπτων. Μία ερώτηση trivia, όλοι οι ισόπαλοι παίκτες απαντούν παράλληλα \u2014 η πιο γρήγορη σωστή απάντηση κερδίζει τον τίτλο. Αν κανείς δεν είναι σωστός, η συν-νίκη παραμένει.',
    },
    whatYouNeed: {
      title: 'Τι χρειάζεσαι',
      items: [
        { strong: 'Έναν σύγχρονο browser.', rest: 'Chrome 120+, Safari 17+, Firefox 121+, Edge 120+ \u2014 κινητό ή υπολογιστή. Εγκατάσταση ως PWA σε iOS και Android.' },
        { strong: '2 έως 20 παίκτες.', rest: 'Τα ζευγάρια μπορούν να μοιραστούν μία συσκευή.' },
        { strong: 'Τη μετάδοση της Eurovision.', rest: 'Τηλεόραση, επίσημο stream ή το YouTube live feed της EBU \u2014 οτιδήποτε σε αφήνει να βλέπεις σε πραγματικό χρόνο.' },
        { strong: 'Χωρίς πληρωμή, χωρίς εγκατάσταση, χωρίς λογαριασμό για καλεσμένους.', rest: 'Μόνο ο οικοδεσπότης συνδέεται.' },
      ],
    },
    cta: {
      title: 'Φτιάξε ένα δωμάτιο τώρα',
      body: '60 δευτερόλεπτα, χωρίς εγκατάσταση, χωρίς λογαριασμό.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Eurovision night',
    },
    related: {
      items: [
        { href: '/eurovision-2026-predictions', title: 'Προβλέψεις', blurb: 'Μηχανική Top 5 και Worst 5, βαθμολογία και λίστα χωρών 2026.' },
        { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '50+ ενδεικτικές ερωτήσεις και η τράπεζα από όπου τραβάνε quiz/μονομαχίες.' },
        { href: '/duels', title: 'Μονομαχίες σε βάθος', blurb: 'Στρατηγική Κλοπής vs Διπλασιασμού, όρια ανά ζευγάρι και επίδραση στα τρόπαια.' },
        { href: '/scoring', title: 'Φόρμουλες βαθμολογίας', blurb: 'Ακριβή μαθηματικά πόντων για κάθε πρόβλεψη, απάντηση quiz και μονομαχία.' },
        { href: '/rules', title: 'Πλήρης κανονισμός', blurb: 'Κανόνες ανά φάση, πολιτική αποσύνδεσης και ακραίες περιπτώσεις.' },
        { href: '/faq', title: 'Συχνές Ερωτήσεις', blurb: 'Σύντομες απαντήσεις για δημιουργία, είσοδο και αποχώρηση μέσα στη βραδιά.' },
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Πώς παίζεται' },
  },
};
