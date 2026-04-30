require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const natural = require('natural');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── Naive Bayes Classifier Setup ───────────────────────────────────────────
const classifier = new natural.BayesClassifier();

// Train with fake news patterns
const fakePatterns = [
  'shocking truth revealed government hiding secret miracle cure',
  'you wont believe what happened breaking alert urgent share now',
  'doctors hate this one weird trick clickbait exposed fake celebrity',
  'conspiracy theory deep state illuminati alien cover up false flag',
  'miracle breakthrough big pharma doesnt want you to know cure cancer',
  'exclusive insider leaked documents whistleblower bombshell revelation',
  'mainstream media lying hoax staged false narrative propaganda',
  'wake up sheeple truth bombs red pill reality check exposed',
  'celebrity death cover up secret scandal shocking revelation',
  'anonymous source claims bombshell report unverified allegations',
];

const realPatterns = [
  'according to official report government announced new policy today',
  'researchers published peer reviewed study findings journal nature',
  'officials confirmed statement press conference updated figures',
  'experts analyzed data concluded evidence suggests scientific',
  'report published organization findings indicate data shows',
  'university conducted study participants results demonstrated',
  'official spokesperson confirmed statement released details',
  'analysis shows statistics indicate percentage increased declined',
  'verified sources confirmed investigation ongoing authorities',
  'financial results quarterly earnings reported company announced',
];

const suspiciousPatterns = [
  'sources say rumored allegedly unconfirmed developing story',
  'some people believe many claim opinion editorial perspective',
  'could possibly might suggest speculate theory hypothesis',
  'unnamed source insider tip off whisper network claim',
  'breaking unverified social media circulating viral post',
];

fakePatterns.forEach(p => classifier.addDocument(p, 'FAKE'));
realPatterns.forEach(p => classifier.addDocument(p, 'REAL'));
suspiciousPatterns.forEach(p => classifier.addDocument(p, 'SUSPICIOUS'));
classifier.train();

// ─── URL Feature Extraction ──────────────────────────────────────────────────
function extractUrlFeatures(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const domain = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol;
    const fullPath = parsed.pathname;

    const suspiciousTLDs = ['.xyz', '.click', '.info', '.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.buzz', '.work'];
    const suspiciousKeywords = ['clickbait', 'shocking', 'viral', 'exposed', 'truth', 'secret', 'miracle', 'alert', 'breaking', 'urgent', 'weird'];
    const trustedDomains = ['bbc.com', 'reuters.com', 'apnews.com', 'theguardian.com', 'nytimes.com', 'washingtonpost.com', 'bloomberg.com', 'npr.org', 'thehindu.com', 'ndtv.com', 'hindustantimes.com', 'timesofindia.com', 'aljazeera.com'];

    let score = 50; // base score
    const flags = [];

    // HTTPS check
    const isHttps = protocol === 'https:';
    if (isHttps) { score += 15; } else { score -= 20; flags.push('No HTTPS encryption'); }

    // Trusted domain
    const isTrusted = trustedDomains.some(d => domain.endsWith(d));
    if (isTrusted) { score += 30; }

    // Domain length
    if (domain.length > 30) { score -= 10; flags.push('Unusually long domain name'); }

    // Suspicious TLDs
    const hasSuspiciousTLD = suspiciousTLDs.some(tld => domain.endsWith(tld));
    if (hasSuspiciousTLD) { score -= 20; flags.push('Suspicious top-level domain'); }

    // Suspicious keywords in URL
    const urlLower = rawUrl.toLowerCase();
    const foundKeywords = suspiciousKeywords.filter(kw => urlLower.includes(kw));
    if (foundKeywords.length > 0) {
      score -= foundKeywords.length * 8;
      flags.push(`Clickbait keywords in URL: ${foundKeywords.join(', ')}`);
    }

    // IP address instead of domain
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(domain)) { score -= 30; flags.push('IP address used instead of domain'); }

    // URL path depth
    const pathDepth = fullPath.split('/').filter(Boolean).length;
    if (pathDepth > 8) { score -= 5; flags.push('Deeply nested URL path'); }

    // Mock domain age (deterministic hash from domain)
    let domainHash = 0;
    for (let c of domain) domainHash = (domainHash * 31 + c.charCodeAt(0)) % 1000;
    const mockAge = isTrusted ? Math.floor(Math.random() * 10 + 10) : (domainHash % 8) + 1;
    if (mockAge < 2) { score -= 15; flags.push('Domain registered recently (< 2 years)'); }
    else if (mockAge >= 5) { score += 10; }

    // Blacklist check (mock)
    const blacklistedDomains = ['fakenews.xyz', 'clickbait.top', 'viralhoax.com', 'conspiracy.info'];
    const isBlacklisted = blacklistedDomains.some(d => domain.includes(d));
    if (isBlacklisted) { score -= 40; flags.push('Domain found in blacklist'); }

    score = Math.min(100, Math.max(0, score));

    return {
      domain,
      isHttps,
      isTrusted,
      isBlacklisted,
      domainAge: mockAge,
      urlLength: rawUrl.length,
      pathDepth,
      hasSuspiciousTLD,
      suspiciousKeywords: foundKeywords,
      trustScore: Math.round(score),
      flags,
    };
  } catch (e) {
    return null;
  }
}

