/**
 * Topics of the FAQ page's accordion questions (labels in i18n faqPage.topics).
 * Zod-free so the public bundle can import it (schemas/faq.ts pulls zod).
 */
export const FAQ_TOPICS = ['start', 'devices', 'during', 'scoring', 'results'] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];
