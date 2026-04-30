import type { Locale } from '../../lib/seo/locale';

interface RelatedItem {
  title: string;
  blurb: string;
}

interface NotFoundCopy {
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
  crumbs: { home: string; notFound: string };
  hero: { chip: string; title: string; lede: string };
  cta: { title: string; body: string; primary: string; secondary: string };
  related: {
    heading: string;
    night: RelatedItem;
    predictions: RelatedItem;
    trivia: RelatedItem;
    duels: RelatedItem;
    dashboard: RelatedItem;
    howToPlay: RelatedItem;
    scoring: RelatedItem;
    faq: RelatedItem;
  };
}

export const copy: Record<Locale, NotFoundCopy> = {
  en: {
    meta: {
      title: '404 — Page Not Found · Eurovision Games',
      description:
        'That page does not exist on Eurovision Games. Head back to the home page or browse the popular guides below.',
      keywords: ['eurovision games 404', 'page not found'],
    },
    crumbs: { home: 'Home', notFound: '404 — Not Found' },
    hero: {
      chip: '404',
      title: 'This stage does not exist',
      lede:
        'The page you tried to open is not part of Eurovision Games. Maybe a typo, maybe a stale link from somewhere — either way, here are the most popular destinations to land on instead.',
    },
    cta: {
      title: 'Get back to the show',
      body: 'Spin up a Eurovision room or jump to the most-visited guides below.',
      primary: 'Open the home page',
      secondary: 'How to play',
    },
    related: {
      heading: 'Popular destinations',
      night: { title: 'Eurovision night', blurb: '10-step playbook for hosting the watch party.' },
      predictions: { title: '2026 predictions', blurb: 'Top 5 / Worst 5 format and the 35-country lineup.' },
      trivia: { title: 'Eurovision trivia', blurb: '10 sample questions and how duels work.' },
      duels: { title: 'Duels', blurb: 'Head-to-head trivia rules during the live show.' },
      dashboard: { title: 'Dashboard', blurb: 'How the live leaderboard updates as you play.' },
      howToPlay: { title: 'How to play', blurb: '60-second setup walkthrough.' },
      scoring: { title: 'Scoring formulas', blurb: 'Exact points per Top-5, quiz, and duel.' },
      faq: { title: 'FAQ', blurb: 'Answers to common setup and scoring questions.' },
    },
  },
  el: {
    meta: {
      title: '404 — Δεν βρέθηκε η σελίδα · Eurovision Games',
      description:
        'Αυτή η σελίδα δεν υπάρχει στο Eurovision Games. Επίστρεψε στην αρχική ή δες τους δημοφιλείς οδηγούς παρακάτω.',
      keywords: ['eurovision games 404', 'δεν βρέθηκε η σελίδα'],
    },
    crumbs: { home: 'Αρχική', notFound: '404 — Δεν βρέθηκε' },
    hero: {
      chip: '404',
      title: 'Δεν βρέθηκε η σελίδα',
      lede:
        'Η σελίδα που προσπάθησες να ανοίξεις δεν υπάρχει στο Eurovision Games. Πιθανό typo, ίσως ένας παλιός σύνδεσμος — εδώ είναι οι πιο δημοφιλείς προορισμοί.',
    },
    cta: {
      title: 'Επιστροφή στη βραδιά',
      body: 'Στήσε ένα δωμάτιο Eurovision ή πήγαινε στους πιο δημοφιλείς οδηγούς παρακάτω.',
      primary: 'Άνοιξε την αρχική',
      secondary: 'Πώς να παίξεις',
    },
    related: {
      heading: 'Δημοφιλείς προορισμοί',
      night: { title: 'Βραδιά Eurovision', blurb: 'Playbook 10 βημάτων για τη φιλοξενία του watch party.' },
      predictions: { title: 'Προβλέψεις 2026', blurb: 'Φόρμα Top 5 / Worst 5 και η λίστα 35 χωρών.' },
      trivia: { title: 'Eurovision trivia', blurb: '10 δείγματα ερωτήσεων και πώς δουλεύουν οι μονομαχίες.' },
      duels: { title: 'Μονομαχίες', blurb: 'Κανόνες head-to-head trivia κατά τη ζωντανή εκπομπή.' },
      dashboard: { title: 'Dashboard', blurb: 'Πώς ενημερώνεται ο ζωντανός πίνακας βαθμολογίας καθώς παίζεις.' },
      howToPlay: { title: 'Πώς να παίξεις', blurb: 'Οδηγός στησίματος 60 δευτερολέπτων.' },
      scoring: { title: 'Μαθηματικά βαθμολογίας', blurb: 'Ακριβείς πόντοι ανά Top-5, quiz και μονομαχία.' },
      faq: { title: 'FAQ', blurb: 'Απαντήσεις σε συνηθισμένες ερωτήσεις στησίματος και βαθμολογίας.' },
    },
  },
};
