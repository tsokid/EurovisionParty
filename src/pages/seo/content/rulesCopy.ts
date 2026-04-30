import type { Locale } from '../../../lib/seo/locale';

interface RelatedItem {
  href: string;
  title: string;
  blurb: string;
}

interface BulletItem {
  strong: string;
  rest: string;
}

export interface RulesCopy {
  meta: { title: string; description: string; keywords: string[] };
  schema: { articleHeadline: string; articleDescription: string };
  hero: { chip: string; title: string; lede: string };
  hostLimits: { title: string; items: BulletItem[] };
  phases: {
    title: string;
    intro: string;
    headers: [string, string, string];
    rows: [string, string, string][];
  };
  predictions: { title: string; items: BulletItem[] };
  quiz: { title: string; items: BulletItem[] };
  duels: { title: string; items: BulletItem[] };
  trophies: {
    title: string;
    intro: string;
    items: BulletItem[];
    note: string;
  };
  suddenDeath: {
    title: string;
    body: string;
    cardTitle: string;
    cardBody: string;
  };
  disconnect: { title: string; items: BulletItem[] };
  edgeCases: { title: string; items: BulletItem[] };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: { items: RelatedItem[] };
  crumbs: { home: string; current: string };
}

export const copy: Record<Locale, RulesCopy> = {
  en: {
    meta: {
      title: 'Eurovision Games Rules \u2014 Full Rule Book (2026)',
      description:
        'The complete rules of Eurovision Games: phases, prediction lists, trivia duels, scoring, winner categories, sudden-death tiebreak, and dispute resolution.',
      keywords: [
        'eurovision games rules',
        'eurovision party game rules',
        'eurovision trivia rules',
        'eurovision prediction rules',
      ],
    },
    schema: {
      articleHeadline: 'Eurovision Games \u2014 Full Rule Book (2026)',
      articleDescription:
        'The complete rules of Eurovision Games: phases, prediction lists, trivia duels, scoring, winner categories, sudden-death tiebreak, disputes, and edge cases.',
    },
    hero: {
      chip: 'Rule book',
      title: 'Eurovision Games \u2014 the full rule book',
      lede:
        'Everything one host or one player needs to settle a dispute mid-show. Phases, prediction rules, quiz and duel mechanics, trophy definitions, sudden-death tiebreak, and the disconnect policy. The defaults work for most groups; the host can override most of it from the lobby.',
    },
    hostLimits: {
      title: 'Player limits and host responsibilities',
      items: [
        { strong: '2 to 20 players per room.', rest: 'Couples can share a single device.' },
        { strong: 'One host signs in.', rest: 'Magic-link email auth, no password. The host owns the room until they leave or delete it.' },
        { strong: 'Players join with a code.', rest: 'No account needed for guests \u2014 just the 6-character room code and a display name.' },
        { strong: 'Host advances phases.', rest: 'The room moves through Lobby \u2192 Predictions \u2192 Quiz \u2192 Live Show \u2192 Results \u2192 Final on host action; players cannot skip phases.' },
        { strong: 'Host has override authority.', rest: 'Reset trivia rounds, void duels, override scoring on clear input errors, and eject players from the host panel.' },
      ],
    },
    phases: {
      title: 'Phases',
      intro:
        'The room moves through six phases in fixed order. The host advances each one manually \u2014 there is no automatic timer pushing groups forward.',
      headers: ['Phase', 'Typical duration', 'What\u2019s locked'],
      rows: [
        ['Lobby', 'Until host starts', 'Predictions, quiz, duels'],
        ['Predictions', '5\u201310 min before show', 'Duels'],
        ['Quiz', 'Concurrent with Predictions', 'Duels'],
        ['Live Show', 'Duration of broadcast', 'Predictions, quiz'],
        ['Results', 'Final 30 min of show', 'Predictions, quiz'],
        ['Final', 'Trophy reveal', 'Everything except sudden death'],
      ],
    },
    predictions: {
      title: 'Predictions rules',
      items: [
        { strong: 'Top 5.', rest: 'An ordered list of five countries you predict will finish 1\u20135 in the official combined jury + televote ranking.' },
        { strong: 'Worst 5.', rest: 'An ordered list of five countries you predict will finish at the bottom (last-place country = position 1 in your Worst 5).' },
        { strong: 'No overlap.', rest: 'A country can appear in only one of your two lists.' },
        { strong: 'Ordering matters.', rest: 'Exact-position match scores 50; correct list at the wrong position scores 20; outside the list scores 0.' },
        { strong: 'Hard lock at phase advance.', rest: 'Once the host advances past Predictions, no edits and no late entries.' },
        { strong: 'Late joiners', rest: 'can still play trivia and duels but cannot enter predictions.' },
      ],
    },
    quiz: {
      title: 'Quiz rules',
      items: [
        { strong: 'Host triggers each round.', rest: 'Default 3 rounds, 10 questions each (host configurable, 1\u20133).' },
        { strong: '4 options per question.', rest: 'Single-select, 15-second timer.' },
        { strong: 'Tiered scoring by response time.', rest: '12 points (\u22643s), 8 points (\u22647s), 4 points (\u226415s); 0 for wrong or timeout.' },
        { strong: 'No question repeats per player', rest: 'across the entire night, including duels.' },
        { strong: 'Quiz locks at Live Show.', rest: 'Duels replace it from kick-off through Results.' },
      ],
    },
    duels: {
      title: 'Duel rules',
      items: [
        { strong: 'Available from Live Show onward.', rest: 'Locked during Lobby, Predictions, and Quiz phases.' },
        { strong: '3 questions per duel.', rest: 'Same questions for both players, answered in private.' },
        { strong: '12-second timer per question.', rest: 'Score = 12 minus elapsed seconds; wrong or timeout = 0.' },
        { strong: 'Per-pair cap.', rest: 'Host-configurable (default 3, max 10) and counts rematches \u2014 you cannot grind one opponent.' },
        { strong: 'Refusing is allowed.', rest: 'No point penalty, and refused challenges do not count against the cap.' },
        { strong: 'Winner picks Steal or Double.', rest: 'Steal takes <em>winner_score</em> from the loser; Double adds the same to the winner. Loser keeps their points if Double.' },
      ],
    },
    trophies: {
      title: 'Trophy rules',
      intro: 'Five trophies are awarded at the Final phase. One player can win multiple categories.',
      items: [
        { strong: 'Champion', rest: '\u2014 highest total points across all phases combined.' },
        { strong: 'Thief', rest: '\u2014 most points taken via duel Steal effects.' },
        { strong: 'Duelist', rest: '\u2014 most duels won across the night.' },
        { strong: 'Oracle', rest: '\u2014 highest prediction-only score (Top 5 + Worst 5 totals).' },
        { strong: 'Guru', rest: '\u2014 most correct trivia answers across quiz rounds and duels combined.' },
      ],
      note:
        'Co-winners (2\u20135 players tied on a category) split a single trophy unless the host triggers sudden death.',
    },
    suddenDeath: {
      title: 'Sudden-death tiebreak',
      body:
        'For any tied trophy category, the host can open a 20-second sudden-death round. One trivia question, all tied players answer in parallel. Fastest correct answer wins the title outright \u2014 the previous co-winners forfeit. If nobody is correct, the co-winner status persists.',
      cardTitle: 'Host toggle',
      cardBody:
        'Sudden death is opt-in per category from the host panel during the Final phase. If the host doesn\u2019t open it, tied players share the trophy by default.',
    },
    disconnect: {
      title: 'Disconnect policy',
      items: [
        { strong: 'Auto-rejoin.', rest: 'A reconnect banner appears the moment connection drops; one tap restores state with no manual rejoin.' },
        { strong: 'Points preserved.', rest: 'Predictions, quiz score, and duel results stay locked to your player slot through any drop.' },
        { strong: 'Active duels resolve fairly.', rest: 'If you disconnect mid-duel, your unanswered questions score 0; the duel resolves on whoever has more points.' },
        { strong: 'No bench penalty.', rest: 'Quiz rounds and duels you miss while away cannot be back-filled, but no points are deducted.' },
      ],
    },
    edgeCases: {
      title: 'Edge cases',
      items: [
        { strong: 'Player leaves mid-show.', rest: 'Slot frees up; their banked points stay frozen on the leaderboard so the rest of the room is unaffected.' },
        { strong: 'Host deletes the room.', rest: 'Session ends for everyone. A 5-second confirmation prevents accidents; deletion is irreversible.' },
        { strong: 'Cheating.', rest: 'Multi-device or AI-assisted answering: host discretion, suggested resolution is voiding affected duels and quiz rounds.' },
        { strong: 'Result entry error.', rest: 'Host can override scoring entries from the host panel. Re-running auto-parse pulls fresh official results.' },
        { strong: 'Multiple rooms per host.', rest: 'Allowed, but only one room is active per host at a time during the broadcast.' },
      ],
    },
    cta: {
      title: 'Start a room with these rules',
      body: 'Default rules work for most groups. Open the host panel to tweak duel caps, quiz rounds, and sudden death.',
      primary: 'Create room',
      secondary: 'Scoring',
    },
    related: {
      items: [
        { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact point math behind every prediction, quiz answer, and duel.' },
        { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough from create-room to trophy reveal.' },
        { href: '/faq', title: 'FAQ', blurb: 'Quick answers on creating rooms, joining, leaving, and disputes.' },
        { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Top 5 and Worst 5 mechanics with the 2026 country list.' },
        { href: '/duels', title: 'Duels', blurb: 'Head-to-head trivia rules, Steal vs Double, and trophy impact.' },
        { href: '/eurovision-trivia', title: 'Trivia', blurb: 'Sample questions and the bank quiz/duels pull from.' },
      ],
    },
    crumbs: { home: 'Home', current: 'Rules' },
  },
  el: {
    meta: {
      title: 'Κανόνες Eurovision Games \u2014 Πλήρης Κανονισμός (2026)',
      description:
        'Οι πλήρεις κανόνες του Eurovision Games: φάσεις, λίστες προβλέψεων, μονομαχίες trivia, βαθμολογία, κατηγορίες νικητών, sudden death και επίλυση διαφωνιών.',
      keywords: [
        'eurovision games κανόνες',
        'eurovision party παιχνίδι κανόνες',
        'eurovision trivia κανόνες',
        'eurovision προβλέψεις κανόνες',
      ],
    },
    schema: {
      articleHeadline: 'Eurovision Games \u2014 Πλήρης Κανονισμός (2026)',
      articleDescription:
        'Οι πλήρεις κανόνες του Eurovision Games: φάσεις, λίστες προβλέψεων, μονομαχίες trivia, βαθμολογία, κατηγορίες νικητών, sudden death, διαφωνίες και ακραίες περιπτώσεις.',
    },
    hero: {
      chip: 'Κανονισμός',
      title: 'Κανόνες \u2014 ο πλήρης κανονισμός του Eurovision Games',
      lede:
        'Ό,τι χρειάζεται ένας οικοδεσπότης ή ένας παίκτης για να λύσει μια διαφωνία στη μέση της εκπομπής. Φάσεις, κανόνες προβλέψεων, μηχανική quiz και μονομαχιών, ορισμοί τροπαίων, sudden death και πολιτική αποσύνδεσης. Οι προεπιλογές δουλεύουν για τις περισσότερες παρέες· ο οικοδεσπότης μπορεί να αλλάξει τα περισσότερα από το lobby.',
    },
    hostLimits: {
      title: 'Όρια παικτών και ευθύνες οικοδεσπότη',
      items: [
        { strong: '2 έως 20 παίκτες ανά δωμάτιο.', rest: 'Τα ζευγάρια μπορούν να μοιραστούν μία συσκευή.' },
        { strong: 'Ένας οικοδεσπότης συνδέεται.', rest: 'Magic-link στο email, χωρίς κωδικό. Ο οικοδεσπότης έχει το δωμάτιο μέχρι να αποχωρήσει ή να το διαγράψει.' },
        { strong: 'Οι παίκτες μπαίνουν με κωδικό.', rest: 'Δεν χρειάζεται λογαριασμός για τους καλεσμένους \u2014 μόνο ο 6ψήφιος κωδικός δωματίου και ένα όνομα εμφάνισης.' },
        { strong: 'Ο οικοδεσπότης προχωρά τις φάσεις.', rest: 'Το δωμάτιο περνά από Lobby \u2192 Προβλέψεις \u2192 Quiz \u2192 Ζωντανή Εκπομπή \u2192 Αποτελέσματα \u2192 Final με ενέργεια του οικοδεσπότη· οι παίκτες δεν μπορούν να παραλείψουν φάσεις.' },
        { strong: 'Ο οικοδεσπότης έχει εξουσία υπερκάλυψης.', rest: 'Μπορεί να επανεκκινήσει γύρους trivia, να ακυρώσει μονομαχίες, να διορθώσει βαθμολογία σε προφανή λάθη καταχώρησης και να αποβάλει παίκτες από το host panel.' },
      ],
    },
    phases: {
      title: 'Φάσεις',
      intro:
        'Το δωμάτιο περνά μέσα από έξι φάσεις σε σταθερή σειρά. Ο οικοδεσπότης προχωρά κάθε μία χειροκίνητα \u2014 δεν υπάρχει αυτόματο χρονόμετρο που σπρώχνει την παρέα μπροστά.',
      headers: ['Φάση', 'Τυπική διάρκεια', 'Τι κλειδώνει'],
      rows: [
        ['Lobby', 'Μέχρι να ξεκινήσει ο οικοδεσπότης', 'Προβλέψεις, quiz, μονομαχίες'],
        ['Προβλέψεις', '5\u201310 λεπτά πριν την εκπομπή', 'Μονομαχίες'],
        ['Quiz', 'Παράλληλα με τις Προβλέψεις', 'Μονομαχίες'],
        ['Ζωντανή Εκπομπή', 'Διάρκεια μετάδοσης', 'Προβλέψεις, quiz'],
        ['Αποτελέσματα', 'Τελευταία 30 λεπτά της εκπομπής', 'Προβλέψεις, quiz'],
        ['Final', 'Αποκάλυψη τροπαίων', 'Όλα εκτός από sudden death'],
      ],
    },
    predictions: {
      title: 'Κανόνες προβλέψεων',
      items: [
        { strong: 'Top 5.', rest: 'Διατεταγμένη λίστα πέντε χωρών που προβλέπεις ότι θα τερματίσουν 1\u20135 στην επίσημη συνδυαστική κατάταξη κριτικής επιτροπής + televote.' },
        { strong: 'Worst 5.', rest: 'Διατεταγμένη λίστα πέντε χωρών που προβλέπεις ότι θα τερματίσουν στον πάτο (η τελευταία θέση = θέση 1 στο Worst 5 σου).' },
        { strong: 'Χωρίς επικάλυψη.', rest: 'Μια χώρα μπορεί να εμφανιστεί σε μία μόνο από τις δύο λίστες σου.' },
        { strong: 'Η σειρά μετράει.', rest: 'Ακριβής αντιστοίχιση θέσης δίνει 50· σωστή λίστα σε λάθος θέση δίνει 20· εκτός λίστας δίνει 0.' },
        { strong: 'Σκληρό κλείδωμα στην αλλαγή φάσης.', rest: 'Μόλις ο οικοδεσπότης περάσει τις Προβλέψεις, καμία επεξεργασία και καμία καθυστερημένη καταχώρηση.' },
        { strong: 'Όσοι μπουν αργότερα', rest: 'μπορούν να παίξουν trivia και μονομαχίες αλλά δεν μπορούν να καταχωρήσουν προβλέψεις.' },
      ],
    },
    quiz: {
      title: 'Κανόνες quiz',
      items: [
        { strong: 'Ο οικοδεσπότης ξεκινά κάθε γύρο.', rest: 'Προεπιλογή 3 γύροι, 10 ερωτήσεις ο καθένας (παραμετροποιήσιμο από τον οικοδεσπότη, 1\u20133).' },
        { strong: '4 επιλογές ανά ερώτηση.', rest: 'Μία επιλογή, χρονόμετρο 15 δευτερολέπτων.' },
        { strong: 'Κλιμακωτή βαθμολογία ανά χρόνο απάντησης.', rest: '12 πόντοι (\u22643δ), 8 πόντοι (\u22647δ), 4 πόντοι (\u226415δ)· 0 για λάθος ή λήξη χρόνου.' },
        { strong: 'Καμία επανάληψη ερώτησης ανά παίκτη', rest: 'σε όλη τη βραδιά, συμπεριλαμβανομένων των μονομαχιών.' },
        { strong: 'Το quiz κλειδώνει στη Ζωντανή Εκπομπή.', rest: 'Οι μονομαχίες το αντικαθιστούν από την έναρξη μέχρι τα Αποτελέσματα.' },
      ],
    },
    duels: {
      title: 'Κανόνες μονομαχιών',
      items: [
        { strong: 'Διαθέσιμες από τη Ζωντανή Εκπομπή και μετά.', rest: 'Κλειδωμένες σε Lobby, Προβλέψεις και Quiz.' },
        { strong: '3 ερωτήσεις ανά μονομαχία.', rest: 'Ίδιες ερωτήσεις και για τους δύο παίκτες, απαντώνται ιδιωτικά.' },
        { strong: 'Χρονόμετρο 12 δευτερολέπτων ανά ερώτηση.', rest: 'Βαθμολογία = 12 μείον τα δευτερόλεπτα που πέρασαν· λάθος ή λήξη χρόνου = 0.' },
        { strong: 'Όριο ανά ζευγάρι.', rest: 'Παραμετροποιήσιμο από τον οικοδεσπότη (προεπιλογή 3, μέγιστο 10) και μετράει τα rematches \u2014 δεν μπορείς να εκμεταλλεύεσαι έναν αντίπαλο.' },
        { strong: 'Η άρνηση επιτρέπεται.', rest: 'Καμία ποινή πόντων, και οι αρνημένες προκλήσεις δεν μετράνε στο όριο.' },
        { strong: 'Ο νικητής διαλέγει Κλοπή ή Διπλασιασμό.', rest: 'Η Κλοπή παίρνει <em>winner_score</em> από τον ηττημένο· ο Διπλασιασμός προσθέτει το ίδιο στον νικητή. Ο ηττημένος κρατά τους πόντους του στον Διπλασιασμό.' },
      ],
    },
    trophies: {
      title: 'Κανόνες τροπαίων',
      intro: 'Στη φάση Final απονέμονται πέντε τρόπαια. Ένας παίκτης μπορεί να κερδίσει πολλές κατηγορίες.',
      items: [
        { strong: 'Πρωταθλητής', rest: '\u2014 περισσότεροι συνολικοί πόντοι σε όλες τις φάσεις μαζί.' },
        { strong: 'Κλέφτης', rest: '\u2014 περισσότεροι πόντοι από Κλοπές σε μονομαχίες.' },
        { strong: 'Μονομάχος', rest: '\u2014 περισσότερες μονομαχίες κερδισμένες σε όλη τη βραδιά.' },
        { strong: 'Μάντης', rest: '\u2014 υψηλότερη βαθμολογία προβλέψεων (σύνολα Top 5 + Worst 5).' },
        { strong: 'Γκουρού', rest: '\u2014 περισσότερες σωστές απαντήσεις trivia σε γύρους quiz και μονομαχίες μαζί.' },
      ],
      note:
        'Συν-νικητές (2\u20135 παίκτες ισόπαλοι σε μια κατηγορία) μοιράζονται ένα τρόπαιο εκτός αν ο οικοδεσπότης ενεργοποιήσει sudden death.',
    },
    suddenDeath: {
      title: 'Sudden death για ισοπαλίες',
      body:
        'Για κάθε κατηγορία τροπαίου με ισοπαλία, ο οικοδεσπότης μπορεί να ανοίξει έναν γύρο sudden death 20 δευτερολέπτων. Μία ερώτηση trivia, όλοι οι ισόπαλοι παίκτες απαντούν παράλληλα. Η πιο γρήγορη σωστή απάντηση κερδίζει τον τίτλο \u2014 οι προηγούμενοι συν-νικητές χάνουν. Αν κανείς δεν είναι σωστός, η συν-νίκη παραμένει.',
      cardTitle: 'Διακόπτης οικοδεσπότη',
      cardBody:
        'Το sudden death ενεργοποιείται προαιρετικά ανά κατηγορία από το host panel στη φάση Final. Αν ο οικοδεσπότης δεν το ανοίξει, οι ισόπαλοι παίκτες μοιράζονται το τρόπαιο εξ ορισμού.',
    },
    disconnect: {
      title: 'Πολιτική αποσύνδεσης',
      items: [
        { strong: 'Αυτόματη επανασύνδεση.', rest: 'Εμφανίζεται ένα banner επανασύνδεσης μόλις πέσει η σύνδεση· ένα tap επαναφέρει την κατάσταση χωρίς χειροκίνητη επανασύνδεση.' },
        { strong: 'Οι πόντοι διατηρούνται.', rest: 'Προβλέψεις, βαθμολογία quiz και αποτελέσματα μονομαχιών μένουν κλειδωμένα στη θέση σου σε οποιαδήποτε αποσύνδεση.' },
        { strong: 'Οι ενεργές μονομαχίες κλείνουν δίκαια.', rest: 'Αν αποσυνδεθείς στη μέση μονομαχίας, οι αναπάντητες ερωτήσεις σου παίρνουν 0· η μονομαχία κρίνεται από όποιον έχει περισσότερους πόντους.' },
        { strong: 'Καμία ποινή απουσίας.', rest: 'Οι γύροι quiz και οι μονομαχίες που χάνεις όσο λείπεις δεν αναπληρώνονται, αλλά δεν αφαιρούνται πόντοι.' },
      ],
    },
    edgeCases: {
      title: 'Ακραίες περιπτώσεις',
      items: [
        { strong: 'Παίκτης φεύγει μέσα στην εκπομπή.', rest: 'Η θέση ελευθερώνεται· οι κατοχυρωμένοι πόντοι του παγώνουν στον πίνακα βαθμολογίας ώστε η υπόλοιπη παρέα να μην επηρεαστεί.' },
        { strong: 'Ο οικοδεσπότης διαγράφει το δωμάτιο.', rest: 'Η συνεδρία τελειώνει για όλους. Επιβεβαίωση 5 δευτερολέπτων αποτρέπει ατυχήματα· η διαγραφή είναι μη αναστρέψιμη.' },
        { strong: 'Ζαβολιά.', rest: 'Πολλαπλές συσκευές ή απαντήσεις με βοήθεια AI: στη διακριτική ευχέρεια του οικοδεσπότη, προτεινόμενη λύση είναι η ακύρωση των μονομαχιών και γύρων quiz που επηρεάστηκαν.' },
        { strong: 'Σφάλμα καταχώρησης αποτελέσματος.', rest: 'Ο οικοδεσπότης μπορεί να διορθώσει καταχωρήσεις βαθμολογίας από το host panel. Επανεκκίνηση του auto-parse τραβάει φρέσκα επίσημα αποτελέσματα.' },
        { strong: 'Πολλαπλά δωμάτια ανά οικοδεσπότη.', rest: 'Επιτρέπονται, αλλά μόνο ένα δωμάτιο είναι ενεργό ανά οικοδεσπότη κάθε στιγμή κατά τη μετάδοση.' },
      ],
    },
    cta: {
      title: 'Φτιάξε ένα δωμάτιο με αυτούς τους κανόνες',
      body: 'Οι προεπιλογές δουλεύουν για τις περισσότερες παρέες. Άνοιξε το host panel για να αλλάξεις όρια μονομαχιών, γύρους quiz και sudden death.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Βαθμολογία',
    },
    related: {
      items: [
        { href: '/scoring', title: 'Φόρμουλες βαθμολογίας', blurb: 'Ακριβή μαθηματικά πόντων για κάθε πρόβλεψη, απάντηση quiz και μονομαχία.' },
        { href: '/how-to-play', title: 'Πώς παίζεται', blurb: 'Οδηγός εγκατάστασης 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.' },
        { href: '/faq', title: 'Συχνές Ερωτήσεις', blurb: 'Σύντομες απαντήσεις για δημιουργία, είσοδο, αποχώρηση και διαφωνίες.' },
        { href: '/eurovision-2026-predictions', title: 'Προβλέψεις', blurb: 'Μηχανική Top 5 και Worst 5 με τη λίστα χωρών 2026.' },
        { href: '/duels', title: 'Μονομαχίες', blurb: 'Κανόνες trivia ένας προς έναν, Κλοπή vs Διπλασιασμός και επίδραση στα τρόπαια.' },
        { href: '/eurovision-trivia', title: 'Trivia', blurb: 'Ενδεικτικές ερωτήσεις και η τράπεζα από όπου τραβάνε quiz/μονομαχίες.' },
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Κανόνες' },
  },
};
