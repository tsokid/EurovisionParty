import type { Locale } from '../../../lib/seo/locale';

export interface EurovisionNightCopy {
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
    what: { title: string; bodyBefore: string; bodyDate: string; bodyAfter: string };
    playbook: {
      title: string;
      steps: { boldHead: string; rest: string; href?: string; linkLabel?: string; restAfter?: string }[];
    };
    food: { title: string; body: string };
    timezones: { title: string; body: string };
    inRoomGames: {
      title: string;
      bullets: { strong: string; rest: string }[];
    };
    faq: { title: string };
  };
  faq: { q: string; a: string }[];
  howTo: {
    name: string;
    steps: { name: string; text: string }[];
  };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    heading: string;
    items: { href: string; title: string; blurb: string }[];
  };
}

export const copy: Record<Locale, EurovisionNightCopy> = {
  en: {
    meta: {
      title: 'Eurovision Night — Host the Perfect Watch Party (2026 Guide)',
      description:
        'A practical guide to hosting Eurovision night: setup, food, drinks, predictions, trivia, voting, and live scoring with friends. Free to play.',
      headline: 'Eurovision Night — How to Host the Perfect Watch Party',
      articleDescription:
        'A practical 10-step playbook for hosting Eurovision night: setup, food, drinks, predictions, trivia duels, voting, and live scoring with friends.',
      keywords: [
        'eurovision night',
        'host eurovision night',
        'eurovision watch party',
        'eurovision 2026 watch party',
        'eurovision party guide',
      ],
    },
    crumbs: { home: 'Home', current: 'Eurovision night' },
    hero: {
      chip: 'Hosting playbook',
      title: 'Eurovision night — host the perfect watch party',
      lede:
        'Eurovision night is the annual living-room ritual where you watch the Eurovision Song Contest with friends, rate every song, and argue about which country deserves to win. This guide turns it from passive viewing into a competitive, scored party game using Eurovision Games — a free browser-based companion that handles predictions, trivia, and scoring while you watch.',
    },
    sections: {
      what: {
        title: 'What is Eurovision night?',
        bodyBefore:
          'Eurovision night is the live grand-final broadcast of the Eurovision Song Contest, held on the second Saturday of May each year. In 2026 the grand final airs on ',
        bodyDate: 'Saturday 16 May 2026',
        bodyAfter:
          ' from Vienna, with semi-finals earlier that week. Across Europe (and Australia) it is a single televised live event watched by ~160 million people; in homes it has become a competitive social event, a costume party, and a drinking game all at once.',
      },
      playbook: {
        title: 'How to host (10-step playbook)',
        steps: [
          {
            boldHead: '1. Pick a venue.',
            rest: " Living-room, garden, projector on a wall — or a Zoom/FaceTime call if you're scattered.",
          },
          {
            boldHead: '2. Confirm the broadcast.',
            rest:
              ' National broadcaster (BBC One, ARD, ERT, RAI, etc.) or the official YouTube live-stream where licensing allows.',
          },
          {
            boldHead: '3. Send a save-the-date.',
            rest: ' Doors open ~1 hour before kick-off so guests can settle and lock predictions.',
          },
          {
            boldHead: '4. Open Eurovision Games.',
            rest: ' Create a room at ',
            href: '/',
            linkLabel: 'eurovision.games',
            restAfter: " on the host's phone or laptop, share the join link.",
          },
          {
            boldHead: '5. Set the lineup.',
            rest: ' Print or screenshot the 2026 running order so everyone has a reference for predictions.',
          },
          {
            boldHead: '6. Lock predictions.',
            rest: ' Before the first song, every guest picks Top 5 and Worst 5.',
          },
          {
            boldHead: '7. Watch song-by-song.',
            rest: ' React, score, take photos. Encourage opinionated commentary.',
          },
          {
            boldHead: '8. Use breaks for trivia duels.',
            rest: ' The interval act is ~25 minutes — perfect duel window.',
          },
          {
            boldHead: '9. Watch the vote.',
            rest: ' Jury vote first, then televote — the most chaotic 25 minutes of TV all year.',
          },
          {
            boldHead: '10. Crown winners.',
            rest: ' After the televote, the app reveals five trophy cards — Champion, Thief, Duelist, Oracle, Guru.',
          },
        ],
      },
      food: {
        title: 'Food and drink ideas',
        body:
          "The classic move: one snack per favourite country. Sweden = meatballs and Daim. Italy = arancini. Greece = spanakopita. UK = sausage rolls. Don't over-cater — the focus is the screen. A flexible buffet that survives the 4-hour run-time beats a hot served dinner. Mocktails travel well; an alcohol-free option keeps drivers and non-drinkers happy through to the televote.",
      },
      timezones: {
        title: 'Time-zone tips',
        body:
          "Grand final start times vary by country: 21:00 CET (Germany, France, Spain), 20:00 BST/UTC+1 (UK, Ireland), 22:00 EET (Greece, Cyprus, Finland, Israel), 05:00 AEDT next morning (Australia — record it). If you're hosting cross-country, align on the host's local kick-off and start the room 30 minutes earlier.",
      },
      inRoomGames: {
        title: 'Game options inside the room',
        bullets: [
          {
            strong: 'Predictions:',
            rest: ' Top 5, Worst 5 — locked before the show, scored automatically against jury + televote.',
          },
          {
            strong: 'Trivia duels:',
            rest:
              ' Head-to-head between any two players. Winner steals points from loser. Default per-pair cap of 3 duels (rematches counted) prevents grinding one opponent.',
          },
          {
            strong: 'Quiz rounds:',
            rest: ' Fast-fire rounds the host triggers between performances.',
          },
          {
            strong: 'Sudden-death tiebreak:',
            rest: ' Optional. If players tie a winner category, the room votes — Accept (share the trophy) or Sudden Death. If Sudden Death wins, the tied players fight through a 3-question trivia match.',
          },
        ],
      },
      faq: { title: 'Frequently asked questions' },
    },
    faq: [
      { q: 'Do I need an account?', a: 'No. Guests join with just a room code. The host signs in once.' },
      { q: 'How many players?', a: '2 to 20. Couples can share a screen.' },
      {
        q: 'Does it run on TV?',
        a: 'The phone or laptop is the dashboard; the broadcast stays on the TV.',
      },
      {
        q: 'When is Eurovision 2026?',
        a:
          'The grand final airs on Saturday 16 May 2026 from Vienna, with semi-finals earlier that week. Start times vary by country (21:00 CET / 20:00 BST / 22:00 EET).',
      },
    ],
    howTo: {
      name: 'Host Eurovision Night',
      steps: [
        { name: 'Pick a venue', text: 'Decide on living-room, garden, or video-call. Confirm the broadcast source.' },
        { name: 'Set up the game', text: 'Open eurovision.games, create a room, share the code with guests.' },
        {
          name: 'Plan food and drink',
          text: 'One country-themed snack per top contender; a flexible "voting break" buffet.',
        },
        {
          name: 'Lock predictions before the show',
          text: 'Everyone fills in Top 5 / Worst 5 before the first song airs.',
        },
        {
          name: 'Run trivia duels in the breaks',
          text: 'Use commentary slots and the interval act for head-to-head duels.',
        },
        { name: 'Crown your winners', text: 'After the final televote, the app reveals five trophy cards.' },
      ],
    },
    cta: {
      title: 'Lock in your watch party',
      body: 'Open a room now and share the join link with friends.',
      primary: 'Create room',
      secondary: 'How to play',
    },
    related: {
      heading: 'Keep reading',
      items: [
        {
          href: '/eurovision-party',
          title: 'Eurovision party',
          blurb: 'Themed Eurovision party planning — costumes, decor, and country menus.',
        },
        {
          href: '/how-to-play',
          title: 'How to play',
          blurb: 'The 60-second walkthrough from create-room to trophy reveal.',
        },
        {
          href: '/eurovision-2026-predictions',
          title: '2026 predictions',
          blurb: 'Top 5 and Worst 5 format, scoring, and strategy for the Vienna final.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Eurovision trivia',
          blurb: '10 sample questions and how the live trivia bank works.',
        },
        {
          href: '/duels',
          title: 'Eurovision duels',
          blurb: 'Head-to-head 3-question duels during the live show.',
        },
        {
          href: '/faq',
          title: 'FAQ',
          blurb: 'Answers to common questions about hosting, joining, and scoring.',
        },
      ],
    },
  },
  el: {
    meta: {
      title: 'Βραδιά Eurovision — Διοργάνωσε το τέλειο watch party (Οδηγός 2026)',
      description:
        'Πρακτικός οδηγός διοργάνωσης βραδιάς Eurovision: εκκίνηση, φαγητό, ποτό, προβλέψεις, trivia, ψηφοφορία και ζωντανή βαθμολογία με την παρέα σου. Δωρεάν.',
      headline: 'Βραδιά Eurovision — Πώς να διοργανώσεις το τέλειο watch party',
      articleDescription:
        'Πρακτικός οδηγός 10 βημάτων για τη διοργάνωση βραδιάς Eurovision: εκκίνηση, φαγητό, ποτό, προβλέψεις, μονομαχίες trivia, ψηφοφορία και ζωντανή βαθμολογία με την παρέα.',
      keywords: [
        'βραδιά eurovision',
        'διοργάνωση βραδιάς eurovision',
        'eurovision watch party',
        'eurovision 2026 watch party',
        'οδηγός πάρτι eurovision',
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Βραδιά Eurovision' },
    hero: {
      chip: 'Οδηγός διοργάνωσης',
      title: 'Βραδιά Eurovision — διοργάνωσε το τέλειο watch party',
      lede:
        'Η βραδιά Eurovision είναι το ετήσιο τελετουργικό στο σαλόνι, όπου παρακολουθείς τη Eurovision Song Contest με την παρέα σου, βαθμολογείς κάθε τραγούδι και διαφωνείς για το ποια χώρα αξίζει να κερδίσει. Αυτός ο οδηγός τη μετατρέπει από παθητικό κοίταγμα σε ένα ανταγωνιστικό party game με βαθμολογία, χρησιμοποιώντας το Eurovision Games — έναν δωρεάν σύντροφο μέσα στον browser που αναλαμβάνει προβλέψεις, trivia και βαθμολογία ενώ εσύ παρακολουθείς.',
    },
    sections: {
      what: {
        title: 'Τι είναι η βραδιά Eurovision;',
        bodyBefore:
          'Η βραδιά Eurovision είναι η ζωντανή μετάδοση του μεγάλου τελικού της Eurovision Song Contest, που γίνεται κάθε δεύτερο Σάββατο του Μαΐου. Το 2026 ο μεγάλος τελικός μεταδίδεται το ',
        bodyDate: 'Σάββατο 16 Μαΐου 2026',
        bodyAfter:
          ' από τη Βιέννη, με τους ημιτελικούς νωρίτερα μέσα στην εβδομάδα. Σε όλη την Ευρώπη (και την Αυστραλία) είναι ένα ενιαίο τηλεοπτικό ζωντανό γεγονός που παρακολουθούν περίπου 160 εκατομμύρια άνθρωποι· στα σπίτια έχει γίνει ταυτόχρονα ανταγωνιστική κοινωνική εκδήλωση, costume party και drinking game.',
      },
      playbook: {
        title: 'Πώς να διοργανώσεις (οδηγός 10 βημάτων)',
        steps: [
          {
            boldHead: '1. Διάλεξε χώρο.',
            rest: ' Σαλόνι, κήπος, projector στον τοίχο — ή κλήση Zoom/FaceTime αν είστε σκορπισμένοι.',
          },
          {
            boldHead: '2. Επιβεβαίωσε τη μετάδοση.',
            rest:
              ' Εθνικός μεταδότης (BBC One, ARD, ΕΡΤ, RAI κ.ά.) ή το επίσημο live-stream στο YouTube όπου το επιτρέπει η αδειοδότηση.',
          },
          {
            boldHead: '3. Στείλε save-the-date.',
            rest: ' Η πόρτα ανοίγει ~1 ώρα πριν την έναρξη ώστε οι καλεσμένοι να βολευτούν και να κλειδώσουν προβλέψεις.',
          },
          {
            boldHead: '4. Άνοιξε το Eurovision Games.',
            rest: ' Δημιούργησε δωμάτιο στο ',
            href: '/',
            linkLabel: 'eurovision.games',
            restAfter: ' στο κινητό ή το laptop του οικοδεσπότη, μοίρασε τον σύνδεσμο συμμετοχής.',
          },
          {
            boldHead: '5. Ετοίμασε τη λίστα.',
            rest: ' Τύπωσε ή κάνε screenshot τη σειρά εμφάνισης του 2026, ώστε όλοι να έχουν αναφορά για τις προβλέψεις.',
          },
          {
            boldHead: '6. Κλείδωσε τις προβλέψεις.',
            rest: ' Πριν το πρώτο τραγούδι, κάθε καλεσμένος διαλέγει Top 5 και Worst 5.',
          },
          {
            boldHead: '7. Παρακολούθησε τραγούδι-τραγούδι.',
            rest: ' Αντιδράσεις, βαθμολογίες, φωτογραφίες. Ενθάρρυνε τα έντονα σχόλια.',
          },
          {
            boldHead: '8. Αξιοποίησε τα διαλείμματα για μονομαχίες trivia.',
            rest: ' Το interval act είναι ~25 λεπτά — τέλειο παράθυρο για μονομαχίες.',
          },
          {
            boldHead: '9. Δες την ψηφοφορία.',
            rest:
              ' Πρώτα η κριτική επιτροπή, μετά το televote — τα πιο χαοτικά 25 λεπτά της τηλεοπτικής χρονιάς.',
          },
          {
            boldHead: '10. Στέψε τους νικητές.',
            rest:
              ' Μετά το televote, η εφαρμογή αποκαλύπτει πέντε κάρτες τροπαίων — Πρωταθλητής, Κλέφτης, Μονομάχος, Μάντης, Γκουρού.',
          },
        ],
      },
      food: {
        title: 'Ιδέες για φαγητό και ποτό',
        body:
          'Η κλασική κίνηση: ένα snack ανά αγαπημένη χώρα. Σουηδία = σουηδικά κεφτέδες και Daim. Ιταλία = arancini. Ελλάδα = σπανακόπιτα. Ηνωμένο Βασίλειο = sausage rolls. Μην παρασέρνεσαι με την προετοιμασία — το επίκεντρο είναι η οθόνη. Ένας ευέλικτος μπουφές που αντέχει στις 4 ώρες βραδιάς νικάει το ζεστό σερβιριστό δείπνο. Τα mocktails ταξιδεύουν εύκολα· μια επιλογή χωρίς αλκοόλ κρατάει χαρούμενους τους οδηγούς και όσους δεν πίνουν μέχρι το televote.',
      },
      timezones: {
        title: 'Συμβουλές για ζώνες ώρας',
        body:
          'Οι ώρες έναρξης του μεγάλου τελικού διαφέρουν ανά χώρα: 21:00 CET (Γερμανία, Γαλλία, Ισπανία), 20:00 BST/UTC+1 (Ηνωμένο Βασίλειο, Ιρλανδία), 22:00 EET (Ελλάδα, Κύπρος, Φινλανδία, Ισραήλ), 05:00 AEDT το επόμενο πρωί (Αυστραλία — κάνε record). Αν διοργανώνεις βραδιά για παρέα σε διαφορετικές χώρες, ευθυγράμμισε στο τοπικό kick-off του οικοδεσπότη και άνοιξε το δωμάτιο 30 λεπτά νωρίτερα.',
      },
      inRoomGames: {
        title: 'Επιλογές παιχνιδιών μέσα στο δωμάτιο',
        bullets: [
          {
            strong: 'Προβλέψεις:',
            rest:
              ' Top 5, Worst 5 — κλειδώνουν πριν την εκπομπή, βαθμολογούνται αυτόματα έναντι κριτικής επιτροπής + televote.',
          },
          {
            strong: 'Μονομαχίες trivia:',
            rest:
              ' Ένας προς έναν ανάμεσα σε δύο παίκτες. Ο νικητής κλέβει πόντους από τον ηττημένο. Προεπιλεγμένο όριο 3 μονομαχιών ανά ζευγάρι (οι ρεβάνς μετράνε) για να μην τα «βγάζει» κανείς από έναν παίκτη.',
          },
          {
            strong: 'Γύροι quiz:',
            rest: ' Γρήγοροι γύροι που τους ξεκινάει ο οικοδεσπότης ανάμεσα στις εμφανίσεις.',
          },
          {
            strong: 'Tiebreak με sudden-death:',
            rest:
              ' Προαιρετικό. Αν παίκτες ισοβαθμούν σε κατηγορία νικητή, το δωμάτιο ψηφίζει: Αποδοχή (μοιράζονται το τρόπαιο) ή Sudden Death. Αν νικήσει το Sudden Death, οι ισόπαλοι μάχονται σε 3 ερωτήσεις trivia.',
          },
        ],
      },
      faq: { title: 'Συχνές ερωτήσεις' },
    },
    faq: [
      { q: 'Χρειάζομαι λογαριασμό;', a: 'Όχι. Οι καλεσμένοι μπαίνουν μόνο με κωδικό δωματίου. Ο οικοδεσπότης κάνει login μία φορά.' },
      { q: 'Πόσοι παίκτες;', a: 'Από 2 έως 20. Τα ζευγάρια μπορούν να μοιραστούν την ίδια οθόνη.' },
      {
        q: 'Τρέχει στην τηλεόραση;',
        a: 'Το κινητό ή το laptop είναι το dashboard· η μετάδοση μένει στην τηλεόραση.',
      },
      {
        q: 'Πότε είναι η Eurovision 2026;',
        a:
          'Ο μεγάλος τελικός μεταδίδεται το Σάββατο 16 Μαΐου 2026 από τη Βιέννη, με τους ημιτελικούς νωρίτερα μέσα στην εβδομάδα. Οι ώρες έναρξης διαφέρουν ανά χώρα (21:00 CET / 20:00 BST / 22:00 EET).',
      },
    ],
    howTo: {
      name: 'Διοργάνωση βραδιάς Eurovision',
      steps: [
        {
          name: 'Διάλεξε χώρο',
          text: 'Αποφάσισε για σαλόνι, κήπο ή βιντεοκλήση. Επιβεβαίωσε την πηγή της μετάδοσης.',
        },
        {
          name: 'Στήσε το παιχνίδι',
          text: 'Άνοιξε το eurovision.games, δημιούργησε δωμάτιο, μοίρασε τον κωδικό στους καλεσμένους.',
        },
        {
          name: 'Σχεδίασε φαγητό και ποτό',
          text: 'Ένα snack ανά χώρα-φαβορί· ένας ευέλικτος μπουφές για το «διάλειμμα ψηφοφορίας».',
        },
        {
          name: 'Κλείδωσε τις προβλέψεις πριν την εκπομπή',
          text: 'Όλοι συμπληρώνουν Top 5 / Worst 5 πριν παίξει το πρώτο τραγούδι.',
        },
        {
          name: 'Τρέξε μονομαχίες trivia στα διαλείμματα',
          text: 'Αξιοποίησε τα σχόλια και το interval act για μονομαχίες ένας προς έναν.',
        },
        {
          name: 'Στέψε τους νικητές',
          text: 'Μετά το τελικό televote, η εφαρμογή αποκαλύπτει πέντε κάρτες τροπαίων.',
        },
      ],
    },
    cta: {
      title: 'Κλείδωσε τη βραδιά σου',
      body: 'Άνοιξε δωμάτιο τώρα και μοίρασε τον σύνδεσμο στους φίλους σου.',
      primary: 'Δημιουργία δωματίου',
      secondary: 'Πώς παίζεις',
    },
    related: {
      heading: 'Συνέχισε την ανάγνωση',
      items: [
        {
          href: '/eurovision-party',
          title: 'Πάρτι Eurovision',
          blurb: 'Σχεδιασμός θεματικού πάρτι Eurovision — κοστούμια, διακόσμηση και μενού ανά χώρα.',
        },
        {
          href: '/how-to-play',
          title: 'Πώς παίζεις',
          blurb: 'Ο οδηγός 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.',
        },
        {
          href: '/eurovision-2026-predictions',
          title: 'Προβλέψεις 2026',
          blurb: 'Μορφή Top 5 και Worst 5, βαθμολογία και στρατηγική για τον τελικό της Βιέννης.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Eurovision trivia',
          blurb: '10 ενδεικτικές ερωτήσεις και πώς δουλεύει η ζωντανή τράπεζα trivia.',
        },
        {
          href: '/duels',
          title: 'Μονομαχίες Eurovision',
          blurb: 'Μονομαχίες 3 ερωτήσεων ένας προς έναν στη ζωντανή εκπομπή.',
        },
        {
          href: '/faq',
          title: 'Συχνές ερωτήσεις',
          blurb: 'Απαντήσεις σε συχνά ερωτήματα για διοργάνωση, συμμετοχή και βαθμολογία.',
        },
      ],
    },
  },
};
