// Run: node scripts/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db/schema');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const existingUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (existingUsers > 0) {
  console.log('✅ Database already seeded — skipping.');
  process.exit(0);
}

console.log('🌱 Seeding NEXUS database...\n');

// ─── Users ────────────────────────────────────────────────────
const users = [
  { id: uuidv4(), username: 'admin', email: 'admin@nexus.com', password: 'admin123', role: 'admin' },
  { id: uuidv4(), username: 'editor_sarah', email: 'sarah@nexus.com', password: 'editor123', role: 'editor' },
  { id: uuidv4(), username: 'john_doe', email: 'john@example.com', password: 'password123', role: 'reader' },
  { id: uuidv4(), username: 'priya_patel', email: 'priya@example.com', password: 'password123', role: 'reader' },
  { id: uuidv4(), username: 'kwame_asante', email: 'kwame@example.com', password: 'password123', role: 'reader' },
];

const insertUser = db.prepare('INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
users.forEach(u => {
  insertUser.run(u.id, u.username, u.email, bcrypt.hashSync(u.password, 10), u.role);
  console.log(`✅ User: ${u.username} (${u.role}) — password: ${u.password}`);
});

// ─── Articles ─────────────────────────────────────────────────
// Unsplash images by category (free, no API key needed via source.unsplash.com)
const IMAGES = {
  World:       'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&q=80',
  Technology:  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
  Health:      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
  Business:    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
  Science:     'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80',
  Politics:    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
  Environment: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
  Culture:     'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=800&q=80',
  Sport:       'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
};

const articleData = [
  {
    category: 'World', source: 'Reuters', is_breaking: 1, is_featured: 1, view_count: 4820,
    image_url: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&q=80',
    video_url: null,
    title: 'G20 Leaders Reach Historic Climate Finance Agreement',
    summary: 'Leaders from the world\'s largest economies have agreed to a landmark $500 billion annual fund to help developing nations transition to clean energy.',
    body: `In a surprise breakthrough at this year's G20 summit in New Delhi, heads of state signed the "Global Green Transition Accord," pledging $500 billion annually for developing nations' clean energy infrastructure.\n\nThe deal, brokered over three days of intense negotiations, represents the largest climate finance commitment in history. It includes binding emissions targets and a new international monitoring body. "This is the moment we chose our future," said the UN Secretary-General.`,
    tags: ['climate', 'G20', 'finance', 'environment']
  },
  {
    category: 'Technology', source: 'AP', is_breaking: 0, is_featured: 1, view_count: 3211,
    image_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80',
    video_url: null,
    title: 'OpenAI Rival Announces Breakthrough in Reasoning AI',
    summary: 'A new AI model has demonstrated human-level performance across complex mathematical and scientific reasoning benchmarks.',
    body: `Researchers unveiled a new architecture that shows remarkable improvements in multi-step logical reasoning, outperforming existing models on 47 of 50 benchmark tasks.\n\nThe model, trained on a novel "chain-of-thought distillation" technique, can solve graduate-level physics problems and write formally verified code. Experts say the leap could accelerate drug discovery and materials science research.`,
    tags: ['AI', 'technology', 'research']
  },
  {
    category: 'Health', source: 'Guardian', is_breaking: 1, is_featured: 0, view_count: 2890,
    image_url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
    video_url: null,
    title: 'WHO Declares New Respiratory Virus a Global Health Emergency',
    summary: 'The World Health Organization has raised its alert level for a fast-spreading respiratory pathogen identified in six countries across three continents.',
    body: `The WHO convened an emergency committee after the novel virus, provisionally named HRV-4, was identified in Brazil, South Africa, Indonesia, Germany, Egypt, and Canada within 72 hours.\n\nEarly data suggests the virus spreads more efficiently than influenza but causes milder symptoms in most adults. Governments are urged to activate surveillance protocols while vaccine developers have already begun candidate antigen testing.`,
    tags: ['WHO', 'health', 'virus', 'emergency']
  },
  {
    category: 'Business', source: 'Reuters', is_breaking: 0, is_featured: 0, view_count: 1740,
    image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
    video_url: null,
    title: 'Federal Reserve Signals Three Rate Cuts in 2025 as Inflation Cools',
    summary: 'Fed Chair\'s remarks at Jackson Hole suggest a pivot to easing is imminent, sending equity markets to record highs.',
    body: `In his most dovish speech in three years, the Fed Chair told central bankers that "the job on inflation is largely done" and confirmed the committee is now focused on supporting employment.\n\nMarkets reacted sharply, with the S&P 500 jumping 2.1% and the dollar falling against major currencies. Economists expect the first cut as early as next month, which would be the beginning of the longest easing cycle since 2009.`,
    tags: ['fed', 'rates', 'economy', 'markets']
  },
  {
    category: 'Science', source: 'AP', is_breaking: 0, is_featured: 0, view_count: 2100,
    image_url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80',
    video_url: null,
    title: 'NASA Confirms Evidence of Ancient Liquid Water on Mars',
    summary: 'New data from the Perseverance rover reveals mineral deposits that could only form in sustained liquid water environments billions of years ago.',
    body: `Scientists analyzing rock core samples from Jezero Crater have identified serpentinite — a mineral that forms only through sustained water-rock interactions — at depths suggesting a warm, wet Martian past lasting millions of years.\n\n"We're not talking about a flash flood. We're talking about a stable hydrological system," lead geologist Dr. Amara Singh told reporters. The finding dramatically improves the odds of ancient microbial life.`,
    tags: ['NASA', 'Mars', 'space', 'science']
  },
  {
    category: 'Politics', source: 'BBC', is_breaking: 0, is_featured: 0, view_count: 1980,
    image_url: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
    video_url: null,
    title: 'EU Parliament Passes Landmark Digital Identity Law',
    summary: 'All 27 member states will be required to offer citizens a universal digital ID wallet by 2027 under sweeping new legislation.',
    body: `The European Parliament voted 412 to 89 to approve the eIDAS 2.0 regulation, mandating that each EU member state provide citizens with a free digital identity wallet compatible with all government and commercial services across the bloc.\n\nPrivacy advocates welcomed provisions preventing governments from tracking wallet usage, while business groups praised the potential to reduce onboarding friction. Estonia, which pioneered digital governance, will lead a technical implementation taskforce.`,
    tags: ['EU', 'digital', 'identity', 'legislation']
  },
  {
    category: 'Environment', source: 'Guardian', is_breaking: 0, is_featured: 0, view_count: 1340,
    image_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
    video_url: null,
    title: 'Amazon Rainforest Records Lowest Deforestation Rate in 15 Years',
    summary: 'Brazil\'s space agency reports an 87% drop in forest clearing activity, crediting new satellite enforcement and indigenous land protections.',
    body: `INPE data shows that only 2,300 square kilometers of Amazon forest were cleared in the past 12 months — the lowest figure since satellite monitoring began at scale.\n\nEnvironmental economists credit a combination of real-time satellite alerts that trigger automatic fines, expanded indigenous territory recognition, and strong commodity market incentives for sustainable practices. Critics note that secondary forest degradation not captured in the headline figures remains a significant concern.`,
    tags: ['Amazon', 'environment', 'deforestation', 'Brazil']
  },
  {
    category: 'Culture', source: 'AP', is_breaking: 0, is_featured: 0, view_count: 890,
    image_url: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=800&q=80',
    video_url: null,
    title: 'Nollywood Surpasses Hollywood in Global Streaming Hours for First Time',
    summary: 'Nigerian cinema has outpaced US productions in total global streaming consumption according to a major platform\'s annual report.',
    body: `A landmark streaming analytics report shows Nigerian films and series accumulated more global viewing hours than Hollywood productions for the first time in recorded history, driven by explosive growth across Africa, diaspora audiences, and surprising uptake in Southeast Asia.\n\n"The stories resonate because they're universal — family, ambition, love, survival — but told in a fresh voice," said industry analyst Temi Adekunle. Major studios are now racing to co-produce with Lagos-based production houses.`,
    tags: ['Nollywood', 'Nigeria', 'culture', 'streaming', 'film']
  }
];

const insertArticle = db.prepare(`
  INSERT INTO articles (id, title, category, summary, body, source, author_id, is_breaking, is_featured, view_count, read_time, tags, image_url, video_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const articleIds = [];
articleData.forEach(a => {
  const id = uuidv4();
  articleIds.push(id);
  const readTime = `${Math.ceil(a.body.split(' ').length / 200)} min read`;
  insertArticle.run(id, a.title, a.category, a.summary, a.body, a.source, users[1].id, a.is_breaking, a.is_featured, a.view_count, readTime, JSON.stringify(a.tags), a.image_url || null, a.video_url || null);
  console.log(`📰 Article: ${a.title.substring(0, 50)}...`);
});

// ─── Comments ─────────────────────────────────────────────────
const commentData = [
  { articleIdx: 0, userIdx: 2, body: 'This is a historic moment. Finally some real action on climate finance!' },
  { articleIdx: 0, userIdx: 3, body: 'Skeptical until I see the money actually flow. We\'ve heard big pledges before.' },
  { articleIdx: 0, userIdx: 4, body: 'As someone from a developing country, this would genuinely transform our energy sector.' },
  { articleIdx: 1, userIdx: 2, body: 'The benchmark results are impressive. Curious how it handles adversarial inputs.' },
  { articleIdx: 2, userIdx: 3, body: 'Hope the response is more coordinated than last time. We need global protocols.' },
  { articleIdx: 4, userIdx: 4, body: 'The serpentinite finding is huge. That mineral doesn\'t form without sustained water.' },
];

const insertComment = db.prepare('INSERT INTO comments (id, article_id, user_id, body) VALUES (?, ?, ?, ?)');
commentData.forEach(c => {
  insertComment.run(uuidv4(), articleIds[c.articleIdx], users[c.userIdx].id, c.body);
});
console.log(`\n💬 ${commentData.length} comments seeded`);

// ─── Bookmarks ────────────────────────────────────────────────
[[2, 0], [2, 1], [3, 0], [3, 4], [4, 2], [4, 7]].forEach(([uIdx, aIdx]) => {
  const a = articleData[aIdx];
  db.prepare('INSERT OR IGNORE INTO bookmarks (id, user_id, article_id, article_title, article_category, article_summary, article_source) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), users[uIdx].id, articleIds[aIdx], a.title, a.category, a.summary, a.source);
});
console.log('🔖 Bookmarks seeded');

// ─── Subscribers ──────────────────────────────────────────────
['reader@example.com', 'global@nexus.io', 'news@test.com'].forEach(email => {
  db.prepare('INSERT INTO subscribers (id, email) VALUES (?, ?)').run(uuidv4(), email);
});
console.log('📬 Newsletter subscribers seeded');

console.log(`
✅ Seed complete!

Test credentials:
  Admin  → admin@nexus.com       / admin123
  Editor → sarah@nexus.com       / editor123
  Reader → john@example.com      / password123
`);
