import type { Locale } from '../../../lib/seo/locale';

interface FaqItem { q: string; a: string }
interface RelatedCard { href: string; title: string; blurb: string }

interface WinnersCopy {
  meta: {
    title: string;
    description: string;
    keywords: string[];
    schemaTitle: string;
    schemaDescription: string;
  };
  crumbs: { home: string; history: string; winners: string };
  hero: { chip: string; title: string; lede: string };
  sections: {
    recent: { title: string; intro: string; headers: { year: string; country: string; artist: string; song: string; points: string } };
    leaderboard: { title: string; intro: string; headers: { country: string; wins: string; mostRecent: string } };
    notable: { title: string; intro: string; bullets: { strong: string; rest: string }[] };
  };
  faq: FaqItem[];
  cta: { title: string; body: string; primary: string; secondary: string };
  related: { heading: string; items: RelatedCard[] };
}

// ─── Recent winners (2010-2025) — single source for both locales ──────────
// Country names come out of getLocalizedCountryName for EL where available;
// for the table we hardcode names per locale to keep the row table simple.
const RECENT_EN = [
  ['2025', 'Austria', 'JJ', 'Wasted Love', '436'],
  ['2024', 'Switzerland', 'Nemo', 'The Code', '591'],
  ['2023', 'Sweden', 'Loreen', 'Tattoo', '583'],
  ['2022', 'Ukraine', 'Kalush Orchestra', 'Stefania', '631'],
  ['2021', 'Italy', 'Måneskin', 'Zitti e buoni', '524'],
  ['2019', 'Netherlands', 'Duncan Laurence', 'Arcade', '498'],
  ['2018', 'Israel', 'Netta', 'Toy', '529'],
  ['2017', 'Portugal', 'Salvador Sobral', 'Amar pelos dois', '758'],
  ['2016', 'Ukraine', 'Jamala', '1944', '534'],
  ['2015', 'Sweden', 'Måns Zelmerlöw', 'Heroes', '365'],
  ['2014', 'Austria', 'Conchita Wurst', 'Rise Like a Phoenix', '290'],
  ['2013', 'Denmark', 'Emmelie de Forest', 'Only Teardrops', '281'],
  ['2012', 'Sweden', 'Loreen', 'Euphoria', '372'],
  ['2011', 'Azerbaijan', 'Ell & Nikki', 'Running Scared', '221'],
  ['2010', 'Germany', 'Lena', 'Satellite', '246'],
];

const RECENT_EL = [
  ['2025', 'Αυστρία', 'JJ', 'Wasted Love', '436'],
  ['2024', 'Ελβετία', 'Nemo', 'The Code', '591'],
  ['2023', 'Σουηδία', 'Loreen', 'Tattoo', '583'],
  ['2022', 'Ουκρανία', 'Kalush Orchestra', 'Stefania', '631'],
  ['2021', 'Ιταλία', 'Måneskin', 'Zitti e buoni', '524'],
  ['2019', 'Ολλανδία', 'Duncan Laurence', 'Arcade', '498'],
  ['2018', 'Ισραήλ', 'Netta', 'Toy', '529'],
  ['2017', 'Πορτογαλία', 'Salvador Sobral', 'Amar pelos dois', '758'],
  ['2016', 'Ουκρανία', 'Jamala', '1944', '534'],
  ['2015', 'Σουηδία', 'Måns Zelmerlöw', 'Heroes', '365'],
  ['2014', 'Αυστρία', 'Conchita Wurst', 'Rise Like a Phoenix', '290'],
  ['2013', 'Δανία', 'Emmelie de Forest', 'Only Teardrops', '281'],
  ['2012', 'Σουηδία', 'Loreen', 'Euphoria', '372'],
  ['2011', 'Αζερμπαϊτζάν', 'Ell & Nikki', 'Running Scared', '221'],
  ['2010', 'Γερμανία', 'Lena', 'Satellite', '246'],
];

