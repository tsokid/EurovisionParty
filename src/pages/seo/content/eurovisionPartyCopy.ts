import type { Locale } from '../../../lib/seo/locale';

export interface EurovisionPartyCopy {
  meta: {
    title: string;
    description: string;
    headline: string;
    articleDescription: string;
    eventName: string;
    eventDescription: string;
    keywords: string[];
  };
  crumbs: { home: string; current: string };
  hero: { chip: string; title: string; lede: string };
  sections: {
    what: {
      title: string;
      intro: string;
      b1: string;
      b1Suffix: string;
      b2: string;
      b2Suffix: string;
      b3: string;
      outro: string;
    };
    headcount: {
      title: string;
      bullets: { strong: string; rest: string; link?: { before: string; label: string; after: string } }[];
    };
    theme: { title: string; bullets: { strong: string; rest: string }[] };
    food: {
      title: string;
      intro: string;
      bullets: { strong: string; rest: string }[];
      drinks: string;
    };
    runOfShow: {
      title: string;
      intro: string;
      tableHeaders: [string, string, string];
      rows: [string, string, string][];
    };
    games: {
      title: string;
      introBefore: string;
      introLink: string;
      introAfter: string;
      bullets: { label: string; href: string; rest: string }[];
    };
    timezone: { title: string; body: string };
    faq: { title: string };
  };
  faq: { q: string; a: string }[];
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    heading: string;
    items: { href: string; title: string; blurb: string }[];
  };
}

