export interface TopicConfig {
  label: string;
  // Perigon-specific hints
  perigon?: {
    companyName?: string;
    category?: string;
    topic?: string;
  };
  // NewsData category
  newsdataCategory?: string;
  // Brave freshness hint
  braveFreshness?: 'pd' | 'pw' | 'pm';
}

export const TOPICS: TopicConfig[] = [
  {
    label: 'artificial intelligence',
    perigon: { category: 'Tech', topic: 'AI' },
    newsdataCategory: 'technology',
    braveFreshness: 'pw',
  },
  {
    label: 'Morgan Stanley wealth management',
    perigon: { companyName: 'Morgan Stanley' },
    newsdataCategory: 'business',
    braveFreshness: 'pw',
  },
  {
    label: 'Politics',
    perigon: { category: 'Politics' },
    newsdataCategory: 'politics',
    braveFreshness: 'pw',
  },
  {
    label: 'AI & Tech',
    perigon: { category: 'Tech', topic: 'AI' },
    newsdataCategory: 'technology',
    braveFreshness: 'pw',
  },
];