const LEADERBOARD_EN = [
  ['Ireland', '7', '1996'],
  ['Sweden', '7', '2023'],
  ['Luxembourg', '5', '1983'],
  ['France', '5', '1977'],
  ['Netherlands', '5', '2019'],
  ['United Kingdom', '5', '1997'],
  ['Israel', '4', '2018'],
  ['Norway', '3', '2009'],
  ['Denmark', '3', '2013'],
  ['Ukraine', '3', '2022'],
  ['Italy', '3', '2021'],
  ['Switzerland', '3', '2024'],
];

const LEADERBOARD_EL = [
  ['Ιρλανδία', '7', '1996'],
  ['Σουηδία', '7', '2023'],
  ['Λουξεμβούργο', '5', '1983'],
  ['Γαλλία', '5', '1977'],
  ['Ολλανδία', '5', '2019'],
  ['Ηνωμένο Βασίλειο', '5', '1997'],
  ['Ισραήλ', '4', '2018'],
  ['Νορβηγία', '3', '2009'],
  ['Δανία', '3', '2013'],
  ['Ουκρανία', '3', '2022'],
  ['Ιταλία', '3', '2021'],
  ['Ελβετία', '3', '2024'],
];

export const recentWinners = { en: RECENT_EN, el: RECENT_EL };
export const leaderboard = { en: LEADERBOARD_EN, el: LEADERBOARD_EL };

