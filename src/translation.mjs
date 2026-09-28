// Only explicitly selected article/AI copy enters this service; never scan user records.
const CACHE = new Map();
const LIMIT = 8000;

export async function translateTexts(texts, locale, signal, fetcher = fetch) {
  if (!['en', 'ms', 'zh-Hans'].includes(locale)) throw new Error('Translation is unavailable. Please try again.');
  const parts = texts.map((text) => {
    const chunks = [];
    while (text.length > 3000) {
      const space = text.lastIndexOf(' ', 3000);
      const end = space > 1500 ? space + 1 : 3000;
      chunks.push(text.slice(0, end)); text = text.slice(end);
    }
    chunks.push(text); return chunks;
  });
  const output = new Map();
  const missing = [...new Set(parts.flat().map((text) => text.trim()).filter((text) => /\p{L}/u.test(text)))];
  let batch = [], size = 0;
  const flush = async () => {
    if (!batch.length) return;
    signal?.throwIfAborted();
    const response = await fetcher('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch, locale }), signal, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || payload.locale !== locale || !Array.isArray(payload.texts) || payload.texts.length !== batch.length
      || payload.texts.some((text) => typeof text !== 'string' || !text.trim() || text.length > 24000)) throw new Error('Translation is unavailable. Please try again.');
    batch.forEach((text, index) => { output.set(text, payload.texts[index]); CACHE.set(`${locale}\0${text}`, payload.texts[index]); });
    while (CACHE.size > 256) CACHE.delete(CACHE.keys().next().value);
    batch = []; size = 0;
  };
  for (const text of missing) {
    const cached = CACHE.get(`${locale}\0${text}`);
    if (cached !== undefined) { output.set(text, cached); continue; }
    if (size + text.length > LIMIT || batch.length === 40) await flush();
    batch.push(text); size += text.length;
  }
  await flush();
  return parts.map((chunks) => chunks.map((text) => {
    const trimmed = text.trim();
    return output.has(trimmed) ? text.slice(0, text.indexOf(trimmed)) + output.get(trimmed) + text.slice(text.indexOf(trimmed) + trimmed.length) : text;
  }).join(''));
}

export async function translateAnalysis(result, locale, signal, translate = translateTexts) {
  const copy = structuredClone(result), slots = [];
  const add = (object, key) => { if (typeof object[key] === 'string') slots.push([object, key]); };
  add(copy, 'title'); add(copy, 'summary');
  for (const key of ['observations', 'possibleCauses', 'confirmationChecks', 'nextSteps']) copy[key]?.forEach((_, index) => add(copy[key], index));
  for (const image of copy.referenceImages ?? []) add(image, 'title');
  const segments = [];
  if (copy.research) {
    let cursor = 0;
    for (const citation of copy.research.citations) {
      segments.push({ text: copy.research.text.slice(cursor, citation.start), marker: copy.research.text.slice(citation.start, citation.end), citation });
      add(segments.at(-1), 'text'); add(citation, 'title'); cursor = citation.end;
    }
    segments.push({ text: copy.research.text.slice(cursor), marker: '' }); add(segments.at(-1), 'text');
  }
  const translated = await translate(slots.map(([object, key]) => object[key]), locale, signal);
  slots.forEach(([object, key], index) => { object[key] = translated[index]; });
  if (copy.research) {
    copy.research.text = '';
    for (const segment of segments) {
      copy.research.text += segment.text;
      if (segment.citation) { segment.citation.start = copy.research.text.length; segment.citation.end = segment.citation.start + segment.marker.length; }
      copy.research.text += segment.marker;
    }
  }
  return copy;
}