// ─── ML Prediction ───────────────────────────────────────────────────────────
function mlPredict(text, urlFeatures) {
  const cleanText = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let mlLabel = 'SUSPICIOUS';
  let mlConfidence = 50;

  if (cleanText.length > 10) {
    try {
      mlLabel = classifier.classify(cleanText);
      // Simulate confidence based on trust score
      const base = urlFeatures ? urlFeatures.trustScore : 50;
      if (mlLabel === 'REAL') mlConfidence = Math.min(95, 55 + base * 0.35);
      else if (mlLabel === 'FAKE') mlConfidence = Math.min(95, 60 + (100 - base) * 0.3);
      else mlConfidence = 45 + Math.random() * 15;
    } catch (e) {
      mlLabel = 'SUSPICIOUS';
      mlConfidence = 50;
    }
  } else {
    // No text - use URL trust score only
    if (urlFeatures) {
      if (urlFeatures.trustScore >= 70) { mlLabel = 'REAL'; mlConfidence = urlFeatures.trustScore; }
      else if (urlFeatures.trustScore <= 35) { mlLabel = 'FAKE'; mlConfidence = 100 - urlFeatures.trustScore; }
      else { mlLabel = 'SUSPICIOUS'; mlConfidence = 55; }
    }
  }

  return { label: mlLabel, confidence: Math.round(mlConfidence) };
}

// ─── Explanation Generator ───────────────────────────────────────────────────
function generateExplanation(urlFeatures, mlResult) {
  const reasons = [];
  if (!urlFeatures.isHttps) reasons.push('the source does not use HTTPS encryption');
  if (urlFeatures.isBlacklisted) reasons.push('the domain appears in known fake news blacklists');
  if (urlFeatures.hasSuspiciousTLD) reasons.push('the domain uses a suspicious top-level domain');
  if (urlFeatures.suspiciousKeywords.length > 0) reasons.push(`the URL contains clickbait keywords (${urlFeatures.suspiciousKeywords.join(', ')})`);
  if (urlFeatures.domainAge < 2) reasons.push('the domain was registered recently');
  if (urlFeatures.trustScore >= 75) reasons.push('the source domain has a high trust score');
  if (urlFeatures.isTrusted) reasons.push('the domain is a recognized reputable news outlet');

  if (mlResult.label === 'FAKE') {
    return `This article has been flagged as potentially FAKE because ${reasons.length ? reasons.join(', and ') : 'the content matches known misinformation patterns'}. The AI model detected characteristics commonly associated with unreliable sources.`;
  } else if (mlResult.label === 'REAL') {
    return `This article appears to be REAL. ${reasons.length ? `Positive signals include: ${reasons.join(', ')}. ` : ''}The source demonstrates credibility markers consistent with legitimate journalism.`;
  } else {
    return `This article is SUSPICIOUS and warrants further verification. ${reasons.length ? `Concerning factors include: ${reasons.join(', ')}. ` : ''}We recommend cross-checking with trusted news outlets before sharing.`;
  }
}

