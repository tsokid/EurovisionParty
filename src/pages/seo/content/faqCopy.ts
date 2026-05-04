import type { Locale } from '../../../lib/seo/locale';

interface RelatedItem { href: string; title: string; blurb: string }

interface AnchoredFaq {
  id: 'create' | 'join' | 'leave';
  q: string;
  a: string;
}

interface QA { q: string; a: string }

interface BulletItem { strong: string; rest: string }

export interface FaqCopy {
  meta: { title: string; description: string; keywords: string[] };
  schema: { articleHeadline: string; articleDescription: string };
  hero: { chip: string; title: string; lede: string };
  // The three anchored questions — IDs MUST stay create/join/leave.
  anchored: AnchoredFaq[];
  createSection: {
    title: string;
    cardTitle: string;
    bullets: BulletItem[];
  };
  joinSection: {
    title: string;
    bullets: BulletItem[];
  };
  leaveSection: {
    title: string;
    bullets: BulletItem[];
  };
  moreTitle: string;
  more: QA[];
  cta: { title: string; body: string; primary: string; secondary: string };
  related: { items: RelatedItem[] };
  crumbs: { home: string; current: string };
}

export const copy: Record<Locale, FaqCopy> = {
  en: {
    meta: {
      title: 'Eurovision Games FAQ \u2014 Setup, Rules, Scoring & Troubleshooting',
      description:
        'Frequently asked questions about Eurovision Games: setup, players, scoring, duels, sudden death, mobile install, troubleshooting, and privacy.',
      keywords: [
        'eurovision games faq',
        'eurovision party game help',
        'how to host eurovision',
        'eurovision games support',
      ],
    },
    schema: {
      articleHeadline: 'Eurovision Games FAQ \u2014 Setup, Rules, Scoring & Troubleshooting',
      articleDescription:
        'Frequently asked questions about Eurovision Games: setup, players, scoring, duels, sudden death, mobile install, troubleshooting, and privacy.',
    },
    hero: {
      chip: 'FAQ',
      title: 'Eurovision Games \u2014 frequently asked questions',
      lede:
        'Quick answers to the questions hosts and players ask most. The three most-asked \u2014 creating, joining, and leaving \u2014 are highlighted at the top. The rest are in an accordion below. For deeper detail see the rule book, scoring formulas, and setup guide.',
    },
    anchored: [
      {
        id: 'create',
        q: 'How do I create a room?',
        a: 'Sign in (email-only \u2014 we send a one-tap magic link), click "Create Room", pick the round count (1-3 quiz rounds) and max players (2-20). A 6-character room code and shareable link appear instantly. The host owns the room until they leave or delete it.',
      },
      {
        id: 'join',
        q: 'How do I join a room?',
        a: 'Use the join link the host shared (one tap, no account), or open Eurovision Games, click "Join Room", and type the 6-character code plus your display name. Late joiners can still play duels and quiz, but predictions lock once the host advances the phase.',
      },
      {
        id: 'leave',
        q: 'How do I leave or delete a room?',
        a: 'Tap your name in the room header \u2192 "Leave room". Your slot frees up; your scored points stay frozen on the leaderboard so the rest of the room is unaffected. Hosts have an extra "Delete room" option in the host panel that ends the session for everyone \u2014 a 5-second confirmation prevents accidents.',
      },
    ],
    createSection: {
      title: 'Creating a room',
      cardTitle: 'Defaults that work',
      bullets: [
        { strong: '3 quiz rounds', rest: '\u2014 enough warm-up without dragging.' },
        { strong: 'Max 20 players', rest: '\u2014 the upper limit; smaller rooms feel snappier.' },
        { strong: 'A default per-pair duel cap of 3', rest: '(rematches counted) \u2014 prevents one-target grinding.' },
      ],
    },
    joinSection: {
      title: 'Joining a room',
      bullets: [
        { strong: 'Easiest path:', rest: 'tap the join link the host shared. One step, no account.' },
        { strong: 'Manual:', rest: 'open Eurovision Games \u2192 <em>Join Room</em> \u2192 enter the 6-character code plus a display name.' },
        { strong: 'Late joiners', rest: 'can still play trivia and duels, but predictions are locked once the host advances past Predictions.' },
      ],
    },
    leaveSection: {
      title: 'Leaving or deleting a room',
      bullets: [
        { strong: 'Players', rest: 'tap their name in the room header \u2192 <em>Leave room</em>. Banked points stay frozen on the leaderboard.' },
        { strong: 'Hosts', rest: 'have an extra <em>Delete room</em> option in the host panel \u2014 a 5-second confirmation prevents accidents.' },
        { strong: 'Accidental leave?', rest: 'Re-join with the same code and display name. Your points are restored.' },
      ],
    },
    moreTitle: 'More questions',
    more: [
      { q: 'Is Eurovision Games free?', a: 'Yes \u2014 completely free. No subscriptions, no in-app purchases, no ads.' },
      { q: 'Do I need an account?', a: 'Only the host signs in (with email). Players join with a room code and a name \u2014 no account.' },
      { q: 'How many players can join a room?', a: '2 to 20. Couples can share a single device.' },
      { q: 'Does it work on mobile?', a: 'Yes. The app is mobile-first and installs as a PWA on iOS and Android.' },
      { q: 'What browsers are supported?', a: 'Chrome 120+, Safari 17+, Firefox 121+, Edge 120+. Older browsers may work but are not tested.' },
      { q: 'Can players join late?', a: 'Yes \u2014 until the host advances past the predictions phase. Late joiners can still play trivia duels.' },
      { q: 'What happens if a player disconnects?', a: 'A reconnect banner appears; one tap rejoins them with state preserved. Predictions and points are not lost.' },
      { q: 'Can the host eject a player?', a: 'Yes \u2014 host has a player-management panel from the lobby onward.' },
      { q: 'How do duels work?', a: '3-question head-to-head trivia. Winner steals points from loser. Each pair has a default limit (3 duels per pair across the night, rematches counted).' },
      { q: 'How is scoring calculated?', a: 'See the Scoring page for full formulas. Top-5 picks earn variable points by rank match; Worst-5 earn flat points if the country lands in the bottom 5; trivia and duels add quiz points.' },
      { q: 'What are the five winner categories?', a: 'Champion (most total points), Thief (most points stolen in duels), Duelist (most duels won), Oracle (best predictions), Guru (most correct trivia answers).' },
      { q: 'What is sudden death?', a: 'An optional tiebreak: the room votes on Accept (all tied players share the trophy) or Sudden Death. If Sudden Death wins with enough votes, the tied players answer 3 trivia questions \u2014 most correct wins, speed breaks ties.' },
      { q: 'How do you handle Eurovision results?', a: 'Either the host enters jury and televote results live, or they update automatically from the official source on grand-final night.' },
      { q: 'Is Eurovision Games official?', a: 'No. We are not affiliated with the European Broadcasting Union, ORF, or the Eurovision Song Contest brand.' },
      { q: 'Where does my data go?', a: 'Stored on Supabase (Postgres + auth). See the Privacy page for retention details.' },
      { q: 'Can I host more than one room?', a: 'Yes \u2014 but only one room is active per host at a time during the broadcast.' },
    ],
    cta: {
      title: 'Couldn\u2019t find an answer?',
      body: 'Hop into a room and ask the host \u2014 or check the About page for direct contact details.',
      primary: 'Create room',
      secondary: 'About / contact',
    },
    related: {
      items: [
        { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough from create-room to trophy reveal.' },
        { href: '/rules', title: 'Rule book', blurb: 'Phase-by-phase rules, sudden death, and edge cases.' },
        { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact point math behind every prediction, quiz answer, and duel.' },
        { href: '/privacy', title: 'Privacy', blurb: 'What we store, where it lives, and retention windows.' },
        { href: '/about', title: 'About / contact', blurb: 'Who builds Eurovision Games and how to reach us.' },
        { href: '/eurovision-night', title: 'Eurovision night', blurb: 'Hosting guide for grand-final night with a full timeline.' },
      ],
    },
    crumbs: { home: 'Home', current: 'FAQ' },
  },
  el: {
    meta: {
      title: 'Συχνές Ερωτήσεις Eurovision Games \u2014 Εγκατάσταση, Κανόνες, Βαθμολογία και Επίλυση Προβλημάτων',
      description:
        'Συχνές ερωτήσεις για το Eurovision Games: εγκατάσταση, παίκτες, βαθμολογία, μονομαχίες, sudden death, εγκατάσταση σε κινητό, επίλυση προβλημάτων και απόρρητο.',
      keywords: [
        'eurovision games συχνές ερωτήσεις',
        'eurovision party παιχνίδι βοήθεια',
        'πώς να κάνω host eurovision',
        'eurovision games υποστήριξη',
      ],
    },
    schema: {
      articleHeadline: 'Συχνές Ερωτήσεις Eurovision Games \u2014 Εγκατάσταση, Κανόνες, Βαθμολογία και Επίλυση Προβλημάτων',
      articleDescription:
        'Συχνές ερωτήσεις για το Eurovision Games: εγκατάσταση, παίκτες, βαθμολογία, μονομαχίες, sudden death, εγκατάσταση σε κινητό, επίλυση προβλημάτων και απόρρητο.',
    },
    hero: {
      chip: 'Συχνές Ερωτήσεις',
      title: 'Eurovision Games \u2014 συχνές ερωτήσεις',
      lede:
        'Σύντομες απαντήσεις στις ερωτήσεις που κάνουν περισσότερο οικοδεσπότες και παίκτες. Οι τρεις πιο συχνές \u2014 δημιουργία, είσοδος και αποχώρηση \u2014 είναι στην κορυφή. Οι υπόλοιπες είναι σε accordion από κάτω. Για περισσότερη λεπτομέρεια δες τον κανονισμό, τις φόρμουλες βαθμολογίας και τον οδηγό εγκατάστασης.',
    },
    anchored: [
      {
        id: 'create',
        q: 'Πώς δημιουργώ ένα δωμάτιο;',
        a: 'Συνδέσου (μόνο με email \u2014 στέλνουμε magic link με ένα tap), πάτα "Δημιουργία Δωματίου", διάλεξε αριθμό γύρων (1-3 γύροι quiz) και μέγιστους παίκτες (2-20). Ένας 6ψήφιος κωδικός δωματίου και κοινοποιήσιμος σύνδεσμος εμφανίζονται αμέσως. Ο οικοδεσπότης έχει το δωμάτιο μέχρι να αποχωρήσει ή να το διαγράψει.',
      },
      {
        id: 'join',
        q: 'Πώς μπαίνω σε ένα δωμάτιο;',
        a: 'Χρησιμοποίησε τον σύνδεσμο εισόδου που μοιράστηκε ο οικοδεσπότης (ένα tap, χωρίς λογαριασμό), ή άνοιξε το Eurovision Games, πάτα "Είσοδος σε Δωμάτιο" και πληκτρολόγησε τον 6ψήφιο κωδικό μαζί με το όνομα εμφάνισής σου. Όσοι μπουν αργότερα μπορούν να παίξουν μονομαχίες και quiz, αλλά οι προβλέψεις κλειδώνουν μόλις ο οικοδεσπότης προχωρήσει τη φάση.',
      },
      {
        id: 'leave',
        q: 'Πώς αποχωρώ ή διαγράφω ένα δωμάτιο;',
        a: 'Πάτα το όνομά σου στην κεφαλίδα του δωματίου \u2192 "Αποχώρηση". Η θέση σου ελευθερώνεται· οι κερδισμένοι πόντοι σου παγώνουν στον πίνακα βαθμολογίας ώστε η υπόλοιπη παρέα να μην επηρεαστεί. Οι οικοδεσπότες έχουν επιπλέον επιλογή "Διαγραφή Δωματίου" στο host panel που τερματίζει τη συνεδρία για όλους \u2014 επιβεβαίωση 5 δευτερολέπτων αποτρέπει ατυχήματα.',
      },
    ],
    createSection: {
      title: 'Δημιουργία δωματίου',
      cardTitle: 'Προεπιλογές που δουλεύουν',
      bullets: [
        { strong: '3 γύροι quiz', rest: '\u2014 αρκετή προθέρμανση χωρίς να κουράζει.' },
        { strong: 'Μέγιστο 20 παίκτες', rest: '\u2014 το ανώτατο όριο· τα μικρότερα δωμάτια δείχνουν πιο ζωηρά.' },
        { strong: 'Προεπιλεγμένο όριο μονομαχιών ανά ζευγάρι 3', rest: '(οι ρεβάνς μετράνε) \u2014 αποτρέπει την εκμετάλλευση ενός μόνο στόχου.' },
      ],
    },
    joinSection: {
      title: 'Είσοδος σε δωμάτιο',
      bullets: [
        { strong: 'Πιο εύκολος δρόμος:', rest: 'πάτα τον σύνδεσμο εισόδου που μοιράστηκε ο οικοδεσπότης. Ένα βήμα, χωρίς λογαριασμό.' },
        { strong: 'Χειροκίνητα:', rest: 'άνοιξε το Eurovision Games \u2192 <em>Είσοδος σε Δωμάτιο</em> \u2192 πληκτρολόγησε τον 6ψήφιο κωδικό μαζί με ένα όνομα εμφάνισης.' },
        { strong: 'Όσοι μπουν αργότερα', rest: 'μπορούν να παίξουν trivia και μονομαχίες, αλλά οι προβλέψεις είναι κλειδωμένες μόλις ο οικοδεσπότης περάσει τις Προβλέψεις.' },
      ],
    },
    leaveSection: {
      title: 'Αποχώρηση ή διαγραφή δωματίου',
      bullets: [
        { strong: 'Οι παίκτες', rest: 'πατούν το όνομά τους στην κεφαλίδα του δωματίου \u2192 <em>Αποχώρηση</em>. Οι κατοχυρωμένοι πόντοι παγώνουν στον πίνακα βαθμολογίας.' },
        { strong: 'Οι οικοδεσπότες', rest: 'έχουν επιπλέον επιλογή <em>Διαγραφή Δωματίου</em> στο host panel \u2014 επιβεβαίωση 5 δευτερολέπτων αποτρέπει ατυχήματα.' },
        { strong: 'Κατά λάθος αποχώρηση;', rest: 'Ξανα-μπες με τον ίδιο κωδικό και όνομα εμφάνισης. Οι πόντοι σου επανέρχονται.' },
      ],
    },
    moreTitle: 'Περισσότερες ερωτήσεις',
    more: [
      { q: 'Είναι το Eurovision Games δωρεάν;', a: 'Ναι \u2014 εντελώς δωρεάν. Χωρίς συνδρομές, χωρίς in-app αγορές, χωρίς διαφημίσεις.' },
      { q: 'Χρειάζομαι λογαριασμό;', a: 'Μόνο ο οικοδεσπότης συνδέεται (με email). Οι παίκτες μπαίνουν με κωδικό δωματίου και ένα όνομα \u2014 χωρίς λογαριασμό.' },
      { q: 'Πόσοι παίκτες μπορούν να μπουν σε ένα δωμάτιο;', a: '2 έως 20. Τα ζευγάρια μπορούν να μοιραστούν μία συσκευή.' },
      { q: 'Δουλεύει σε κινητό;', a: 'Ναι. Η εφαρμογή είναι mobile-first και εγκαθίσταται ως PWA σε iOS και Android.' },
      { q: 'Ποιοι browsers υποστηρίζονται;', a: 'Chrome 120+, Safari 17+, Firefox 121+, Edge 120+. Παλαιότεροι browsers μπορεί να δουλεύουν αλλά δεν έχουν δοκιμαστεί.' },
      { q: 'Μπορούν να μπουν παίκτες αργότερα;', a: 'Ναι \u2014 μέχρι ο οικοδεσπότης να περάσει τη φάση των προβλέψεων. Όσοι μπουν αργότερα μπορούν να παίξουν μονομαχίες trivia.' },
      { q: 'Τι γίνεται αν αποσυνδεθεί ένας παίκτης;', a: 'Εμφανίζεται ένα banner επανασύνδεσης· ένα tap τους ξαναβάζει με την κατάσταση να διατηρείται. Προβλέψεις και πόντοι δεν χάνονται.' },
      { q: 'Μπορεί ο οικοδεσπότης να αποβάλει παίκτη;', a: 'Ναι \u2014 ο οικοδεσπότης έχει panel διαχείρισης παικτών από το lobby και μετά.' },
      { q: 'Πώς δουλεύουν οι μονομαχίες;', a: 'Trivia 3 ερωτήσεων ένας προς έναν. Ο νικητής κλέβει πόντους από τον ηττημένο. Κάθε ζευγάρι έχει προεπιλεγμένο όριο (3 μονομαχίες ανά ζευγάρι σε όλη τη βραδιά, οι ρεβάνς μετράνε).' },
      { q: 'Πώς υπολογίζεται η βαθμολογία;', a: 'Δες τη σελίδα Βαθμολογίας για τις πλήρεις φόρμουλες. Οι επιλογές Top-5 παίρνουν μεταβλητούς πόντους ανάλογα με την αντιστοίχιση θέσης· οι Worst-5 παίρνουν σταθερούς πόντους αν η χώρα προσγειωθεί στις τελευταίες 5· trivia και μονομαχίες προσθέτουν πόντους quiz.' },
      { q: 'Ποιες είναι οι πέντε κατηγορίες νικητών;', a: 'Πρωταθλητής (περισσότεροι συνολικοί πόντοι), Κλέφτης (περισσότεροι πόντοι κλεμμένοι σε μονομαχίες), Μονομάχος (περισσότερες κερδισμένες μονομαχίες), Μάντης (καλύτερες προβλέψεις), Γκουρού (περισσότερες σωστές απαντήσεις trivia).' },
      { q: 'Τι είναι το sudden death;', a: 'ΈΠροαιρετικό tiebreak: το δωμάτιο ψηφίζει Αποδοχή (οι ισόπαλοι μοιράζονται το τρόπαιο) ή Sudden Death. Αν νικήσει το Sudden Death με αρκετές ψήφους, οι ισόπαλοι παίκτες απαντούν 3 ερωτήσεις trivia \u2014 κερδίζει όποιος απαντά περισσότερες σωστά, σε ισοπαλία κερδίζει ο γρηγορότερος.' },
      { q: 'Πώς διαχειρίζεστε τα αποτελέσματα της Eurovision;', a: 'Είτε ο οικοδεσπότης καταχωρεί ζωντανά τα αποτελέσματα κριτικής επιτροπής και televote, είτε ενημερώνονται αυτόματα από την επίσημη πηγή τη βραδιά του τελικού.' },
      { q: 'Είναι το Eurovision Games επίσημο;', a: 'Όχι. Δεν είμαστε συνδεδεμένοι με την European Broadcasting Union, την ORF ή τη μάρκα Eurovision Song Contest.' },
      { q: 'Πού πάνε τα δεδομένα μου;', a: 'Αποθηκεύονται στο Supabase (Postgres + auth). Δες τη σελίδα Απορρήτου για λεπτομέρειες διατήρησης.' },
      { q: 'Μπορώ να φιλοξενήσω παραπάνω από ένα δωμάτιο;', a: 'Ναι \u2014 αλλά μόνο ένα δωμάτιο είναι ενεργό ανά οικοδεσπότη κάθε στιγμή κατά τη μετάδοση.' },
    ],
    cta: {
      title: 'Δεν βρήκες απάντηση;',
      body: 'Μπες σε ένα δωμάτιο και ρώτα τον οικοδεσπότη \u2014 ή δες τη σελίδα Σχετικά για στοιχεία επικοινωνίας.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Σχετικά / επικοινωνία',
    },
    related: {
      items: [
        { href: '/how-to-play', title: 'Πώς παίζεται', blurb: 'Οδηγός εγκατάστασης 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.' },
        { href: '/rules', title: 'Κανονισμός', blurb: 'Κανόνες ανά φάση, sudden death και ακραίες περιπτώσεις.' },
        { href: '/scoring', title: 'Φόρμουλες βαθμολογίας', blurb: 'Ακριβή μαθηματικά πόντων για κάθε πρόβλεψη, απάντηση quiz και μονομαχία.' },
        { href: '/privacy', title: 'Απόρρητο', blurb: 'Τι αποθηκεύουμε, πού βρίσκεται και χρόνοι διατήρησης.' },
        { href: '/about', title: 'Σχετικά / επικοινωνία', blurb: 'Ποιος φτιάχνει το Eurovision Games και πώς να μας βρεις.' },
        { href: '/eurovision-night', title: 'Eurovision night', blurb: 'Οδηγός hosting για τη βραδιά του τελικού με πλήρες χρονοδιάγραμμα.' },
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Συχνές Ερωτήσεις' },
  },
};
