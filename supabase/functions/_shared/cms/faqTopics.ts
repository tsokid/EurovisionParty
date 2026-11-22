/**
 * Topics of the FAQ page's accordion questions (labels in i18n faqPage.topics).
 * Zod-free so the public bundle can import it (schemas/faq.ts pulls zod).
 */
export const FAQ_TOPICS = ['start', 'devices', 'during', 'scoring', 'results'] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

/**
 * Ids of the FAQ's anchored questions (/faq#create...), in sorted order. They
 * are URL fragments: header and footer links may target them, so they never
 * change once published.
 */
export const FAQ_ANCHOR_IDS = ['create', 'join', 'leave'] as const;
export type FaqAnchorId = (typeof FAQ_ANCHOR_IDS)[number];