// ─── Mocked Related Articles ─────────────────────────────────────────────────
function getMockedArticles(query) {
  const articles = [
    { title: 'Scientists challenge claims about recent viral health article', source: 'Reuters', url: 'https://reuters.com', similarity: 78, status: 'CONTRADICTS' },
    { title: 'Fact-checkers evaluate widespread social media health claims', source: 'AP News', url: 'https://apnews.com', similarity: 65, status: 'PARTIALLY_CONFIRMS' },
    { title: 'Experts weigh in on circulating reports about the topic', source: 'BBC', url: 'https://bbc.com', similarity: 55, status: 'CONTRADICTS' },
    { title: 'Official statement released addressing misinformation spread', source: 'NPR', url: 'https://npr.org', similarity: 82, status: 'CONTRADICTS' },
    { title: 'Analysis: How this story spread and what the evidence shows', source: 'The Guardian', url: 'https://theguardian.com', similarity: 70, status: 'PARTIALLY_CONFIRMS' },
  ];
  return articles.slice(0, 4);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/analyze
app.post('/api/analyze', async (req, res) => {
  const { url: rawUrl, text } = req.body;

  if (!rawUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format. Please enter a valid news article URL.' });
  }

  // Extract URL features
  const urlFeatures = extractUrlFeatures(rawUrl);
  if (!urlFeatures) {
    return res.status(400).json({ error: 'Could not analyze this URL.' });
  }

  // Use text or fallback to domain for classification
  const inputText = text || `${urlFeatures.domain} ${urlFeatures.suspiciousKeywords.join(' ')}`;
  const mlResult = mlPredict(inputText, urlFeatures);

  // Final combined score
  const finalScore = Math.round(urlFeatures.trustScore * 0.45 + mlResult.confidence * 0.55);
  let finalLabel = mlResult.label;
  if (finalScore >= 68) finalLabel = 'REAL';
  else if (finalScore <= 38) finalLabel = 'FAKE';
  else finalLabel = 'SUSPICIOUS';

  const explanation = generateExplanation(urlFeatures, { ...mlResult, label: finalLabel });

  // Credibility breakdown for chart
  const credibilityBreakdown = {
    domainTrust: urlFeatures.trustScore,
    httpsScore: urlFeatures.isHttps ? 100 : 0,
    contentScore: mlResult.confidence,
    domainAge: Math.min(100, urlFeatures.domainAge * 10),
    urlClean: Math.max(0, 100 - urlFeatures.suspiciousKeywords.length * 20),
  };

  return res.json({
    url: rawUrl,
    urlFeatures,
    mlResult: { ...mlResult, label: finalLabel },
    finalScore,
    finalLabel,
    explanation,
    credibilityBreakdown,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/news?q=query
app.get('/api/news', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (NEWS_API_KEY && NEWS_API_KEY !== 'YOUR_KEY_HERE') {
    try {
      const response = await axios.get(`https://newsapi.org/v2/everything`, {
        params: { q, language: 'en', pageSize: 5, sortBy: 'relevancy', apiKey: NEWS_API_KEY },
        timeout: 6000,
      });
      const articles = (response.data.articles || []).map((a, i) => ({
        title: a.title,
        source: a.source?.name || 'Unknown',
        url: a.url,
        similarity: Math.floor(Math.random() * 40 + 50),
        status: i % 3 === 0 ? 'CONTRADICTS' : i % 3 === 1 ? 'PARTIALLY_CONFIRMS' : 'CONFIRMS',
      }));
      return res.json({ articles });
    } catch (e) {
      // fall through to mock
    }
  }

  return res.json({ articles: getMockedArticles(q), mocked: true });
});

// GET /api/factcheck?q=query
app.get('/api/factcheck', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  const FACT_CHECK_KEY = process.env.FACT_CHECK_API_KEY;
  if (FACT_CHECK_KEY && FACT_CHECK_KEY !== 'YOUR_KEY_HERE') {
    try {
      const response = await axios.get(`https://factchecktools.googleapis.com/v1alpha1/claims:search`, {
        params: { query: q, key: FACT_CHECK_KEY },
        timeout: 6000,
      });
      return res.json({ claims: response.data.claims || [] });
    } catch (e) {}
  }

  // Mocked fact checks
  return res.json({
    claims: [
      { text: 'Viral claim about the topic has been debunked by multiple fact-checkers', rating: 'False', publisher: 'PolitiFact' },
      { text: 'Related claim partially supported by evidence but context is missing', rating: 'Misleading', publisher: 'Snopes' },
    ],
    mocked: true,
  });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'TruthLens API' }));

app.listen(PORT, () => {
  console.log(`\n🔍 TruthLens API running on http://localhost:${PORT}`);
  console.log(`📡 Endpoints: POST /api/analyze | GET /api/news | GET /api/factcheck\n`);
});