export const copy: Record<Locale, WinnersCopy> = {
  en: {
    meta: {
      title: 'Eurovision Winners — Every Champion 1956 to Today · Eurovision Games',
      description: 'Complete list of Eurovision Song Contest winners from 1956 to 2025. Recent champions, all-time leaderboard, record-holders, and notable moments.',
      keywords: [
        'eurovision winners', 'eurovision song contest winners', 'eurovision champion list',
        'eurovision all winners', 'eurovision winning songs', 'eurovision most wins',
        'eurovision 2025 winner', 'eurovision history',
      ],
      schemaTitle: 'Eurovision Winners — Every Champion 1956 to Today',
      schemaDescription: 'Reference list of Eurovision Song Contest winners with year, country, artist, song, and points. Plus the all-time wins leaderboard and notable record-holders.',
    },
    crumbs: { home: 'Home', history: 'Eurovision history', winners: 'Winners' },
    hero: {
      chip: 'Eurovision history',
      title: 'Every Eurovision winner — 1956 to today',
      lede: 'A reference for the most-asked Eurovision question: who won? Below — the last 15 champions with songs and final-round points, the all-time wins leaderboard, and the records that still stand.',
    },
    sections: {
      recent: {
        title: 'Recent winners (2010–2025)',
        intro: 'Winners since 2010, with the song, performing artist, and the combined jury + televote points from the grand final. (No 2020 — the contest was cancelled due to COVID.)',
        headers: { year: 'Year', country: 'Country', artist: 'Artist', song: 'Song', points: 'Points' },
      },
      leaderboard: {
        title: 'All-time wins leaderboard',
        intro: 'Countries that have won Eurovision more than twice. Ireland and Sweden share the all-time record at 7 wins each — Sweden caught up in 2023.',
        headers: { country: 'Country', wins: 'Wins', mostRecent: 'Most recent' },
      },
      notable: {
        title: 'Notable records',
        intro: 'A handful of records that still stand or have only just been broken:',
        bullets: [
          { strong: 'Highest score, modern era — Salvador Sobral, Portugal, 2017.', rest: ' 758 points with "Amar pelos dois" — the only ballad to ever win in the modern split-jury era.' },
          { strong: 'Most wins by a single artist — Johnny Logan, Ireland.', rest: ' Won as performer in 1980 ("What\'s Another Year") and 1987 ("Hold Me Now"), then again in 1992 as songwriter for Linda Martin.' },
          { strong: 'Most consecutive wins — Sweden, 2012 + 2023 by Loreen.', rest: ' First and only artist to win Eurovision twice as performer.' },
          { strong: 'Biggest televote landslide — Kalush Orchestra, Ukraine, 2022.', rest: ' 439 audience points (max possible was ~480 that year) — the highest ever, riding wartime solidarity.' },
          { strong: 'First contest, 1956 — Switzerland (Lys Assia, "Refrain").', rest: ' Only seven countries competed; voting was kept secret. The full results were never published.' },
        ],
      },
    },
    faq: [
      {
        q: 'Who has won Eurovision the most times?',
        a: 'Ireland and Sweden are tied with 7 wins each. Sweden equalised in 2023 when Loreen won her second contest with "Tattoo" — making her the first artist to ever win Eurovision twice.',
      },
      {
        q: 'When was the first Eurovision Song Contest?',
        a: 'The first contest was held in Lugano, Switzerland on 24 May 1956. Seven countries competed. Switzerland won with "Refrain" performed by Lys Assia.',
      },
      {
        q: 'What\'s the highest-scoring winning song?',
        a: '"Amar pelos dois" by Salvador Sobral (Portugal, 2017) holds the modern-era record at 758 points. The voting system has changed multiple times so direct comparisons across eras are not meaningful.',
      },
      {
        q: 'Has the same person won twice?',
        a: 'Yes. Loreen (Sweden) won in 2012 with "Euphoria" and again in 2023 with "Tattoo" — the only performer to win Eurovision twice. Johnny Logan (Ireland) won twice as performer (1980, 1987) and a third time in 1992 as songwriter.',
      },
      {
        q: 'Why was there no Eurovision winner in 2020?',
        a: 'The 2020 contest, scheduled for Rotterdam, was cancelled in March 2020 due to COVID-19. It was the first cancellation in the contest\'s history. The Netherlands kept the host slot for 2021, where Italy\'s Måneskin won.',
      },
    ],
    cta: {
      title: 'Predict the next winner',
      body: 'Lock your Top 5 before kick-off, score live against the official jury + televote, and see if you can pick this year\'s champion before everyone else.',
      primary: 'Create room',
      secondary: 'How to play',
    },
    related: {
      heading: 'Keep reading',
      items: [
        { href: '/eurovision-2026-predictions', title: 'Eurovision 2026 predictions', blurb: 'Top 5 / Worst 5 format and the 35-country lineup.' },
        { href: '/eurovision-night', title: 'Eurovision night', blurb: '10-step playbook for the watch party.' },
        { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '50+ sample questions across decades.' },
        { href: '/eurovision-party', title: 'Eurovision party', blurb: 'Hosting playbook with run-of-show.' },
        { href: '/scoring', title: 'Scoring formulas', blurb: 'How the voting system has evolved.' },
        { href: '/faq', title: 'FAQ', blurb: 'Setup, scoring, and gameplay questions.' },
      ],
    },
  },

  el: {
    meta: {
      title: 'Νικητές Eurovision — Όλοι οι Πρωταθλητές 1956 έως Σήμερα · Eurovision Games',
      description: 'Πλήρης λίστα νικητών της Eurovision από το 1956 μέχρι το 2025. Πρόσφατοι πρωταθλητές, αιώνιο πίνακας νικών, ρεκόρ και αξιοσημείωτες στιγμές.',
      keywords: [
        'νικητές eurovision', 'πρωταθλητές eurovision', 'eurovision νικητής 2025',
        'eurovision νικητές λίστα', 'eurovision ιστορία', 'eurovision νικητές χωρών',
        'eurovision όλοι νικητές',
      ],
      schemaTitle: 'Νικητές Eurovision — Όλοι οι Πρωταθλητές 1956 έως Σήμερα',
      schemaDescription: 'Λίστα νικητών της Eurovision με χρονιά, χώρα, καλλιτέχνη, τραγούδι και πόντους. Πίνακας αιώνιων νικών και κατόχοι ρεκόρ.',
    },
    crumbs: { home: 'Αρχική', history: 'Ιστορία Eurovision', winners: 'Νικητές' },
    hero: {
      chip: 'Ιστορία Eurovision',
      title: 'Όλοι οι νικητές Eurovision — 1956 έως σήμερα',
      lede: 'Αναφορά για τη πιο συχνή ερώτηση της Eurovision: ποιος κέρδισε; Παρακάτω — οι τελευταίοι 15 πρωταθλητές με τραγούδια και πόντους τελικού γύρου, ο αιώνιος πίνακας νικών, και τα ρεκόρ που στέκονται ακόμα.',
    },
    sections: {
      recent: {
        title: 'Πρόσφατοι νικητές (2010–2025)',
        intro: 'Νικητές από το 2010, με το τραγούδι, τον καλλιτέχνη, και τους συνολικούς πόντους από κριτική επιτροπή + televote στον μεγάλο τελικό. (Δεν υπάρχει 2020 — ο διαγωνισμός ακυρώθηκε λόγω COVID.)',
        headers: { year: 'Έτος', country: 'Χώρα', artist: 'Καλλιτέχνης', song: 'Τραγούδι', points: 'Πόντοι' },
      },
      leaderboard: {
        title: 'Αιώνιος πίνακας νικών',
        intro: 'Χώρες που έχουν κερδίσει την Eurovision περισσότερες από δύο φορές. Ιρλανδία και Σουηδία μοιράζονται το αιώνιο ρεκόρ με 7 νίκες — η Σουηδία ισοφάρισε το 2023.',
        headers: { country: 'Χώρα', wins: 'Νίκες', mostRecent: 'Πιο πρόσφατη' },
      },
      notable: {
        title: 'Αξιοσημείωτα ρεκόρ',
        intro: 'Μια χούφτα ρεκόρ που στέκονται ακόμα ή μόλις έσπασαν:',
        bullets: [
          { strong: 'Υψηλότερη βαθμολογία, σύγχρονη εποχή — Salvador Sobral, Πορτογαλία, 2017.', rest: ' 758 πόντοι με το "Amar pelos dois" — η μοναδική μπαλάντα που κέρδισε στη σύγχρονη εποχή της διπλής ψηφοφορίας.' },
          { strong: 'Περισσότερες νίκες από έναν καλλιτέχνη — Johnny Logan, Ιρλανδία.', rest: ' Νίκησε ως ερμηνευτής το 1980 ("What\'s Another Year") και το 1987 ("Hold Me Now"), και ξανά το 1992 ως συνθέτης για τη Linda Martin.' },
          { strong: 'Συνεχόμενες νίκες ίδιου ερμηνευτή — Σουηδία, 2012 + 2023 από τη Loreen.', rest: ' Η πρώτη και μόνη καλλιτέχνης που κέρδισε την Eurovision δύο φορές ως ερμηνεύτρια.' },
          { strong: 'Μεγαλύτερη νίκη στο televote — Kalush Orchestra, Ουκρανία, 2022.', rest: ' 439 πόντοι από το κοινό (το μέγιστο εκείνη τη χρονιά ήταν ~480) — το υψηλότερο ποτέ, με τη στήριξη του πολέμου.' },
          { strong: 'Πρώτος διαγωνισμός, 1956 — Ελβετία (Lys Assia, "Refrain").', rest: ' Μόνο επτά χώρες διαγωνίστηκαν· η ψηφοφορία κρατήθηκε μυστική. Τα πλήρη αποτελέσματα δεν δημοσιεύτηκαν ποτέ.' },
        ],
      },
    },
    faq: [
      {
        q: 'Ποιος έχει κερδίσει την Eurovision τις περισσότερες φορές;',
        a: 'Ιρλανδία και Σουηδία ισοβαθμούν με 7 νίκες η καθεμία. Η Σουηδία ισοφάρισε το 2023 όταν η Loreen κέρδισε τον δεύτερο διαγωνισμό της με το "Tattoo" — γίνοντας η πρώτη καλλιτέχνις που κερδίζει την Eurovision δύο φορές.',
      },
      {
        q: 'Πότε έγινε η πρώτη Eurovision;',
        a: 'Ο πρώτος διαγωνισμός έγινε στο Lugano της Ελβετίας στις 24 Μαΐου 1956. Επτά χώρες διαγωνίστηκαν. Η Ελβετία κέρδισε με το "Refrain" από τη Lys Assia.',
      },
      {
        q: 'Ποιο είναι το νικητήριο τραγούδι με τους περισσότερους πόντους;',
        a: 'Το "Amar pelos dois" από τον Salvador Sobral (Πορτογαλία, 2017) κρατά το ρεκόρ της σύγχρονης εποχής με 758 πόντους. Το σύστημα ψηφοφορίας έχει αλλάξει πολλές φορές, οπότε οι άμεσες συγκρίσεις μεταξύ εποχών δεν έχουν νόημα.',
      },
      {
        q: 'Έχει κερδίσει το ίδιο άτομο δύο φορές;',
        a: 'Ναι. Η Loreen (Σουηδία) κέρδισε το 2012 με το "Euphoria" και ξανά το 2023 με το "Tattoo" — η μόνη ερμηνεύτρια που κέρδισε την Eurovision δύο φορές. Ο Johnny Logan (Ιρλανδία) κέρδισε δύο φορές ως ερμηνευτής (1980, 1987) και τρίτη φορά το 1992 ως συνθέτης.',
      },
      {
        q: 'Γιατί δεν υπήρχε νικητής Eurovision το 2020;',
        a: 'Ο διαγωνισμός του 2020, που είχε προγραμματιστεί για το Rotterdam, ακυρώθηκε τον Μάρτιο του 2020 λόγω COVID-19. Ήταν η πρώτη ακύρωση στην ιστορία του διαγωνισμού. Η Ολλανδία κράτησε τη θέση οικοδέσποινας για το 2021, όπου κέρδισαν οι Måneskin από την Ιταλία.',
      },
    ],
    cta: {
      title: 'Μάντεψε τον επόμενο νικητή',
      body: 'Κλείδωσε το Top 5 σου πριν ξεκινήσει, σκόραρε ζωντανά ενάντια στις επίσημες ψήφους κριτικής επιτροπής + televote, και δες αν μπορείς να μαντέψεις τον φετινό πρωταθλητή πριν από όλους.',
      primary: 'Φτιάξε δωμάτιο',
      secondary: 'Πώς παίζεται',
    },
    related: {
      heading: 'Συνέχισε να διαβάζεις',
      items: [
        { href: '/eurovision-2026-predictions', title: 'Προβλέψεις Eurovision 2026', blurb: 'Φόρμα Top 5 / Worst 5 και λίστα 35 χωρών.' },
        { href: '/eurovision-night', title: 'Βραδιά Eurovision', blurb: 'Οδηγός 10 βημάτων για το watch party.' },
        { href: '/eurovision-trivia', title: 'Trivia Eurovision', blurb: '50+ ενδεικτικές ερωτήσεις από όλες τις δεκαετίες.' },
        { href: '/eurovision-party', title: 'Πάρτι Eurovision', blurb: 'Οδηγός διοργάνωσης με ροή της βραδιάς.' },
        { href: '/scoring', title: 'Φόρμουλες βαθμολογίας', blurb: 'Πώς έχει εξελιχθεί το σύστημα ψηφοφορίας.' },
        { href: '/faq', title: 'Συχνές ερωτήσεις', blurb: 'Ερωτήσεις για εκκίνηση, βαθμολογία και gameplay.' },
      ],
    },
  },
};