export const copy: Record<Locale, EurovisionPartyCopy> = {
  en: {
    meta: {
      title: 'Eurovision Party \u2014 The Complete Hosting Playbook for 2026',
      description:
        'Throw a Eurovision party in 2026: headcount, venue, theme, country-themed buffet, four-hour run-of-show, and the free scoring games that keep every song competitive.',
      headline: 'Eurovision Party — The Complete Hosting Playbook for 2026',
      articleDescription:
        'How to throw a Eurovision party in 2026: headcount, venue, theme, country-themed food, a four-hour run-of-show, and the free games to keep guests competitive.',
      eventName: 'Eurovision Song Contest 2026 — Grand Final watch party',
      eventDescription:
        'Host a Eurovision watch party for the 2026 grand final on Saturday 16 May. Country-themed food, costumes, and a free scoring app for predictions, quiz, and duels.',
      keywords: [
        'eurovision party',
        'how to host eurovision party',
        'eurovision watch party',
        'eurovision party games',
        'eurovision party ideas',
        'eurovision night',
      ],
    },
    crumbs: { home: 'Home', current: 'Eurovision Party' },
    hero: {
      chip: 'Hosting playbook',
      title: 'Eurovision party — the complete hosting playbook',
      lede:
        'A Eurovision party is a watch party for the Eurovision Song Contest, usually styled as a costume night with themed food, voting games, and rowdy commentary. Done right, it is the most chaotic dinner party of the year. Here is how to run one — guest list, theme, food, run-of-show, and how to keep every song competitive.',
    },
    sections: {
      what: {
        title: 'What is a Eurovision party?',
        intro:
          'A Eurovision party is a structured watch night built around the grand final of the Eurovision Song Contest. The broadcast lasts roughly three and a half hours; a good party turns that runtime into a competition by adding three ingredients: ',
        b1: 'opinions',
        b1Suffix: ' (everyone has a take), ',
        b2: 'stakes',
        b2Suffix: ' (a scored game makes every song matter), and ',
        b3: 'sustained energy',
        outro:
          ' (food, costumes, and breaks structured around the broadcast). Skip any one and you get a quiet living-room screening — fun, but not a party.',
      },
      headcount: {
        title: 'Headcount and venue',
        bullets: [
          {
            strong: '2\u201320 players via the app.',
            rest: ' Sweet spot is 6\u201310 — enough variety in predictions and duels without the trivia rotation getting stale.',
          },
          {
            strong: 'Living room, garden, or Zoom.',
            rest: " The scoring app runs on every guest's phone, so the venue just has to fit the broadcast and the buffet.",
          },
          {
            strong: 'Broadcast source.',
            rest:
              ' National broadcaster (BBC, RAI, ARD, ERT, etc.), the official Eurovision YouTube stream where available, or a projector pulled from any of the above.',
          },
          {
            strong: 'One screen for the show, one for the leaderboard.',
            rest: ' A second screen mirroring the ',
            link: {
              before: '',
              label: 'live Dashboard',
              after: ' keeps the standings visible without anyone craning at a phone.',
            },
          },
        ],
      },
      theme: {
        title: 'Theme and decor',
        bullets: [
          {
            strong: 'National flag bunting.',
            rest:
              ' Print the 26 grand-final flags and string them across the room — cheapest, most legible decor on the night.',
          },
          {
            strong: 'A mini disco ball.',
            rest:
              ' One on a battery base in the buffet area is enough to tilt the whole room into Eurovision territory.',
          },
          {
            strong: 'Battery-powered LED lights.',
            rest: ' Pink and purple to match the broadcast palette; tape them along the screen frame.',
          },
          {
            strong: 'Country assignments.',
            rest:
              ' Each guest draws a country at the door from a bowl and roots for it all night — instant emotional investment.',
          },
        ],
      },
      food: {
        title: 'Food and drink — country-themed buffet',
        intro:
          'Pick six countries from the running order and serve one dish per country, all finger food (no plating during the show). A representative spread:',
        bullets: [
          { strong: 'Sweden', rest: ' — meatballs with lingonberry.' },
          { strong: 'Italy', rest: ' — arancini and bruschetta.' },
          { strong: 'Greece', rest: ' — spanakopita triangles.' },
          { strong: 'UK', rest: ' — sausage rolls.' },
          { strong: 'France', rest: ' — mini croissants with brie.' },
          { strong: 'Israel', rest: ' — hummus with pita.' },
        ],
        drinks:
          'Drinks: country-themed cocktails (Aperol for Italy, Aquavit for Sweden, Limoncello for Italy, Pastis for France) plus a generous mocktail option for designated drivers and non-drinkers.',
      },
      runOfShow: {
        title: 'Run-of-show — 4-hour timeline',
        intro:
          'Times are relative to broadcast start (T-0 = first song). Anchor everything around T-0 and the night runs itself.',
        tableHeaders: ['Time', 'What happens', 'What to do'],
        rows: [
          ['T-60', 'Doors open', 'Country draw, costume judging, first drink'],
          ['T-45', 'Predictions phase', 'Open the room, share the join code'],
          ['T-30', 'Lock predictions', 'Run quiz round 1; final buffet top-up'],
          ['T-0', 'Broadcast starts', 'Host advances to Live Show; quiz locks, duels open'],
          ['T+0\u20132:00', '26 entries air', 'Duels run during postcards and ad breaks'],
          ['T+2:00', 'Interval act (~25 min)', 'Big duel window; hot food drop'],
          ['T+2:30', 'Voting opens', 'Lines for jury + televote'],
          ['T+3:00', 'Jury vote', 'Most chaotic 25 minutes on TV'],
          ['T+3:30', 'Televote + winner', 'Host enters official results into the room'],
          ['T+3:45', 'Trophy reveal', 'Five winners in the app; photos'],
        ],
      },
      games: {
        title: 'Game options to layer on',
        introBefore: '',
        introLink: 'Eurovision Games',
        introAfter:
          ' stacks four scoring modes across the night — pick all four for full chaos, or just predictions if you want a quieter room.',
        bullets: [
          {
            label: 'Predictions',
            href: '/eurovision-2026-predictions',
            rest: ' — Top 5 and Worst 5, locked at T-0. The 500-point spine of the leaderboard.',
          },
          {
            label: 'Quiz',
            href: '/eurovision-trivia',
            rest: ' — three preshow rounds, locked when the broadcast starts.',
          },
          {
            label: 'Duels',
            href: '/duels',
            rest: ' — head-to-head trivia in the ad breaks. Steal or Double.',
          },
          {
            label: 'Dashboard',
            href: '/dashboard',
            rest: ' — the live leaderboard everyone in the room is watching.',
          },
        ],
      },
      timezone: {
        title: 'Hosting in different time zones',
        body:
          "Eurovision broadcasts live in CET, which is mid-evening for most of Europe but late for the UK and Ireland and very late for Western Europe's Atlantic edges. In the Americas it is early afternoon to early evening; in Australia and New Zealand it lands as a Sunday morning brunch. Match the food to the local slot — brunch spreads in Sydney, full dinner in Berlin — but keep the run-of-show identical: doors at T-60, predictions locked at T-0, duels in the breaks. The room link works the same in every time zone.",
      },
      faq: { title: 'Frequently asked questions' },
    },
    faq: [
      {
        q: 'How long does a Eurovision party last?',
        a: 'Plan for four to five hours from doors to last drink. Doors open an hour before broadcast, the grand final runs roughly three and a half hours including the jury and televote, and trophy reveals plus debrief takes another twenty minutes.',
      },
      {
        q: 'What if guests turn up late?',
        a: 'Lock predictions before song one no matter what — that is the only hard deadline. Late arrivals can still join the room and play quiz rounds (if the preshow is still running), duels, and trophy categories that do not need predictions. They simply forfeit the 500-point predictions ceiling.',
      },
      {
        q: 'What if I do not have a TV?',
        a: 'Stream the official broadcast on a laptop or projector. Most national broadcasters carry it free in the EBU region, and the official Eurovision YouTube channel runs an English-language stream live in many territories.',
      },
      {
        q: 'Can I host the party on Zoom?',
        a: 'Yes. Share the room link in the Zoom chat and screen-share the broadcast. Guests play on their phones while watching the call. The Dashboard works as a second window on a tablet so everyone can glance at the leaderboard.',
      },
      {
        q: 'What if someone leaves early?',
        a: 'Their score freezes. Predictions and quiz totals are already banked, duel records stay on the leaderboard, and they keep any trophies they win — so the friend who has to put kids to bed at 22:00 can still walk away with Oracle or Guru.',
      },
      {
        q: 'How many guests is too many?',
        a: 'The app supports 20 in a single room, but past 12 the watch dynamic changes — fewer people pay close attention to each song, and trivia duels cannot rotate through everyone before the night ends. For a competitive party, 6\u201310 is the sweet spot.',
      },
    ],
    cta: {
      title: 'Lock in your Eurovision party',
      body: 'Send the room link with the invite — guests can predict from anywhere.',
      primary: 'Create',
      secondary: 'Eurovision night',
    },
    related: {
      heading: 'Keep reading',
      items: [
        {
          href: '/eurovision-night',
          title: 'Eurovision Night',
          blurb: 'Minute-by-minute run-of-show across the four-hour broadcast.',
        },
        {
          href: '/how-to-play',
          title: 'How to play',
          blurb: 'Sixty-second setup walkthrough — create-room to trophy reveal.',
        },
        {
          href: '/eurovision-2026-predictions',
          title: 'Predictions',
          blurb: 'Top 5 and Worst 5 — the 500-point engine of every party leaderboard.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Trivia',
          blurb: 'Sample quiz questions and how the bank is structured.',
        },
        {
          href: '/duels',
          title: 'Duels',
          blurb: 'Head-to-head battles for the ad-break window. Steal or Double.',
        },
        {
          href: '/faq',
          title: 'FAQ',
          blurb: 'Edge cases — late guests, leavers, Zoom hosting, and time zones.',
        },
      ],
    },
  },
  el: {
    meta: {
      title: 'Πάρτι Eurovision \u2014 Ο πλήρης οδηγός διοργάνωσης για το 2026',
      description:
        'Διοργάνωσε πάρτι Eurovision το 2026: αριθμός καλεσμένων, χώρος, θέμα, μπουφές με πιάτα ανά χώρα, σειρά εμφάνισης τεσσάρων ωρών και τα δωρεάν παιχνίδια βαθμολογίας που κρατούν κάθε τραγούδι ανταγωνιστικό.',
      headline: 'Πάρτι Eurovision — Ο πλήρης οδηγός διοργάνωσης για το 2026',
      articleDescription:
        'Πώς διοργανώνεις πάρτι Eurovision το 2026: αριθμός καλεσμένων, χώρος, θέμα, φαγητό ανά χώρα, σειρά εμφάνισης τεσσάρων ωρών και τα δωρεάν παιχνίδια που κρατούν τους καλεσμένους ανταγωνιστικούς.',
      eventName: 'Eurovision Song Contest 2026 — Βραδιά μεγάλου τελικού',
      eventDescription:
        'Διοργάνωσε βραδιά Eurovision για τον μεγάλο τελικό του 2026, Σάββατο 16 Μαΐου. Φαγητό ανά χώρα, κοστούμια και μια δωρεάν εφαρμογή βαθμολογίας για προβλέψεις, quiz και μονομαχίες.',
      keywords: [
        'πάρτι eurovision',
        'πώς διοργανώνεις πάρτι eurovision',
        'βραδιά eurovision',
        'παιχνίδια πάρτι eurovision',
        'ιδέες πάρτι eurovision',
        'eurovision night',
      ],
    },
    crumbs: { home: 'Αρχική', current: 'Πάρτι Eurovision' },
    hero: {
      chip: 'Οδηγός διοργάνωσης',
      title: 'Πάρτι Eurovision — πλήρης οδηγός διοργάνωσης',
      lede:
        'Το πάρτι Eurovision είναι μια βραδιά Eurovision για τη μεγάλη βραδιά του Eurovision Song Contest, συνήθως ντυμένη σαν costume night με θεματικό φαγητό, παιχνίδια ψηφοφορίας και ζωηρά σχόλια. Όταν στηθεί σωστά, είναι το πιο χαοτικό δείπνο της χρονιάς. Δες πώς το στήνεις — λίστα καλεσμένων, θέμα, φαγητό, σειρά εμφάνισης και πώς κρατάς ανταγωνιστικό κάθε τραγούδι.',
    },
    sections: {
      what: {
        title: 'Τι είναι το πάρτι Eurovision;',
        intro:
          'Το πάρτι Eurovision είναι μια δομημένη βραδιά Eurovision γύρω από τον μεγάλο τελικό του Eurovision Song Contest. Η μετάδοση κρατάει περίπου τρεισήμισι ώρες· ένα καλό πάρτι μετατρέπει αυτή τη διάρκεια σε διαγωνισμό προσθέτοντας τρία συστατικά: ',
        b1: 'απόψεις',
        b1Suffix: ' (όλοι έχουν άποψη), ',
        b2: 'στοίχημα',
        b2Suffix: ' (ένα παιχνίδι με βαθμολογία κάνει κάθε τραγούδι να μετράει) και ',
        b3: 'συνεχής ενέργεια',
        outro:
          ' (φαγητό, κοστούμια και διαλείμματα δομημένα γύρω από τη μετάδοση). Παράλειψε ένα και έχεις μια ήσυχη προβολή στο σαλόνι — διασκεδαστική, αλλά όχι πάρτι.',
      },
      headcount: {
        title: 'Καλεσμένοι και χώρος',
        bullets: [
          {
            strong: '2\u201320 παίκτες μέσω της εφαρμογής.',
            rest:
              ' Ιδανικό σημείο τα 6\u201310 — αρκετή ποικιλία στις προβλέψεις και τις μονομαχίες χωρίς να βαρετιάζει η εναλλαγή trivia.',
          },
          {
            strong: 'Σαλόνι, κήπος ή Zoom.',
            rest:
              ' Η εφαρμογή βαθμολογίας τρέχει στο κινητό κάθε καλεσμένου, οπότε ο χώρος αρκεί να χωράει τη μετάδοση και τον μπουφέ.',
          },
          {
            strong: 'Πηγή μετάδοσης.',
            rest:
              ' Εθνικός μεταδότης (BBC, RAI, ARD, ΕΡΤ κ.ά.), το επίσημο stream της Eurovision στο YouTube όπου είναι διαθέσιμο, ή projector με οποιαδήποτε από τις παραπάνω πηγές.',
          },
          {
            strong: 'Μία οθόνη για την εκπομπή, μία για τον πίνακα βαθμολογίας.',
            rest: ' Μια δεύτερη οθόνη που δείχνει το ',
            link: {
              before: '',
              label: 'ζωντανό Dashboard',
              after: ' κρατάει την κατάταξη ορατή χωρίς να σκύβει κανείς πάνω από το κινητό.',
            },
          },
        ],
      },
      theme: {
        title: 'Θέμα και διακόσμηση',
        bullets: [
          {
            strong: 'Γιρλάντα με σημαίες.',
            rest:
              ' Τύπωσε τις 26 σημαίες του μεγάλου τελικού και κρέμασέ τες στον χώρο — η πιο φθηνή και ευδιάκριτη διακόσμηση της βραδιάς.',
          },
          {
            strong: 'Μια μίνι ντίσκο μπάλα.',
            rest:
              ' Μία σε βάση μπαταρίας στον μπουφέ αρκεί για να γείρει όλος ο χώρος προς πλευρά Eurovision.',
          },
          {
            strong: 'LED φωτάκια με μπαταρία.',
            rest: ' Ροζ και μωβ για να ταιριάζουν στην παλέτα της εκπομπής· κόλλησέ τα γύρω από το πλαίσιο της οθόνης.',
          },
          {
            strong: 'Κλήρωση χωρών.',
            rest:
              ' Κάθε καλεσμένος τραβάει μια χώρα από μπολ στην είσοδο και την υποστηρίζει όλη τη βραδιά — άμεση συναισθηματική επένδυση.',
          },
        ],
      },
      food: {
        title: 'Φαγητό και ποτό — μπουφές ανά χώρα',
        intro:
          'Διάλεξε έξι χώρες από τη σειρά εμφάνισης και σέρβιρε ένα πιάτο ανά χώρα, όλα finger food (χωρίς πιάτα στο σερβίρισμα κατά τη διάρκεια της εκπομπής). Μια ενδεικτική επιλογή:',
        bullets: [
          { strong: 'Σουηδία', rest: ' — σουηδικά κεφτέδες με σάλτσα lingonberry.' },
          { strong: 'Ιταλία', rest: ' — arancini και bruschetta.' },
          { strong: 'Ελλάδα', rest: ' — τρίγωνα σπανακόπιτα.' },
          { strong: 'Ηνωμένο Βασίλειο', rest: ' — sausage rolls (ρολά λουκάνικου σε σφολιάτα).' },
          { strong: 'Γαλλία', rest: ' — μίνι croissants με μπρι.' },
          { strong: 'Ισραήλ', rest: ' — χούμους με πίτα.' },
        ],
        drinks:
          'Ποτά: κοκτέιλ ανά χώρα (Aperol για Ιταλία, Aquavit για Σουηδία, Limoncello για Ιταλία, Pastis για Γαλλία) και μια γενναιόδωρη επιλογή mocktail για τους οδηγούς και όσους δεν πίνουν.',
      },
      runOfShow: {
        title: 'Σειρά εμφάνισης — χρονοδιάγραμμα 4 ωρών',
        intro:
          'Οι ώρες είναι σε σχέση με την έναρξη της μετάδοσης (T-0 = πρώτο τραγούδι). Αγκύρωσε τα πάντα γύρω από το T-0 και η βραδιά τρέχει μόνη της.',
        tableHeaders: ['Ώρα', 'Τι συμβαίνει', 'Τι να κάνεις'],
        rows: [
          ['T-60', 'Άνοιγμα πόρτας', 'Κλήρωση χώρας, βραβείο κοστουμιού, πρώτο ποτό'],
          ['T-45', 'Φάση προβλέψεων', 'Άνοιξε το δωμάτιο, μοίρασε τον κωδικό συμμετοχής'],
          ['T-30', 'Κλείδωμα προβλέψεων', 'Τρέξε γύρο quiz 1· τελευταίο ανανέωμα μπουφέ'],
          ['T-0', 'Έναρξη μετάδοσης', 'Ο οικοδεσπότης προχωράει στη Ζωντανή Εκπομπή· quiz κλειδώνει, μονομαχίες ανοίγουν'],
          ['T+0\u20132:00', '26 συμμετοχές στον αέρα', 'Μονομαχίες στις postcards και τα διαφημιστικά'],
          ['T+2:00', 'Interval act (~25 λεπτά)', 'Μεγάλο παράθυρο μονομαχιών· έξτρα ζεστό φαγητό'],
          ['T+2:30', 'Άνοιγμα ψηφοφορίας', 'Γραμμές κριτικής επιτροπής + televote'],
          ['T+3:00', 'Ψήφος κριτικής επιτροπής', 'Τα πιο χαοτικά 25 λεπτά της τηλεοπτικής χρονιάς'],
          ['T+3:30', 'Televote + νικητής', 'Ο οικοδεσπότης καταχωρεί τα επίσημα αποτελέσματα στο δωμάτιο'],
          ['T+3:45', 'Αποκάλυψη τροπαίων', 'Πέντε νικητές στην εφαρμογή· φωτογραφίες'],
        ],
      },
      games: {
        title: 'Παιχνίδια για να βάλεις πάνω',
        introBefore: 'Το ',
        introLink: 'Eurovision Games',
        introAfter:
          ' στοιβάζει τέσσερα modes βαθμολογίας μέσα στη βραδιά — διάλεξε και τα τέσσερα για πλήρες χάος ή μόνο τις προβλέψεις αν θες πιο ήσυχο δωμάτιο.',
        bullets: [
          {
            label: 'Προβλέψεις',
            href: '/eurovision-2026-predictions',
            rest: ' — Top 5 και Worst 5, κλειδωμένες στο T-0. Η σπονδυλική στήλη των 500 πόντων του πίνακα βαθμολογίας.',
          },
          {
            label: 'Quiz',
            href: '/eurovision-trivia',
            rest: ' — τρεις γύροι στο pre-show, κλειδώνουν όταν ξεκινάει η μετάδοση.',
          },
          {
            label: 'Μονομαχίες',
            href: '/duels',
            rest: ' — trivia ένας προς έναν στα διαφημιστικά διαλείμματα. Steal ή Double.',
          },
          {
            label: 'Dashboard',
            href: '/dashboard',
            rest: ' — ο ζωντανός πίνακας βαθμολογίας που παρακολουθούν όλοι στο δωμάτιο.',
          },
        ],
      },
      timezone: {
        title: 'Διοργάνωση σε διαφορετικές ζώνες ώρας',
        body:
          'Η Eurovision μεταδίδεται ζωντανά σε ώρα CET, που για το μεγαλύτερο μέρος της Ευρώπης είναι μέσο βράδυ, αλλά αργά για το Ηνωμένο Βασίλειο και την Ιρλανδία και πολύ αργά για τις δυτικές παρυφές της Ευρώπης. Στην Αμερική είναι αρχές απογεύματος έως αρχές βραδιού· στην Αυστραλία και τη Νέα Ζηλανδία πέφτει σαν πρωινό μπραντς της Κυριακής. Ταίριαξε το φαγητό με την τοπική ζώνη — μπραντς στο Σίδνεϊ, πλήρες δείπνο στο Βερολίνο — αλλά κράτα τη σειρά εμφάνισης ίδια: άνοιγμα πόρτας στο T-60, κλείδωμα προβλέψεων στο T-0, μονομαχίες στα διαλείμματα. Ο σύνδεσμος του δωματίου δουλεύει το ίδιο σε κάθε ζώνη ώρας.',
      },
      faq: { title: 'Συχνές ερωτήσεις' },
    },
    faq: [
      {
        q: 'Πόσο διαρκεί ένα πάρτι Eurovision;',
        a: 'Υπολόγισε τέσσερις με πέντε ώρες από το άνοιγμα της πόρτας μέχρι το τελευταίο ποτό. Η πόρτα ανοίγει μία ώρα πριν τη μετάδοση, ο μεγάλος τελικός κρατάει περίπου τρεισήμισι ώρες μαζί με κριτική επιτροπή και televote, και η αποκάλυψη τροπαίων με το debrief παίρνει άλλα είκοσι λεπτά.',
      },
      {
        q: 'Τι γίνεται αν αργήσουν καλεσμένοι;',
        a: 'Κλείδωσε τις προβλέψεις πριν το πρώτο τραγούδι ό,τι κι αν γίνει — αυτή είναι η μόνη σκληρή προθεσμία. Όσοι έρθουν αργότερα μπορούν να μπουν στο δωμάτιο και να παίξουν γύρους quiz (αν τρέχει ακόμα το pre-show), μονομαχίες και κατηγορίες τροπαίων που δεν χρειάζονται προβλέψεις. Απλώς χάνουν το ταβάνι των 500 πόντων από τις προβλέψεις.',
      },
      {
        q: 'Τι κάνω αν δεν έχω τηλεόραση;',
        a: 'Δες την επίσημη μετάδοση σε laptop ή projector. Οι περισσότεροι εθνικοί μεταδότες την έχουν δωρεάν στην περιοχή της EBU και το επίσημο κανάλι της Eurovision στο YouTube προσφέρει αγγλόφωνο stream ζωντανά σε πολλές χώρες.',
      },
      {
        q: 'Μπορώ να κάνω το πάρτι σε Zoom;',
        a: 'Ναι. Μοίρασε τον σύνδεσμο του δωματίου στο chat του Zoom και κάνε screen-share τη μετάδοση. Οι καλεσμένοι παίζουν στα κινητά τους ενώ παρακολουθούν την κλήση. Το Dashboard δουλεύει σαν δεύτερο παράθυρο σε tablet για να βλέπουν όλοι την κατάταξη.',
      },
      {
        q: 'Τι γίνεται αν φύγει κάποιος νωρίτερα;',
        a: 'Η βαθμολογία του παγώνει. Τα σύνολα προβλέψεων και quiz είναι ήδη κατοχυρωμένα, οι μονομαχίες μένουν στον πίνακα και κρατάει όσα τρόπαια κερδίζει — έτσι ο φίλος που πρέπει να βάλει τα παιδιά για ύπνο στις 22:00 μπορεί να φύγει με Μάντη ή Γκουρού.',
      },
      {
        q: 'Πόσοι καλεσμένοι είναι πολλοί;',
        a: 'Η εφαρμογή υποστηρίζει 20 παίκτες σε ένα δωμάτιο, αλλά πάνω από 12 αλλάζει η δυναμική παρακολούθησης — λιγότεροι δίνουν προσοχή σε κάθε τραγούδι και οι μονομαχίες trivia δεν προλαβαίνουν να εναλλαχθούν σε όλους πριν τελειώσει η βραδιά. Για ένα ανταγωνιστικό πάρτι, τα 6\u201310 είναι το ιδανικό σημείο.',
      },
    ],
    cta: {
      title: 'Κλείδωσε το πάρτι Eurovision σου',
      body: 'Στείλε τον σύνδεσμο του δωματίου με την πρόσκληση — οι καλεσμένοι μπορούν να κάνουν προβλέψεις από οπουδήποτε.',
      primary: 'Δημιουργία',
      secondary: 'Βραδιά Eurovision',
    },
    related: {
      heading: 'Συνέχισε την ανάγνωση',
      items: [
        {
          href: '/eurovision-night',
          title: 'Βραδιά Eurovision',
          blurb: 'Λεπτό προς λεπτό σειρά εμφάνισης σε όλη την τετράωρη μετάδοση.',
        },
        {
          href: '/how-to-play',
          title: 'Πώς παίζεις',
          blurb: 'Οδηγός εκκίνησης 60 δευτερολέπτων — από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.',
        },
        {
          href: '/eurovision-2026-predictions',
          title: 'Προβλέψεις',
          blurb: 'Top 5 και Worst 5 — η μηχανή των 500 πόντων κάθε πίνακα βαθμολογίας πάρτι.',
        },
        {
          href: '/eurovision-trivia',
          title: 'Trivia',
          blurb: 'Δείγματα ερωτήσεων quiz και πώς δομείται η τράπεζα.',
        },
        {
          href: '/duels',
          title: 'Μονομαχίες',
          blurb: 'Μάχες ένας προς έναν για το παράθυρο των διαφημιστικών. Steal ή Double.',
        },
        {
          href: '/faq',
          title: 'Συχνές ερωτήσεις',
          blurb: 'Ειδικές περιπτώσεις — αργοπορημένοι, αποχωρήσεις, Zoom hosting και ζώνες ώρας.',
        },
      ],
    },
  },
};
