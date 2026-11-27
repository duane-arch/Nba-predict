// Lecture des captures Betclic : transforme le texte reconnu (OCR) en tickets.
// Chaque ticket se termine par une ligne « Réf <identifiant> <jj/mm/aaaa hh:mm> ».
(function (root) {
  const num = (s) => { const v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
  const MKT = /^(ecart|écart|nombre|vainqueur|r[ée]sultat|handicap|total|match|pourquoi|partager|\(?t\)?\s*partager|mycombi|cote\s*totale|compl[ée]ter|my\s*combi|joueurs?|aujourd|hier|demain)/i;
  const clean = (s) => s.replace(/^[^A-Za-zÀ-ÿ0-9+\-]+/, '').replace(/\s+/g, ' ').trim();
  const normRef = (r) => r.toLowerCase().replace(/[li]/g, '1').replace(/o/g, '0');
  function parseBetclic(text) {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [];
    let seg = [];
    for (const l of lines) {
      const m = l.match(/R[ée]f\.?\s*:?\s*([0-9A-Za-z]{8,32})\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?/);
      if (!m) { seg.push(l); continue; }
      const t = parseSeg(seg);
      const iso = `${m[4]}-${m[3]}-${m[2]}`;
      out.push(Object.assign(t, { ref: normRef(m[1]), date: iso, time: m[5] ? `${m[5].padStart(2, '0')}:${m[6]}` : '' }));
      seg = [];
    }
    return out;
  }
  function parseSeg(seg) {
    const joined = seg.join('\n');
    const mi = joined.match(/Mise\s*:?\s*(\d[\d\s]*[,.]\d{1,2})/i);
    const stake = mi ? num(mi[1]) : null;
    const pot = joined.match(/Gains?\s+(?:potentiels?|possibles?)\s*:?\s*(\d[\d\s]*[,.]\d{1,2})/i);
    const ga = joined.match(/Gains?(?!\s+(?:potentiel|possible))\s*:?\s*(\d[\d\s]*[,.]\d{1,2})/i);
    const gains = ga ? num(ga[1]) : null;
    const head = seg.findIndex((l) => /^\W*(simple|combin|syst[eè]me)/i.test(l));
    const headTxt = head >= 0 ? seg[head] : '';
    let status = null;
    if (/en cours/i.test(headTxt) || pot) status = 'open';
    else if (/gagn/i.test(headTxt)) status = 'won';
    else if (/perdu/i.test(headTxt)) status = 'lost';
    else if (/rembours|annul/i.test(headTxt)) status = 'void';
    else if (gains !== null && stake !== null) status = gains > stake + 0.004 ? 'won' : gains === 0 ? 'lost' : 'void';
    else if (/pourquoi mon pari est perdu/i.test(joined)) status = 'lost';
    if (status === 'won' && gains !== null && stake !== null && gains <= stake + 0.004) status = gains === 0 ? 'lost' : 'void';
    let odds = null;
    if (status === 'won' && gains && stake) odds = Math.round(gains / stake * 100) / 100;
    else if (status === 'open' && pot && stake) odds = Math.round(num(pot[1]) / stake * 100) / 100;
    else if (status === 'void') odds = 1;
    const kind = /^\W*combin/i.test(headTxt) ? 'combo' : 'single';
    // sélections : lignes après l'en-tête et avant les scores / la mise
    const sel = [];
    for (let i = head + 1; i < seg.length; i++) {
      const l = seg[i];
      if (/Mise\b/i.test(l) || /^\W*Gains?\b/i.test(l)) break;
      if (/\d{1,2}:\d{2}/.test(l) || /\b\d{2,3}\s+\d{2,3}\s+\d{2,3}/.test(l) || /\s\d{2,3}\s+\d{2,3}\s*$/.test(l)) break;
      if (/cote\s+totale/i.test(l)) break;
      if (MKT.test(clean(l)) || !/[A-Za-zÀ-ÿ]{3}|\bde\s*\d/i.test(l)) continue;
      const c = clean(l).replace(/([+-])\s*de\s*(\d)/i, '$1 de $2').replace(/\bde\s*(\d{3})5\b/i, 'de $1,5');
      if (/[a-zà-ÿ]{3,}|\bde \d/.test(c)) sel.push(c);
    }
    const cm = headTxt.match(/\((\d+)\)/);
    return { kind, status, stake, gains, odds, label: sel.join(' & ') || (kind === 'combo' ? `Combiné de ${cm ? cm[1] : ''} paris`.replace('de  paris', '') : ''), n: sel.length };
  }
  const api = { parseBetclic, normRef };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BetParse = api;
})(typeof self !== 'undefined' ? self : this);
