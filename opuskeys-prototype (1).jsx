import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Home, BookOpen, Library as LibraryIcon, ScanLine, MessageCircle, User, Play, Square, Lock, Check, X,
  ChevronLeft, ChevronRight, Sparkles, Moon, Sun, Mic, MicOff, Flame, Upload, Music, Crown, Share2,
  RefreshCw, Send, Target, Wand2, Plus, Shuffle, GraduationCap, TrendingUp, Headphones, Layers,
} from "lucide-react";

/* ───────────────────────── THEME ───────────────────────── */
const THEMES = {
  light: { bg: "#F9F6F0", surface: "#FFFFFF", sage: "#E2E9E1", text: "#3D2E24", muted: "#7B6B5F", accent: "#5C4033", ui: "#8A9A86", line: "#E6DFD2", good: "#4F6B4A", bad: "#A4523F", onAccent: "#F9F6F0", keyWhite: "#FFFDF8", keyBlack: "#3D2E24" },
  dark: { bg: "#121413", surface: "#1C2420", sage: "#25302A", text: "#F2ECE4", muted: "#A39A8E", accent: "#C4A482", ui: "#5F705B", line: "#2C3832", good: "#8FB08A", bad: "#D08770", onAccent: "#121413", keyWhite: "#EDE6DA", keyBlack: "#0E100F" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.ok-root{font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--text);background:var(--sage);min-height:100vh}
.ok-root *{box-sizing:border-box}
.ok-display{font-family:'Fraunces',Georgia,serif;font-optical-sizing:auto}
.ok-root button{font-family:inherit;cursor:pointer;color:inherit}
.ok-root button:focus-visible,.ok-root input:focus-visible,.ok-root textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ok-root input,.ok-root textarea{font-family:inherit;color:var(--text)}
@keyframes ok-scan{0%{top:6%}100%{top:88%}}
@keyframes ok-pulse{0%,100%{box-shadow:0 0 0 0 rgba(138,154,134,.7)}50%{box-shadow:0 0 0 6px rgba(138,154,134,0)}}
@keyframes ok-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes ok-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ok-root *{animation:none!important;transition:none!important}}
`;

/* ───────────────────────── MUSIC UTILS ───────────────────────── */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PC_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const parseNote = (s) => {
  const m = s.match(/^([A-G])(#|b)?(\d)$/);
  const l = m[1], acc = m[2] || "", o = +m[3];
  return { l, acc, o, n: o * 7 + LETTERS.indexOf(l), midi: 12 * (o + 1) + SEMI[l] + (acc === "#" ? 1 : acc === "b" ? -1 : 0) };
};
const midiToName = (m) => PC_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

let _ctx = null;
const getCtx = () => {
  if (!_ctx) { const AC = window.AudioContext || window.webkitAudioContext; _ctx = new AC(); }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
};
function tone(midi, { dur = 0.9, vol = 0.22, delay = 0 } = {}) {
  try {
    const c = getCtx(); const t = c.currentTime + delay;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.002), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(c.destination);
    [[1, "triangle", 1], [2, "sine", 0.35], [3, "sine", 0.12]].forEach(([mul, type, a]) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq(midi) * mul;
      const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    });
  } catch (e) { /* audio unavailable */ }
}

// YIN-lite pitch detection for the microphone listener
function detectPitch(buf, sr) {
  let rms = 0; for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < 0.012) return -1;
  const N = buf.length >> 1;
  const maxLag = Math.min(N, Math.floor(sr / 70)), minLag = Math.floor(sr / 1100);
  const cm = new Float32Array(maxLag + 1); cm[0] = 1; let run = 0;
  for (let t = 1; t <= maxLag; t++) {
    let s = 0; for (let i = 0; i < N; i++) { const x = buf[i] - buf[i + t]; s += x * x; }
    run += s; cm[t] = (s * t) / (run || 1);
  }
  for (let t = minLag; t < maxLag; t++) {
    if (cm[t] < 0.12) { while (t + 1 < maxLag && cm[t + 1] < cm[t]) t++; return sr / t; }
  }
  return -1;
}

const CHORD_IV = { "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6], aug: [0, 4, 8] };
function chordMidis(name) {
  const m = String(name).split("/")[0].match(/^([A-G])(#|b)?(maj7|m7|m|dim|aug|7)?/);
  if (!m) return [];
  const root = 48 + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12;
  return (CHORD_IV[m[3] || ""] || CHORD_IV[""]).map((i) => root + i);
}

function useSeq() {
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timers = useRef([]);
  const stop = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; setPlaying(false); setActive(-1); }, []);
  const play = useCallback((items, bpm, { loop = false, offset = 0 } = {}) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setPlaying(true);
    const beat = 60000 / bpm; let t = 0;
    items.forEach((it, i) => {
      timers.current.push(setTimeout(() => {
        setActive(i + offset);
        it.m.forEach((m) => tone(m, { dur: Math.max(0.5, (it.d * beat) / 1000 * 1.3), vol: it.m.length > 1 ? 0.14 : 0.22 }));
      }, t));
      t += it.d * beat;
    });
    timers.current.push(setTimeout(() => {
      if (loop) play(items, bpm, { loop, offset }); else { setPlaying(false); setActive(-1); }
    }, t + 60));
  }, []);
  useEffect(() => stop, [stop]);
  return { active, playing, play, stop };
}

/* ───────────────────────── AI HELPERS ───────────────────────── */
async function askClaude({ system, messages }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages }),
  });
  const d = await r.json();
  if (!d.content) throw new Error("No content");
  return d.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
}
const parseJSON = (t) => JSON.parse(t.replace(/```json|```/g, "").trim());

/* ───────────────────────── CONTENT ───────────────────────── */
const CLEF = { treble: { bottom: 30, low: 28, high: 37 }, bass: { bottom: 18, low: 16, high: 28 } };
const noteTag = (clef, n) => {
  const off = n - CLEF[clef].bottom;
  if (off < 0 || off > 8) return "ledger-line notes";
  return off % 2 === 0 ? "notes on lines" : "notes in spaces";
};
function genNote(clef, tag) {
  const { low, high } = CLEF[clef];
  let pool = []; for (let n = low; n <= high; n++) pool.push(n);
  const f = tag ? pool.filter((n) => noteTag(clef, n) === tag) : pool;
  const n = pick(f.length ? f : pool);
  const letter = LETTERS[n % 7];
  const options = shuffle([letter, ...shuffle(LETTERS.filter((l) => l !== letter)).slice(0, 3)]);
  const t = noteTag(clef, n);
  const mn = clef === "treble"
    ? "Treble lines: E G B D F. Spaces: F A C E."
    : "Bass lines: G B D F A. Spaces: A C E G.";
  return { prompt: `Name this note in the ${clef} clef.`, staff: { clef, notes: [{ n }] }, options, answer: options.indexOf(letter), tag: t,
    explain: t === "ledger-line notes" ? `It is ${letter}. Count up or down from the nearest staff line. ${mn}` : `It is ${letter}. ${mn}` };
}
const BEATS = { 0.5: "½", 1: "1", 1.5: "1½", 2: "2", 3: "3", 4: "4" };
const DURS = [
  ["whole note", 4, "note values"], ["half note", 2, "note values"], ["quarter note", 1, "note values"], ["eighth note", 0.5, "note values"],
  ["dotted half note", 3, "dotted notes"], ["dotted quarter note", 1.5, "dotted notes"],
  ["half rest", 2, "rests"], ["quarter rest", 1, "rests"], ["whole rest", 4, "rests"], ["eighth rest", 0.5, "rests"],
];
function genRhythm(tag) {
  const f = tag ? DURS.filter((d) => d[2] === tag) : DURS;
  const [name, v, t] = pick(f.length ? f : DURS);
  const others = shuffle(Object.keys(BEATS).map(Number).filter((x) => x !== v)).slice(0, 3);
  const vals = shuffle([v, ...others]);
  return { prompt: `In 4/4 time, how many beats does a ${name} last?`, options: vals.map((x) => BEATS[x]), answer: vals.indexOf(v), tag: t,
    explain: `A ${name} lasts ${BEATS[v]} beat${v === 1 ? "" : "s"} when the quarter note gets one beat.` };
}
const IV_NAMES = ["unison", "second", "third", "fourth", "fifth", "sixth", "seventh", "octave"];
const ivTag = (k) => (k <= 2 ? "seconds and thirds" : k <= 4 ? "fourths and fifths" : "sixths, sevenths and octaves");
function genInterval(tag) {
  const ks = [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => !tag || ivTag(k) === tag);
  const k = pick(ks.length ? ks : [2]);
  const n1 = 30 + Math.floor(Math.random() * 5);
  const ans = IV_NAMES[k];
  const opts = shuffle([ans, ...shuffle(IV_NAMES.filter((x) => x !== ans)).slice(0, 3)]);
  return { prompt: "What is the interval between these two notes?", staff: { clef: "treble", notes: [{ n: n1, noStem: true, col: 0 }, { n: n1 + k, noStem: true, col: k === 0 ? 0 : 1 }] },
    options: opts, answer: opts.indexOf(ans), tag: ivTag(k), explain: `Count both notes and every letter between them: that is a ${ans}.` };
}
const MODULES = [
  { id: "m1", title: "Treble clef", sub: "Notes on lines, spaces and ledger lines", gen: (t) => genNote("treble", t) },
  { id: "m2", title: "Bass clef", sub: "The left-hand staff, from low G to middle C", gen: (t) => genNote("bass", t) },
  { id: "m3", title: "Rhythm and rests", sub: "Note values, dotted notes, silences", gen: genRhythm },
  { id: "m4", title: "Intervals and the C major scale", sub: "Measure distance between any two notes", gen: genInterval },
];

const DIAG_SECTIONS = ["Foundational solfège", "Applied theory", "Advanced harmony and sight-reading"];
const DIAG = [
  { prompt: "Which note sits on the bottom line of the treble staff?", staff: { clef: "treble", notes: [{ n: 30 }] }, options: ["C", "E", "G", "B"], answer: 1 },
  { prompt: "Name this bass-clef note.", staff: { clef: "bass", notes: [{ n: 26 }] }, options: ["A", "C", "E", "G"], answer: 0 },
  { prompt: "Counting both ends, how many letter names does an octave span (C up to the next C)?", options: ["5", "7", "8", "12"], answer: 2 },
  { prompt: "What interval is this?", staff: { clef: "treble", notes: [{ n: 32, col: 0, noStem: true }, { n: 33, col: 1, noStem: true }] }, options: ["Unison", "Second", "Third", "Fourth"], answer: 1 },
  { prompt: "Which major scale uses only white keys?", options: ["G major", "C major", "D major", "F♯ major"], answer: 1 },
  { prompt: "What does a flat sign (♭) do to a note?", options: ["Raises it a semitone", "Lowers it a semitone", "Cancels the key signature", "Doubles its length"], answer: 1 },
  { prompt: "How many quarter-note beats are in each bar of 3/4 time?", options: ["2", "3", "4", "6"], answer: 1 },
  { prompt: "How long does a dotted half note last in 4/4?", options: ["2 beats", "3 beats", "3½ beats", "4 beats"], answer: 1 },
  { prompt: "Which notes make a C major triad?", options: ["C – E♭ – G", "C – E – G", "C – F – A", "C – E – G♯"], answer: 1 },
  { prompt: "An arpeggio is…", options: ["A chord played one note at a time", "A very fast scale", "A sudden loud accent", "A held note"], answer: 0 },
  { prompt: "C up to A is which interval?", options: ["Minor sixth", "Major sixth", "Minor seventh", "Perfect fifth"], answer: 1 },
  { prompt: "G – B – D – F is a…", options: ["Major seventh chord", "Dominant seventh chord", "Minor seventh chord", "Diminished triad"], answer: 1 },
  { prompt: "Which marking means moderately loud?", options: ["pp", "mp", "mf", "ff"], answer: 2 },
  { prompt: "Which mode is D – E – F – G – A – B – C – D?", options: ["Dorian", "Phrygian", "Mixolydian", "Lydian"], answer: 0 },
  { prompt: "C – E♭ – G♭ is a…", options: ["Minor triad", "Augmented triad", "Diminished triad", "Suspended chord"], answer: 2 },
];
const LEVELS = ["Absolute Beginner", "Novice", "Intermediate", "Advanced"];
const LEVEL_INFO = {
  "Absolute Beginner": "I know nothing about piano or music theory",
  Novice: "I know key names and simple melodies",
  Intermediate: "I can read basic sheet music and play simple pieces",
  Advanced: "I read both clefs fluidly, understand harmony, and play complex pieces",
};
const ALLOWED_TIER = { "Absolute Beginner": 0, Novice: 0, Intermediate: 1, Advanced: 3 };
const TIERS = ["Beginner", "Intermediate", "Advanced", "Concert virtuoso"];
const secScores = (answers) => [0, 1, 2].map((s) => answers.slice(s * 5, s * 5 + 5).filter((a) => a === "ok").length);
function levelFrom(answers) {
  const [b, i, a] = secScores(answers);
  if (a >= 3 && i >= 3) return "Advanced";
  if (i >= 3 && b >= 3) return "Intermediate";
  if (b >= 3) return "Novice";
  return "Absolute Beginner";
}
const autoPassed = (lvl) => (lvl === "Advanced" ? ["m1", "m2", "m3", "m4"] : lvl === "Intermediate" ? ["m1", "m2"] : []);

const TRACKS = {
  A: { name: "Play-Fast", sub: "Repertoire track", blurb: "Sight-reading, rhythm and just enough theory to play sophisticated pop and classical pieces quickly.",
    modules: ["Lead sheets and chord symbols", "Left-hand patterns that sound full", "Sight-reading sprints", "Pop and classical piece pipeline"] },
  B: { name: "Conservatory", sub: "Academic track", blurb: "Full solfège, voice leading, ear training, counterpoint and harmonic analysis for exam and composition goals.",
    modules: ["Voice leading", "Ear training: intervals and chords", "Harmonic analysis", "Counterpoint and polyphony", "Sight-singing"] },
};

const PIECES = [
  { id: "twinkle", title: "Twinkle, Twinkle, Little Star", by: "Traditional", tier: 0, key: "C major", bpm: 100, mood: "Playful", v: [0.62, 0.2, 1, 0.2],
    motif: [["C4", 1], ["C4", 1], ["G4", 1], ["G4", 1], ["A4", 1], ["A4", 1], ["G4", 2], ["F4", 1], ["F4", 1], ["E4", 1], ["E4", 1], ["D4", 1], ["D4", 1], ["C4", 2]],
    chords: ["C", "F", "C", "G", "C"] },
  { id: "ode", title: "Ode to Joy", by: "Beethoven", tier: 0, key: "C major", bpm: 96, mood: "Triumphant", v: [0.6, 0.55, 1, 0.3],
    motif: [["E4", 1], ["E4", 1], ["F4", 1], ["G4", 1], ["G4", 1], ["F4", 1], ["E4", 1], ["D4", 1], ["C4", 1], ["C4", 1], ["D4", 1], ["E4", 1], ["E4", 1.5], ["D4", 0.5], ["D4", 2]],
    fingering: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 }, chords: ["C", "G", "C"] },
  { id: "prelude", title: "Prelude in C, BWV 846", by: "J.S. Bach", tier: 1, key: "C major", bpm: 84, mood: "Flowing", v: [0.52, 0.35, 0.9, 0.6],
    motif: [["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["C5", 0.5], ["E5", 0.5], ["G4", 0.5], ["C5", 0.5], ["E5", 0.5]],
    chords: ["C", "Dm7/C", "G7/B", "C"] },
  { id: "elise", title: "Für Elise (opening)", by: "Beethoven", tier: 1, key: "A minor", bpm: 110, mood: "Wistful", v: [0.65, 0.4, 0.2, 0.5],
    motif: [["E5", 0.5], ["D#5", 0.5], ["E5", 0.5], ["D#5", 0.5], ["E5", 0.5], ["B4", 0.5], ["D5", 0.5], ["C5", 0.5], ["A4", 1.5]],
    chords: ["Am", "E", "Am"] },
  { id: "canon", title: "Canon in D (progression)", by: "Pachelbel", tier: 1, key: "D major", bpm: 66, mood: "Warm", v: [0.4, 0.35, 0.9, 0.4],
    motif: [[["D4", "F#4", "A4"], 2], [["C#4", "E4", "A4"], 2], [["D4", "F#4", "B4"], 2], [["C#4", "F#4", "A4"], 2], [["D4", "G4", "B4"], 2], [["D4", "F#4", "A4"], 2], [["D4", "G4", "B4"], 2], [["C#4", "E4", "A4"], 2]],
    chords: ["D", "A", "Bm", "F#m", "G", "D", "G", "A"] },
  { id: "clair", title: "Clair de Lune", by: "Debussy", tier: 2, key: "D♭ major", bpm: 60, mood: "Dreamy", v: [0.3, 0.15, 0.6, 0.5] },
  { id: "moon3", title: "Moonlight Sonata, 3rd movement", by: "Beethoven", tier: 2, key: "C♯ minor", bpm: 160, mood: "Stormy", v: [0.95, 0.95, 0.15, 0.9] },
  { id: "campanella", title: "La Campanella", by: "Liszt", tier: 3, key: "G♯ minor", bpm: 120, mood: "Sparkling", v: [0.8, 0.9, 0.4, 1] },
];
const FREE_PIECES = ["twinkle", "ode"];
const toItems = (p) => (p.motif || []).map(([nm, d]) => { const arr = Array.isArray(nm) ? nm : [nm]; return { names: arr, m: arr.map((x) => parseNote(x).midi), d }; });
const staffNotes = (items) => {
  const out = [];
  items.forEach((it, col) => it.names.forEach((nm) => { const p = parseNote(nm); out.push({ n: p.n, acc: p.acc, col, hollow: it.d >= 2, noStem: it.names.length > 1 }); }));
  return out;
};
const cosine = (a, b) => { let d = 0, x = 0, y = 0; a.forEach((v, i) => { d += v * b[i]; x += v * v; y += b[i] * b[i]; }); return d / Math.sqrt(x * y); };
function similarPiece(piece, allowed) {
  const c = PIECES.filter((p) => p.id !== piece.id && p.tier <= allowed);
  if (!c.length) return null;
  const scored = c.map((p) => ({ p, s: cosine(piece.v, p.v) })).sort((a, b) => b.s - a.s);
  return scored[0];
}

/* ───────────────────────── PRIMITIVES ───────────────────────── */
const H = ({ children, size = 28, style }) => (
  <h2 className="ok-display" style={{ fontSize: size, fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.01em", margin: 0, ...style }}>{children}</h2>
);
const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 16, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, variant = "primary", style, disabled, icon }) => {
  const v = {
    primary: { background: "var(--accent)", color: "var(--onAccent)", border: "1px solid var(--accent)" },
    secondary: { background: "transparent", color: "var(--text)", border: "1px solid var(--ui)" },
    soft: { background: "var(--sage)", color: "var(--text)", border: "1px solid transparent" },
    ghost: { background: "transparent", color: "var(--muted)", border: "1px solid transparent" },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...v, borderRadius: 999, padding: "13px 20px", fontWeight: 600, fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.45 : 1, ...style }}>
      {icon}{children}
    </button>
  );
};
const Pill = ({ children, tone = "sage", style }) => (
  <span style={{ background: tone === "sage" ? "var(--sage)" : tone === "accent" ? "var(--accent)" : "transparent", color: tone === "accent" ? "var(--onAccent)" : "var(--text)", border: tone === "line" ? "1px solid var(--line)" : "none", borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, ...style }}>{children}</span>
);
const Page = ({ title, onBack, children, right }) => (
  <div style={{ padding: "14px 18px 40px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <button onClick={onBack} aria-label="Back" style={{ background: "var(--surface)", border: "1px solid var(--line)", width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center" }}><ChevronLeft size={20} /></button>
      <div className="ok-display" style={{ fontSize: 17, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      {right}
    </div>
    {children}
  </div>
);
const muted = { color: "var(--muted)" };

/* ───────────────────────── STAFF ───────────────────────── */
function Staff({ clef = "treble", notes = [], active = -1, width = 340 }) {
  const bottom = 75, b = CLEF[clef].bottom, x0 = 58;
  const cols = Math.max(0, ...notes.map((n, i) => n.col ?? i)) + 1;
  const step = Math.min(38, (width - x0 - 14) / cols);
  const yOf = (n) => bottom - (n - b) * 5;
  return (
    <svg viewBox={`0 0 ${width} 120`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`${clef} staff`}>
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={6} x2={width - 6} y1={bottom - i * 10} y2={bottom - i * 10} stroke="var(--text)" strokeWidth="1" opacity=".55" />)}
      {clef === "treble" ? (
        <text x="12" y="78" className="ok-display" fontStyle="italic" fontSize="46" fontWeight="500" fill="var(--text)">G</text>
      ) : (
        <g>
          <text x="12" y="59" className="ok-display" fontStyle="italic" fontSize="42" fontWeight="500" fill="var(--text)">F</text>
          <circle cx="46" cy="40" r="2.6" fill="var(--text)" /><circle cx="46" cy="50" r="2.6" fill="var(--text)" />
        </g>
      )}
      {notes.map((nt, i) => {
        const col = nt.col ?? i, x = x0 + step * col + step / 2, y = yOf(nt.n), off = nt.n - b;
        const ledgers = [];
        if (off < 0) for (let k = -2; k >= off; k -= 2) ledgers.push(yOf(b + k));
        if (off > 8) for (let k = 10; k <= off; k += 2) ledgers.push(yOf(b + k));
        const up = off < 4;
        const isActive = col === active;
        return (
          <g key={i}>
            {isActive && <circle cx={x} cy={y} r="13" fill="var(--ui)" opacity=".45" />}
            {ledgers.map((ly, j) => <line key={j} x1={x - 11} x2={x + 11} y1={ly} y2={ly} stroke="var(--text)" strokeWidth="1.2" />)}
            {nt.acc && <text x={x - 19} y={y + 5} fontSize="16" fill="var(--text)" fontFamily="serif">{nt.acc === "#" ? "♯" : nt.acc === "n" ? "♮" : "♭"}</text>}
            <ellipse cx={x} cy={y} rx="6.5" ry="4.8" transform={`rotate(-20 ${x} ${y})`} fill={nt.hollow ? "var(--surface)" : "var(--text)"} stroke="var(--text)" strokeWidth="1.8" />
            {!nt.noStem && <line x1={up ? x + 6 : x - 6} x2={up ? x + 6 : x - 6} y1={y} y2={up ? y - 28 : y + 28} stroke="var(--text)" strokeWidth="1.5" />}
          </g>
        );
      })}
    </svg>
  );
}

/* ───────────────────────── KEYBOARD ───────────────────────── */
function Keyboard({ from = 60, to = 83, onPress, active = [], hint = [], labels = {}, height = 150 }) {
  const whites = [], blacks = [];
  for (let m = from; m <= to; m++) ([1, 3, 6, 8, 10].includes(m % 12) ? blacks : whites).push(m);
  const w = 100 / whites.length;
  return (
    <div style={{ position: "relative", height, userSelect: "none", touchAction: "manipulation" }}>
      <div style={{ display: "flex", height: "100%", gap: 2 }}>
        {whites.map((m) => {
          const on = active.includes(m), hi = hint.includes(m);
          return (
            <button key={m} aria-label={midiToName(m)} onPointerDown={() => onPress && onPress(m)}
              style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: "0 0 9px 9px", background: on ? "var(--ui)" : "var(--keyWhite)", color: "#3D2E24", padding: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8, fontSize: 11, fontWeight: 700, outline: hi ? "2px solid var(--accent)" : "none", outlineOffset: -2, animation: hi ? "ok-pulse 1.2s infinite" : "none", transition: "background .08s" }}>
              {labels[m] ?? ""}
            </button>
          );
        })}
      </div>
      {blacks.map((m) => {
        const idx = whites.filter((x) => x < m).length, on = active.includes(m), hi = hint.includes(m);
        return (
          <button key={m} aria-label={midiToName(m)} onPointerDown={() => onPress && onPress(m)}
            style={{ position: "absolute", top: 0, left: `${idx * w - w * 0.3}%`, width: `${w * 0.6}%`, height: "62%", background: on ? "var(--ui)" : "var(--keyBlack)", border: hi ? "2px solid var(--ui)" : "1px solid #000", borderRadius: "0 0 7px 7px", padding: 0, transition: "background .08s" }} />
        );
      })}
    </div>
  );
}

/* ───────────────────────── WELCOME / ONBOARDING ───────────────────────── */
const SOL = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"];
const SOL_MAP = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
function Welcome({ onStart, onDemo, onPitch }) {
  const [last, setLast] = useState(null);
  const labels = {};
  for (let m = 60; m <= 83; m++) if (SOL_MAP[m % 12] !== undefined) labels[m] = SOL[SOL_MAP[m % 12]];
  const press = (m) => { tone(m, { dur: 1.4, vol: 0.26 }); setLast(m); };
  return (
    <div style={{ padding: "26px 18px 34px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div className="ok-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent)", display: "grid", placeItems: "center" }}><Music size={15} color="var(--onAccent)" /></span>
        OpusKeys
      </div>
      <div style={{ marginTop: 34 }}>
        <H size={40}>Learn to read the music you want to play.</H>
        <p style={{ ...muted, fontSize: 16, lineHeight: 1.5, margin: "14px 0 0", maxWidth: 340 }}>
          A short placement test, a lesson path that adapts to you, and an AI coach that listens while you play.
        </p>
      </div>
      <div style={{ marginTop: 28 }}>
        <div style={{ height: 44, display: "flex", alignItems: "baseline", gap: 10 }}>
          {last ? (<><span className="ok-display" style={{ fontSize: 34, fontWeight: 600, fontStyle: "italic" }}>{SOL_MAP[last % 12] !== undefined ? SOL[SOL_MAP[last % 12]] : "·"}</span><span style={muted}>{midiToName(last)}</span></>) : (<span style={muted}>Tap the keys to hear solfège names.</span>)}
        </div>
        <Keyboard from={60} to={83} onPress={press} active={last ? [last] : []} labels={labels} height={160} />
      </div>
      <div style={{ marginTop: "auto", paddingTop: 30, display: "grid", gap: 10 }}>
        <Btn onClick={onStart} style={{ width: "100%" }}>Start the 3-minute placement</Btn>
        <Btn variant="secondary" onClick={onDemo} style={{ width: "100%" }}>Explore the demo as an Intermediate player</Btn>
        <Btn variant="ghost" onClick={onPitch} style={{ width: "100%" }}>Investor snapshot</Btn>
      </div>
    </div>
  );
}

function SelfAssess({ onPick }) {
  return (
    <div style={{ padding: "26px 18px 40px" }}>
      <p style={{ ...muted, margin: "0 0 8px", fontSize: 14 }}>Step 1 of 2</p>
      <H size={32}>Where are you today?</H>
      <p style={{ ...muted, margin: "10px 0 22px", lineHeight: 1.5 }}>Pick the closest match. The placement test next will check it.</p>
      <div style={{ display: "grid", gap: 12 }}>
        {LEVELS.map((l, i) => (
          <button key={l} onClick={() => onPick(l)} style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: i % 2 ? 22 : 16, padding: "16px 18px" }}>
            <div className="ok-display" style={{ fontSize: 20, fontWeight: 600 }}>{l}</div>
            <div style={{ ...muted, fontSize: 14, marginTop: 4, lineHeight: 1.4 }}>“{LEVEL_INFO[l]}”</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionBody({ q, picked, reveal, onPick, idk }) {
  return (
    <div>
      {q.staff && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: "6px 8px", marginBottom: 14 }}>
          <Staff {...q.staff} />
        </div>
      )}
      <h3 className="ok-display" style={{ fontSize: 22, lineHeight: 1.22, fontWeight: 500, margin: "0 0 14px" }}>{q.prompt}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {q.options.map((o, k) => {
          let bg = "var(--surface)", bd = "var(--line)", col = "var(--text)";
          if (reveal) { if (k === q.answer) { bg = "var(--sage)"; bd = "var(--good)"; } else if (k === picked) { bg = "transparent"; bd = "var(--bad)"; col = "var(--bad)"; } }
          else if (picked === k) { bg = "var(--sage)"; bd = "var(--accent)"; }
          return (
            <button key={k} onClick={() => onPick(k)} style={{ textAlign: "left", background: bg, border: `1.5px solid ${bd}`, color: col, borderRadius: 14, padding: "14px 16px", fontSize: 16, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {o}{reveal && k === q.answer && <Check size={18} color="var(--good)" />}
            </button>
          );
        })}
        {idk && (
          <button onClick={() => onPick(-1)} style={{ textAlign: "left", background: picked === -1 ? "var(--sage)" : "transparent", border: "1.5px dashed var(--ui)", color: "var(--muted)", borderRadius: 14, padding: "14px 16px", fontSize: 15 }}>
            I don't know
          </button>
        )}
      </div>
    </div>
  );
}

function Diagnostic({ onDone }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState([]);
  const [picked, setPicked] = useState(null);
  const q = DIAG[i], sec = Math.floor(i / 5);
  const pickAns = (k) => {
    if (picked !== null) return;
    setPicked(k);
    const r = k === -1 ? "idk" : k === q.answer ? "ok" : "no";
    setTimeout(() => {
      const na = [...ans, r]; setPicked(null);
      if (i + 1 >= DIAG.length) onDone(na); else { setAns(na); setI(i + 1); }
    }, 380);
  };
  return (
    <div style={{ padding: "22px 18px 40px" }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
        {DIAG.map((_, k) => <div key={k} style={{ flex: 1, height: 5, borderRadius: 3, background: k < i ? "var(--accent)" : k === i ? "var(--ui)" : "var(--line)" }} />)}
      </div>
      <p style={{ ...muted, margin: "0 0 4px", fontSize: 14 }}>Step 2 of 2 · Question {i + 1} of 15</p>
      <p style={{ margin: "0 0 18px", fontWeight: 600, fontSize: 15 }}>{DIAG_SECTIONS[sec]}</p>
      <QuestionBody q={q} picked={picked} onPick={pickAns} idk />
      <p style={{ ...muted, fontSize: 13, marginTop: 16, lineHeight: 1.4 }}>Not sure? Choose “I don't know.” Honest answers give you a better starting point than lucky guesses.</p>
    </div>
  );
}

function Results({ user, onContinue }) {
  const [msg, setMsg] = useState("");
  const [b, i, a] = secScores(user.answers);
  const total = b + i + a;
  const idk = user.answers.filter((x) => x === "idk").length;
  const share = `My Musical Age on OpusKeys is ${user.musicalAge}. Placement: ${user.level} (${total}/15). Find yours at opuskeys.app`;
  const doShare = async () => {
    try { await navigator.clipboard.writeText(share); setMsg("Copied. Paste it into your story."); } catch (e) { setMsg("Copy this: " + share); }
  };
  const mismatch = user.selfLevel && user.selfLevel !== user.level;
  return (
    <div style={{ padding: "26px 18px 40px" }}>
      <p style={{ ...muted, margin: "0 0 8px", fontSize: 14 }}>Your placement</p>
      <Card style={{ padding: 20, borderRadius: 26, background: "var(--accent)", border: "none", color: "var(--onAccent)" }}>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Musical Age</div>
        <div className="ok-display" style={{ fontSize: 84, fontWeight: 600, lineHeight: 1, margin: "4px 0 10px" }}>{user.musicalAge}</div>
        <div className="ok-display" style={{ fontSize: 22, fontWeight: 500 }}>{user.level}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
          {user.answers.map((r, k) => (
            <div key={k} title={`Question ${k + 1}`} style={{ flex: 1, height: 46, borderRadius: "2px 2px 7px 7px", background: r === "ok" ? "#E2E9E1" : "transparent", border: r === "no" ? "2px solid #D9A18F" : r === "idk" ? "2px dashed rgba(249,246,240,.6)" : "2px solid #E2E9E1", opacity: r === "no" ? 0.9 : 1 }} />
          ))}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8, lineHeight: 1.4 }}>Each key is a question: filled is correct, solid outline is a miss, dashed is “I don't know.”</div>
      </Card>
      <Card style={{ marginTop: 14 }}>
        {DIAG_SECTIONS.map((s, k) => (
          <div key={s} style={{ marginBottom: k < 2 ? 12 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}><span>{s}</span><b>{[b, i, a][k]}/5</b></div>
            <div style={{ height: 7, background: "var(--sage)", borderRadius: 4 }}><div style={{ width: `${([b, i, a][k] / 5) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 4 }} /></div>
          </div>
        ))}
      </Card>
      <p style={{ lineHeight: 1.55, margin: "16px 2px" }}>
        {mismatch ? `You described yourself as ${user.selfLevel}; your answers place you at ${user.level}. ` : `Your answers match how you described yourself. `}
        {idk > 0 ? `You said “I don't know” ${idk} time${idk > 1 ? "s" : ""}, which is exactly what we need to build your plan. ` : ""}
        {user.level === "Absolute Beginner" || user.level === "Novice" ? "You start at Solfège Grade 1." : user.level === "Intermediate" ? "Grade 1 treble and bass clef are marked as tested out." : "Grade 1 is tested out and both learning tracks are unlocked."}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <Btn onClick={onContinue}>Build my learning path</Btn>
        <Btn variant="secondary" onClick={doShare} icon={<Share2 size={17} />}>Share my Musical Age</Btn>
        {msg && <p style={{ ...muted, fontSize: 13, margin: 0, textAlign: "center" }}>{msg}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── QUIZ / MASTERY ───────────────────────── */
function QuizRunner({ questions, onFinish, title, sub, sim }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [res, setRes] = useState([]);
  const q = questions[i];
  const choose = (k) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === q.answer;
    tone(ok ? 76 : 52, { dur: 0.5, vol: 0.14 });
  };
  const next = () => {
    const nr = [...res, { ok: picked === q.answer, tag: q.tag }];
    setPicked(null);
    if (i + 1 >= questions.length) onFinish(nr); else { setRes(nr); setI(i + 1); }
  };
  const simulate = (pass) => {
    const remaining = questions.length - i;
    const cur = res.filter((r) => r.ok).length;
    const target = pass ? 13 : 8;
    const need = Math.max(0, Math.min(remaining, target - cur));
    const okSet = new Set(shuffle([...Array(remaining).keys()]).slice(0, need));
    const rest = Array.from({ length: remaining }, (_, k) => ({ ok: okSet.has(k), tag: questions[i + k].tag }));
    onFinish([...res, ...rest]);
  };
  return (
    <div style={{ padding: "18px 18px 40px" }}>
      <div style={{ marginBottom: 14 }}>
        <div className="ok-display" style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
        <div style={{ ...muted, fontSize: 14 }}>{sub} · Question {i + 1} of {questions.length}</div>
      </div>
      <div style={{ display: "flex", gap: 3, marginBottom: 18 }}>
        {questions.map((_, k) => <div key={k} style={{ flex: 1, height: 5, borderRadius: 3, background: k < i ? (res[k]?.ok ? "var(--good)" : "var(--bad)") : k === i ? "var(--ui)" : "var(--line)" }} />)}
      </div>
      <QuestionBody q={q} picked={picked} reveal={picked !== null} onPick={choose} />
      {picked !== null && (
        <div style={{ marginTop: 16, animation: "ok-rise .25s ease-out" }}>
          <p style={{ margin: "0 0 12px", lineHeight: 1.5, color: picked === q.answer ? "var(--good)" : "var(--text)" }}>
            <b>{picked === q.answer ? "Correct. " : "Not quite. "}</b>{q.explain}
          </p>
          <Btn onClick={next} style={{ width: "100%" }}>{i + 1 >= questions.length ? "See my score" : "Next question"}</Btn>
        </div>
      )}
      {sim && (
        <div style={{ marginTop: 28, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
          <p style={{ ...muted, fontSize: 12, margin: "0 0 8px" }}>Demo controls for the pitch</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="soft" onClick={() => simulate(true)} style={{ padding: "8px 14px", fontSize: 13 }}>Simulate a pass</Btn>
            <Btn variant="soft" onClick={() => simulate(false)} style={{ padding: "8px 14px", fontSize: 13 }}>Simulate 8/15</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function MasteryFlow({ mod, onClose, onPass, isLast }) {
  const [phase, setPhase] = useState("test");
  const [results, setResults] = useState([]);
  const [round, setRound] = useState(0);
  const [qs, setQs] = useState(() => Array.from({ length: 15 }, () => mod.gen()));
  const [drillQs, setDrillQs] = useState([]);
  const score = results.filter((r) => r.ok).length;
  const passed = score >= 11;
  const failed = useMemo(() => {
    const m = {}; results.filter((r) => !r.ok).forEach((r) => { m[r.tag] = (m[r.tag] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [results]);
  const finish = (r) => { setResults(r); setPhase("result"); if (r.filter((x) => x.ok).length >= 11) onPass(mod.id); };
  const startDrill = () => { const t = failed[0]?.[0]; setDrillQs(Array.from({ length: 5 }, () => mod.gen(t))); setPhase("drill"); };
  const retake = () => { setQs(Array.from({ length: 15 }, () => mod.gen())); setRound((r) => r + 1); setPhase("test"); };

  if (phase === "test") return <Page title={mod.title} onBack={onClose}><QuizRunner key={round} questions={qs} title="Mastery test" sub="Score 11 of 15 to unlock the next module" onFinish={finish} sim /></Page>;
  if (phase === "drill") return <Page title="Targeted drill" onBack={() => setPhase("result")}><QuizRunner questions={drillQs} title={`Drill: ${failed[0]?.[0]}`} sub="About 5 minutes" onFinish={() => setPhase("drillDone")} /></Page>;
  if (phase === "drillDone") return (
    <Page title="Drill complete" onBack={() => setPhase("result")}>
      <Card style={{ textAlign: "center", padding: 26 }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, background: "var(--sage)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Check size={28} color="var(--good)" /></div>
        <H size={24}>Ready to try the test again</H>
        <p style={{ ...muted, lineHeight: 1.5 }}>You practiced {failed[0]?.[0]}. The new test mixes fresh questions.</p>
        <Btn onClick={retake} style={{ width: "100%", marginTop: 8 }}>Retake mastery test</Btn>
      </Card>
    </Page>
  );
  return (
    <Page title={mod.title} onBack={onClose}>
      <Card style={{ padding: 22, borderRadius: 26, textAlign: "center", background: passed ? "var(--sage)" : "var(--surface)" }}>
        <div className="ok-display" style={{ fontSize: 64, fontWeight: 600, lineHeight: 1 }}>{score}<span style={{ fontSize: 28, ...muted }}>/15</span></div>
        <p style={{ margin: "10px 0 0", fontWeight: 600 }}>{passed ? "Module unlocked" : `${11 - score} more correct answer${11 - score === 1 ? "" : "s"} to unlock the next module`}</p>
      </Card>
      {passed ? (
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <Btn onClick={onClose}>{isLast ? "Choose your learning track" : "Continue to next module"}</Btn>
        </div>
      ) : (
        <>
          <Card style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Sparkles size={17} color="var(--accent)" /><b>Curriculum engine</b></div>
            <p style={{ ...muted, margin: "0 0 10px", fontSize: 14, lineHeight: 1.5 }}>Concepts that cost you points:</p>
            {failed.map(([t, n]) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--line)" }}><span style={{ textTransform: "capitalize" }}>{t}</span><b>{n} missed</b></div>
            ))}
          </Card>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <Btn onClick={startDrill} icon={<Target size={17} />}>Start 5-minute drill on {failed[0]?.[0]}</Btn>
            <Btn variant="secondary" onClick={retake}>Retake the test now</Btn>
          </div>
        </>
      )}
    </Page>
  );
}

/* ───────────────────────── LESSONS (TEACHING CONTENT) ───────────────────────── */
const NM = (s) => parseNote(s).midi;
const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
const letterLabels = (a, b) => { const o = {}; for (let m = a; m <= b; m++) if (!isBlack(m)) o[m] = LETTERS[[0, 2, 4, 5, 7, 9, 11].indexOf(m % 12)]; return o; };
const solLabels = (a, b) => { const o = {}; for (let m = a; m <= b; m++) if (SOL_MAP[m % 12] !== undefined) o[m] = SOL[SOL_MAP[m % 12]]; return o; };
const allWhite = (a, b) => { const r = []; for (let m = a; m <= b; m++) if (!isBlack(m)) r.push(m); return r; };
const sn = (list) => list.map((x, i) => { const [name, acc] = Array.isArray(x) ? x : [x]; const p = parseNote(name); return { n: p.n, acc: acc ?? p.acc, col: i, noStem: true }; });
const chordSn = (list) => sn(list).map((n) => ({ ...n, col: 0 }));
const SCALE_C = allWhite(60, 72);

const LESSONS = {
  m1: {
    title: "Reading the treble clef", mins: 6,
    steps: [
      { title: "Five lines, four spaces", body: "Music is written on a staff: five lines with four spaces between them. A note sits on a line or in a space. The higher a note sits on the staff, the higher it sounds.\n\nPress Hear it to listen to notes climbing the lines.", staff: { clef: "treble", notes: sn(["E4", "G4", "B4", "D5", "F5"]) }, hear: ["E4", "G4", "B4", "D5", "F5"].map(NM) },
      { title: "The treble clef is a G", body: "The curl at the start of the staff is a decorated letter G. It circles the second line from the bottom and tells you: this line is G.\n\nTreble clef is usually played by your right hand, for the higher half of the piano.", staff: { clef: "treble", notes: sn(["G4"]) }, keys: { from: 60, to: 83, hint: [NM("G4")], labels: "letters" } },
      { title: "Try it: find G", body: "Find the group of three black keys. G sits between its first and second black keys. Press G.", staff: { clef: "treble", notes: sn(["G4"]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("G4")] } },
      { title: "Lines: Every Good Boy Does Fine", body: "From bottom to top, the five lines are E, G, B, D, F. A phrase helps you remember: Every Good Boy Does Fine.", staff: { clef: "treble", notes: sn(["E4", "G4", "B4", "D5", "F5"]) }, keys: { from: 60, to: 83, hint: ["E4", "G4", "B4", "D5", "F5"].map(NM), labels: "letters" } },
      { title: "Spaces spell FACE", body: "From bottom to top, the four spaces are F, A, C, E. They spell the word FACE.", staff: { clef: "treble", notes: sn(["F4", "A4", "C5", "E5"]) }, keys: { from: 60, to: 83, hint: ["F4", "A4", "C5", "E5"].map(NM), labels: "letters" } },
      { title: "Middle C hangs below the staff", body: "When a note goes past the staff, we add a short extra line called a ledger line. Middle C sits on one ledger line below the treble staff. It is the bridge between your two hands.", staff: { clef: "treble", notes: sn(["C4"]) }, keys: { from: 60, to: 83, hint: [NM("C4")], labels: "letters" }, hear: [NM("C4")] },
      { title: "Try it: read a note", body: "This note sits in a space. Use FACE to name it, then press it on the keyboard.", staff: { clef: "treble", notes: sn(["A4"]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("A4")] } },
    ],
    recap: ["Treble clef is a G: the curl circles the G line, and it's usually your right hand.", "Lines are E G B D F. Spaces are F A C E.", "Ledger lines extend the staff. Middle C sits on the first one below."],
  },
  m2: {
    title: "Reading the bass clef", mins: 5,
    steps: [
      { title: "The bass clef is an F", body: "The bass clef began as a curly letter F. Its two dots sit above and below the fourth line, which tells you: this line is F.\n\nBass clef is usually played by your left hand, for the lower half of the piano.", staff: { clef: "bass", notes: sn(["F3"]) }, keys: { from: 36, to: 59, hint: [NM("F3")], labels: "letters" } },
      { title: "Lines: Good Boys Do Fine Always", body: "From bottom to top, the bass lines are G, B, D, F, A. A phrase to remember them: Good Boys Do Fine Always.", staff: { clef: "bass", notes: sn(["G2", "B2", "D3", "F3", "A3"]) }, keys: { from: 36, to: 59, hint: ["G2", "B2", "D3", "F3", "A3"].map(NM), labels: "letters" } },
      { title: "Spaces: All Cows Eat Grass", body: "From bottom to top, the bass spaces are A, C, E, G. A phrase: All Cows Eat Grass.", staff: { clef: "bass", notes: sn(["A2", "C3", "E3", "G3"]) }, keys: { from: 36, to: 59, hint: ["A2", "C3", "E3", "G3"].map(NM), labels: "letters" } },
      { title: "Middle C from above", body: "Middle C sits on one ledger line above the bass staff. It is the same key as the one below the treble staff: two clefs, one key. That is why the two staves join up like a ladder.", staff: { clef: "bass", notes: sn(["C4"]) }, keys: { from: 48, to: 71, hint: [NM("C4")], labels: "letters" }, hear: [NM("C4")] },
      { title: "Try it: read a bass note", body: "This note sits in a space. Use All Cows Eat Grass to name it, then press it. The keyboard shows the low octaves.", staff: { clef: "bass", notes: sn(["E3"]) }, keys: { from: 36, to: 59, hint: [], labels: {} }, task: { targets: [NM("E3")] } },
    ],
    recap: ["Bass clef is an F: the dots hug the F line, and it's usually your left hand.", "Lines are G B D F A. Spaces are A C E G.", "Middle C is one ledger line above the bass staff."],
  },
  m3: {
    title: "Rhythm and rests", mins: 5,
    steps: [
      { title: "Feel the pulse", body: "Music has a steady pulse, like a heartbeat. We count that pulse in beats. Press Hear it and count 1, 2, 3, 4 along with it.", beats: { blocks: [{ l: "1", b: 1 }, { l: "2", b: 1 }, { l: "3", b: 1 }, { l: "4", b: 1 }], bpm: 80 } },
      { title: "How long is a note?", body: "A quarter note lasts one beat. A half note lasts two. A whole note lasts four. An eighth note lasts half a beat, so two of them fit into one beat.\n\nThis bar holds a half note, a quarter note and two eighth notes: 2 + 1 + ½ + ½ = 4 beats.", beats: { blocks: [{ l: "half", b: 2 }, { l: "quarter", b: 1 }, { l: "8th", b: 0.5 }, { l: "8th", b: 0.5 }], bpm: 80 } },
      { title: "A dot adds half", body: "A dot after a note adds half of its value. A dotted half note is 2 + 1 = 3 beats. A dotted quarter is 1 + ½ = 1½ beats.", beats: { blocks: [{ l: "dotted half", b: 3 }, { l: "quarter", b: 1 }], bpm: 80 } },
      { title: "Rests are silence", body: "A rest is silence that lasts as long as the matching note. Silence is part of the music, so count it just as carefully. The dashed block below is a quarter rest.", beats: { blocks: [{ l: "quarter", b: 1 }, { l: "rest", b: 1, rest: true }, { l: "half", b: 2 }], bpm: 80 } },
      { title: "Reading a time signature", body: "Two numbers sit at the start of a piece. The top number says how many beats are in each bar. The bottom number says which note gets one beat: 4 means a quarter note.\n\n4/4 has four beats per bar. 3/4 has three, like a waltz: ONE two three.", beats: { blocks: [{ l: "ONE", b: 1 }, { l: "two", b: 1 }, { l: "three", b: 1 }], bpm: 100 } },
    ],
    recap: ["Quarter = 1 beat, half = 2, whole = 4, eighth = ½.", "A dot adds half the note's value.", "Rests are silence of the same lengths. The top time-signature number counts beats per bar."],
  },
  m4: {
    title: "Scales and intervals", mins: 6,
    steps: [
      { title: "The C major scale", body: "A scale is a ladder of notes in order. C major uses only the white keys from one C to the next. Singers name these notes with solfège: Do, Re, Mi, Fa, Sol, La, Ti, Do.\n\nPress Hear it to climb the ladder.", keys: { from: 60, to: 72, hint: SCALE_C, labels: "solfege" }, hear: SCALE_C },
      { title: "Whole steps and half steps", body: "The distance to the very next key, black or white, is a half step. Two half steps make a whole step.\n\nEvery major scale follows the pattern whole, whole, half, whole, whole, whole, half. In C major the half steps fall between E and F, and between B and C, where there is no black key between them.", keys: { from: 60, to: 72, hint: [NM("E4"), NM("F4"), NM("B4"), NM("C5")], labels: "letters" }, hear: [NM("E4"), NM("F4"), NM("B4"), NM("C5")] },
      { title: "Measuring distance: intervals", body: "An interval is the distance between two notes. Count the lower note as 1, then count every letter up to the higher note.\n\nC up to E is C, D, E: that is a third.", staff: { clef: "treble", notes: sn(["C4", "E4"]) }, hear: [NM("C4"), NM("E4")] },
      { title: "Interval names", body: "The names run: unison (1), second, third, fourth, fifth, sixth, seventh, octave (8).\n\nC up to G is C, D, E, F, G: a fifth. It sounds open and steady.", staff: { clef: "treble", notes: sn(["C4", "G4"]) }, hear: [NM("C4"), NM("G4")] },
      { title: "Try it: a fifth above C", body: "Count five letters up from middle C: C, D, E, F, G. Press the note a fifth above middle C.", staff: { clef: "treble", notes: sn(["C4"]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("G4")] } },
      { title: "The octave", body: "An octave is eight letters apart. It has the same letter name, but the pitch is twice as high. The two notes sound so alike that they feel like the same note in a different room.", keys: { from: 60, to: 83, hint: [NM("C4"), NM("C5")], labels: "letters" }, hear: [NM("C4"), NM("C5"), [NM("C4"), NM("C5")]] },
    ],
    recap: ["C major is the white keys C to C: Do Re Mi Fa Sol La Ti Do.", "Half steps fall at E–F and B–C. Count both notes when measuring an interval.", "An octave is eight letters apart with the same name."],
  },
  k1: {
    title: "Find your way around the keyboard", mins: 4,
    steps: [
      { title: "Black keys come in groups", body: "The keyboard repeats one pattern: a group of two black keys, then a group of three. The black keys are landmarks, so you never need to count from the end.", keys: { from: 60, to: 83, hint: [61, 63, 66, 68, 70, 73, 75, 78, 80, 82], labels: {} } },
      { title: "C sits left of the two black keys", body: "Find a pair of black keys. The white key just to the left of the pair is C. Going right, the next white keys are D and E, all around the pair.", keys: { from: 60, to: 83, hint: [NM("C4")], labels: "letters" } },
      { title: "Try it: find F", body: "F is the white key just left of the group of three black keys. Press F.", keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("F4")] } },
      { title: "Do is C, Re is D", body: "Solfège gives each white key a syllable. Do is the C you just found. Then Re, Mi, Fa, Sol, La, Ti, and back to Do.", keys: { from: 60, to: 72, hint: [], labels: "solfege" }, hear: SCALE_C },
      { title: "Try it: find Sol", body: "Count up from Do: Do, Re, Mi, Fa, Sol. Press Sol.", keys: { from: 60, to: 72, hint: [], labels: {} }, task: { targets: [NM("G4")] } },
    ],
    recap: ["Black keys come in groups of two and three.", "C is the white key left of the two-black-key group. F is left of the three-group.", "Do is C, Re is D, Mi is E, Fa is F, Sol is G."],
  },
  x1: {
    title: "Sharps, flats and naturals", mins: 6,
    steps: [
      { title: "The smallest step: a semitone", body: "A semitone, or half step, is the distance to the very next key, black or white. From C to the black key right after it is one semitone. Press Hear it.", keys: { from: 60, to: 72, hint: [60, 61], labels: "letters" }, hear: [60, 61] },
      { title: "A sharp ♯ raises a note", body: "A sharp sign in front of a note means: play the next key to the right, one semitone higher.\n\nF sharp (F♯) is the black key just to the right of F.", staff: { clef: "treble", notes: sn([["F4", "#"]]) }, keys: { from: 60, to: 83, hint: [NM("F4"), NM("F#4")], labels: "letters" }, hear: [NM("F4"), NM("F#4")] },
      { title: "Try it: play F♯", body: "The note on the staff has a sharp. Find F, then move one key to the right.", staff: { clef: "treble", notes: sn([["F4", "#"]]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("F#4")] } },
      { title: "A flat ♭ lowers a note", body: "A flat sign means: play the next key to the left, one semitone lower.\n\nB flat (B♭) is the black key just to the left of B.", staff: { clef: "treble", notes: sn([["B4", "b"]]) }, keys: { from: 60, to: 83, hint: [NM("B4"), NM("Bb4")], labels: "letters" }, hear: [NM("B4"), NM("Bb4")] },
      { title: "Try it: play A♭", body: "Find A, then move one key to the left.", staff: { clef: "treble", notes: sn([["A4", "b"]]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("Ab4")] } },
      { title: "One key, two names", body: "The black key between C and D is both C♯ and D♭. The two names sound identical. Which one you see depends on the key of the piece.", keys: { from: 60, to: 72, hint: [61], labels: "letters" }, hear: [61] },
      { title: "Naturals cancel", body: "A natural sign (♮) cancels a sharp or flat.\n\nAn accidental stays in force for the rest of the bar, on that same line or space. So here the second F is still sharp, and the third F has a natural sign, so it is played plainly. A new bar resets everything.", staff: { clef: "treble", notes: sn([["F4", "#"], "F4", ["F4", "n"]]) }, keys: { from: 60, to: 72, hint: [NM("F#4"), NM("F4")], labels: "letters" }, hear: [NM("F#4"), NM("F#4"), NM("F4")] },
    ],
    recap: ["Sharp ♯ = one key to the right. Flat ♭ = one key to the left.", "Natural ♮ cancels. An accidental lasts until the end of the bar.", "A black key has two names: C♯ and D♭ are the same key."],
  },
  x2: {
    title: "Time signatures and bars", mins: 4,
    steps: [
      { title: "Bars and beats", body: "Vertical bar lines cut music into bars, also called measures. Every bar holds the same number of beats. Press Hear it to count one bar.", beats: { blocks: [{ l: "1", b: 1 }, { l: "2", b: 1 }, { l: "3", b: 1 }, { l: "4", b: 1 }], bpm: 90 } },
      { title: "Reading 4/4", body: "The top number says how many beats are in a bar. The bottom number says which note gets one beat: 4 means a quarter note.\n\n4/4 is so common it is called common time. Count: ONE two three four, with the strongest beat on one.", beats: { blocks: [{ l: "ONE", b: 1 }, { l: "two", b: 1 }, { l: "three", b: 1 }, { l: "four", b: 1 }], bpm: 90 } },
      { title: "3/4 is a waltz", body: "Three beats per bar: ONE two three. The strong beat on one gives the lilting, swaying feel of a waltz.", beats: { blocks: [{ l: "ONE", b: 1 }, { l: "two", b: 1 }, { l: "three", b: 1 }], bpm: 100 } },
      { title: "6/8 rocks in two", body: "Six eighth notes per bar, grouped in threes: ONE two three FOUR five six. Even though there are six counts, it feels like two big rocking beats.", beats: { blocks: [{ l: "1", b: 0.5 }, { l: "2", b: 0.5 }, { l: "3", b: 0.5 }, { l: "4", b: 0.5 }, { l: "5", b: 0.5 }, { l: "6", b: 0.5 }], bpm: 110 } },
    ],
    recap: ["Top number: beats per bar. Bottom number: which note gets one beat.", "4/4 is ONE two three four. 3/4 is a waltz.", "6/8 groups six eighths into two beats of three."],
  },
  x3: {
    title: "Triads: major and minor", mins: 5,
    steps: [
      { title: "A triad is three notes", body: "A triad stacks every other note of a scale: a root, a third and a fifth. Starting on C, that is C, E and G. Press Hear it to hear them one by one, then together.", staff: { clef: "treble", notes: chordSn(["C4", "E4", "G4"]) }, keys: { from: 60, to: 83, hint: ["C4", "E4", "G4"].map(NM), labels: "letters" }, hear: [NM("C4"), NM("E4"), NM("G4"), ["C4", "E4", "G4"].map(NM)] },
      { title: "Major sounds bright", body: "A major triad is the root, a major third above it (4 semitones), and a perfect fifth above it (7 semitones). C major is C, E, G.", staff: { clef: "treble", notes: chordSn(["C4", "E4", "G4"]) }, keys: { from: 60, to: 83, hint: ["C4", "E4", "G4"].map(NM), labels: "letters" }, hear: [["C4", "E4", "G4"].map(NM)] },
      { title: "Minor sounds darker", body: "Lower the middle note by one semitone and the triad turns minor. C minor is C, E♭, G. Same shape, different mood.", staff: { clef: "treble", notes: chordSn(["C4", ["E4", "b"], "G4"]) }, keys: { from: 60, to: 83, hint: [NM("C4"), NM("Eb4"), NM("G4")], labels: "letters" }, hear: [[NM("C4"), NM("Eb4"), NM("G4")]] },
      { title: "Try it: build C major", body: "Press C, E and G. Any order works.", staff: { clef: "treble", notes: chordSn(["C4", "E4", "G4"]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: ["C4", "E4", "G4"].map(NM) } },
      { title: "Try it: make it minor", body: "Now play C minor. Lower the middle note of the chord by one semitone.", staff: { clef: "treble", notes: chordSn(["C4", ["E4", "b"], "G4"]) }, keys: { from: 60, to: 83, hint: [], labels: {} }, task: { targets: [NM("C4"), NM("Eb4"), NM("G4")] } },
    ],
    recap: ["A triad is root, third, fifth.", "Major = 4 semitones then 3. Minor = 3 then 4.", "Lowering the third turns a major triad into a minor one."],
  },
};
const EXTRAS = [
  { id: "k1", title: "Find your way around the keyboard", sub: "Black-key landmarks, C, F and solfège" },
  { id: "x1", title: "Sharps, flats and naturals", sub: "How to find ♯, ♭ and ♮ on the keys" },
  { id: "x2", title: "Time signatures and bars", sub: "4/4, 3/4, 6/8 and how to count them" },
  { id: "x3", title: "Triads: major and minor", sub: "Build your first chords" },
];

function BeatBar({ blocks, bpm }) {
  const { active, playing, play, stop } = useSeq();
  const items = blocks.map((b) => ({ m: b.rest ? [] : [72], d: b.b }));
  return (
    <div>
      <div style={{ display: "flex", gap: 3 }}>
        {blocks.map((b, k) => (
          <div key={k} style={{ flex: b.b, minWidth: 0, height: 54, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600, textAlign: "center", overflow: "hidden", background: active === k ? "var(--ui)" : b.rest ? "transparent" : "var(--sage)", border: b.rest ? "1.5px dashed var(--ui)" : "1.5px solid transparent", transition: "background .1s" }}>{b.l}</div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, ...muted, margin: "6px 2px 12px" }}>
        <span>Block width = how long it lasts</span><span>{blocks.reduce((s, b) => s + b.b, 0)} beats</span>
      </div>
      <Btn variant="soft" onClick={() => (playing ? stop() : play(items, bpm))} icon={playing ? <Square size={15} /> : <Headphones size={17} />} style={{ padding: "10px 18px" }}>{playing ? "Stop" : "Hear it"}</Btn>
    </div>
  );
}

function LessonPlayer({ id, lesson, canTest, isModule, onBack, onTest, onDone, askCoach }) {
  const steps = lesson.steps;
  const [i, setI] = useState(0);
  const [done, setDone] = useState({});
  const [got, setGot] = useState([]);
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState(null);
  const [flash, setFlash] = useState([]);
  const [finished, setFinished] = useState(false);
  const { active, playing, play, stop } = useSeq();
  const st = steps[i];
  const kb = st.keys;
  const labels = kb ? (kb.labels === "letters" ? letterLabels(kb.from, kb.to) : kb.labels === "solfege" ? solLabels(kb.from, kb.to) : kb.labels || {}) : {};
  const hearItems = useMemo(() => (st.hear || []).map((m) => ({ m: Array.isArray(m) ? m : [m], d: 1 })), [i]);
  const taskOpen = st.task && !done[i];
  const hint = kb ? [...(kb.hint || []), ...(taskOpen && misses >= 2 ? st.task.targets : [])] : [];
  const goto = (k) => { stop(); setI(k); setGot([]); setMisses(0); setMsg(null); };
  useEffect(() => { if (finished) onDone(id); }, [finished]);
  const press = (m) => {
    tone(m, { dur: 1, vol: 0.22 });
    setFlash([m]); setTimeout(() => setFlash([]), 260);
    if (!taskOpen) return;
    const t = st.task.targets;
    if (t.includes(m)) {
      const ng = got.includes(m) ? got : [...got, m]; setGot(ng);
      if (t.every((x) => ng.includes(x))) { setDone((d) => ({ ...d, [i]: true })); setMsg(null); tone(79, { delay: 0.15, dur: 0.6, vol: 0.12 }); }
      else setMsg(`Good, ${t.length - ng.length} more to go.`);
    } else { setMisses((x) => x + 1); setMsg(`That was ${midiToName(m)}. Try again${misses >= 1 ? ", the answer is now highlighted" : ""}.`); }
  };

  if (finished) return (
    <Page title={lesson.title} onBack={onBack}>
      <Card style={{ textAlign: "center", padding: 24, borderRadius: 26 }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, background: "var(--sage)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Check size={28} color="var(--good)" /></div>
        <H size={26}>Lesson complete</H>
        <div style={{ textAlign: "left", marginTop: 16, display: "grid", gap: 10 }}>
          {lesson.recap.map((r, k) => <div key={k} style={{ display: "flex", gap: 10, lineHeight: 1.45 }}><Check size={17} color="var(--good)" style={{ flexShrink: 0, marginTop: 2 }} /><span>{r}</span></div>)}
        </div>
      </Card>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {isModule && <Btn onClick={onTest} disabled={!canTest}>{canTest ? "Take the mastery test" : "Pass the earlier module first"}</Btn>}
        <Btn variant="secondary" onClick={() => askCoach(`Quiz me with 3 quick questions on: ${lesson.title}`)} icon={<Sparkles size={16} />}>Quiz me with the coach</Btn>
        <Btn variant="ghost" onClick={onBack}>Back to Learn</Btn>
      </div>
    </Page>
  );

  return (
    <Page title={lesson.title} onBack={() => { stop(); onBack(); }} right={<Pill>{lesson.mins} min</Pill>}>
      <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
        {steps.map((_, k) => <div key={k} style={{ flex: 1, height: 5, borderRadius: 3, background: k < i || done[k] ? "var(--accent)" : k === i ? "var(--ui)" : "var(--line)" }} />)}
      </div>
      <p style={{ ...muted, fontSize: 13, margin: "0 0 4px" }}>Step {i + 1} of {steps.length}{st.task ? " · Your turn" : ""}</p>
      <H size={26} style={{ marginBottom: 10 }}>{st.title}</H>
      <p style={{ margin: "0 0 16px", lineHeight: 1.6, fontSize: 16, whiteSpace: "pre-line" }}>{st.body}</p>
      {st.staff && <Card style={{ padding: "6px 8px", borderRadius: 20, marginBottom: 12 }}><Staff clef={st.staff.clef} notes={st.staff.notes} /></Card>}
      {st.beats && <Card style={{ marginBottom: 12 }}><BeatBar blocks={st.beats.blocks} bpm={st.beats.bpm} /></Card>}
      {kb && <Keyboard from={kb.from} to={kb.to} onPress={press} active={playing && hearItems[active] ? hearItems[active].m : flash} hint={hint} labels={labels} height={kb.to - kb.from > 14 ? 130 : 150} />}
      {st.hear && !st.beats && (
        <div style={{ marginTop: 12 }}>
          <Btn variant="soft" onClick={() => (playing ? stop() : play(hearItems, 100))} icon={playing ? <Square size={15} /> : <Headphones size={17} />} style={{ padding: "10px 18px" }}>{playing ? "Stop" : "Hear it"}</Btn>
        </div>
      )}
      {st.task && (
        <Card style={{ marginTop: 14, borderColor: done[i] ? "var(--good)" : "var(--line)", background: done[i] ? "var(--sage)" : "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {done[i] ? <Check size={18} color="var(--good)" /> : <Target size={18} color="var(--accent)" />}
            <b>{done[i] ? "Got it" : st.task.targets.length > 1 ? "Press all the keys" : "Press the key"}</b>
          </div>
          {msg && !done[i] && <p style={{ margin: "6px 0 0", color: msg.startsWith("Good") ? "var(--good)" : "var(--bad)", fontSize: 14 }}>{msg}</p>}
        </Card>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {i > 0 && <Btn variant="secondary" onClick={() => goto(i - 1)} style={{ flex: 1 }}>Back</Btn>}
        <Btn onClick={() => (i + 1 >= steps.length ? (stop(), setFinished(true)) : goto(i + 1))} disabled={taskOpen} style={{ flex: 2 }}>{i + 1 >= steps.length ? "Finish lesson" : "Next"}</Btn>
      </div>
      {taskOpen && misses >= 1 && <div style={{ textAlign: "center", marginTop: 10 }}><button onClick={() => setDone((d) => ({ ...d, [i]: true }))} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 14, textDecoration: "underline" }}>Skip this one</button></div>}
    </Page>
  );
}

/* ───────────────────────── HOME ───────────────────────── */
function HomeTab({ user, allowed, setTab, openTest, openLesson, openPiece, openPaywall, askCoach }) {
  const next = MODULES.find((m) => !user.passed.includes(m.id));
  const [b, i, a] = secScores(user.answers);
  const scores = [b, i, a];
  const weakest = DIAG_SECTIONS[scores.indexOf(Math.min(...scores))];
  const recId = allowed >= 3 ? "clair" : allowed === 1 ? "elise" : "ode";
  const rec = PIECES.find((p) => p.id === recId);
  return (
    <div style={{ padding: "6px 18px 24px", display: "grid", gap: 14 }}>
      <div>
        <p style={{ ...muted, margin: 0, fontSize: 14 }}>Welcome back</p>
        <H size={30} style={{ marginTop: 4 }}>Today's practice</H>
      </div>
      <Card style={{ background: "var(--accent)", color: "var(--onAccent)", border: "none", borderRadius: 26, padding: 20 }}>
        {next ? (
          <>
            <div style={{ fontSize: 14, opacity: 0.8 }}>Solfège Grade 1</div>
            <div className="ok-display" style={{ fontSize: 28, fontWeight: 600, margin: "4px 0 6px", lineHeight: 1.1 }}>{next.title}</div>
            <p style={{ margin: "0 0 16px", opacity: 0.85, lineHeight: 1.4 }}>{next.sub}</p>
            {user.lessons.includes(next.id) ? (
              <button onClick={() => openTest(next)} style={{ background: "var(--onAccent)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "12px 20px", fontWeight: 700, fontSize: 15 }}>Take the mastery test</button>
            ) : (
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => openLesson(next.id)} style={{ background: "var(--onAccent)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "12px 20px", fontWeight: 700, fontSize: 15 }}>Start the lesson</button>
                <button onClick={() => openTest(next)} style={{ background: "none", border: "none", color: "var(--onAccent)", opacity: 0.85, fontSize: 14, textDecoration: "underline", padding: 0 }}>I know this, test me</button>
              </div>
            )}
          </>
        ) : !user.track ? (
          <>
            <div className="ok-display" style={{ fontSize: 28, fontWeight: 600, margin: "0 0 6px", lineHeight: 1.1 }}>Grade 1 is complete</div>
            <p style={{ margin: "0 0 16px", opacity: 0.85, lineHeight: 1.4 }}>Pick Play-Fast or Conservatory to shape what comes next.</p>
            <button onClick={() => setTab("learn")} style={{ background: "var(--onAccent)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "12px 20px", fontWeight: 700, fontSize: 15 }}>Choose a track</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, opacity: 0.8 }}>{TRACKS[user.track].name} track</div>
            <div className="ok-display" style={{ fontSize: 28, fontWeight: 600, margin: "4px 0 16px", lineHeight: 1.1 }}>{TRACKS[user.track].modules[0]}</div>
            <button onClick={() => askCoach(`Give me a 3-minute starter lesson on: ${TRACKS[user.track].modules[0]}`)} style={{ background: "var(--onAccent)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "12px 20px", fontWeight: 700, fontSize: 15 }}>Preview with your coach</button>
          </>
        )}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Card style={{ padding: 14, borderRadius: 16 }}><Flame size={18} color="var(--accent)" /><div className="ok-display" style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{user.streak}</div><div style={{ ...muted, fontSize: 13 }}>day streak</div></Card>
        <Card style={{ padding: 14, borderRadius: 24 }}><TrendingUp size={18} color="var(--accent)" /><div className="ok-display" style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{user.musicalAge}</div><div style={{ ...muted, fontSize: 13 }}>musical age</div></Card>
        <Card style={{ padding: 14, borderRadius: 16 }}><GraduationCap size={18} color="var(--accent)" /><div className="ok-display" style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{user.passed.length}/4</div><div style={{ ...muted, fontSize: 13 }}>Grade 1</div></Card>
      </div>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Sparkles size={17} color="var(--accent)" /><b>Coach note</b></div>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          {user.answers.length ? `Your placement was weakest in ${weakest.toLowerCase()}. ` : "Demo profile loaded. "}
          I'll weave short drills on it into your sessions, so you keep playing while the gaps close.
        </p>
        <Btn variant="soft" onClick={() => askCoach("Where should I focus this week?")} style={{ marginTop: 12, padding: "9px 16px", fontSize: 14 }}>Ask the coach</Btn>
      </Card>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <b>Picked for your level</b><button onClick={() => setTab("library")} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 14 }}>See library</button>
        </div>
        <PieceRow piece={rec} allowed={allowed} onOpen={() => openPiece(rec)} />
      </div>
      {!user.pro && (
        <Card style={{ background: "var(--sage)", border: "none", display: "flex", gap: 12, alignItems: "center" }}>
          <Crown size={24} color="var(--accent)" />
          <div style={{ flex: 1 }}><b>OpusKeys Pro</b><div style={{ ...muted, fontSize: 13, lineHeight: 1.4 }}>Unlimited arrangements, scans and full library.</div></div>
          <Btn onClick={openPaywall} style={{ padding: "9px 14px", fontSize: 14 }}>Try free</Btn>
        </Card>
      )}
    </div>
  );
}

function PieceRow({ piece, allowed, onOpen, pro }) {
  const stretch = piece.tier > allowed;
  const gated = !stretch && !FREE_PIECES.includes(piece.id) && !pro;
  return (
    <button onClick={onOpen} style={{ width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: stretch ? "transparent" : "var(--sage)", border: stretch ? "1.5px dashed var(--ui)" : "none", display: "grid", placeItems: "center", flexShrink: 0 }}>
        {stretch ? <Layers size={20} color="var(--accent)" /> : <Music size={20} color="var(--accent)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ok-display" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{piece.title}</div>
        <div style={{ ...muted, fontSize: 13, marginTop: 2 }}>{piece.by} · {piece.key} · {piece.mood}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
          <Pill>{TIERS[piece.tier]}</Pill>
          {stretch && <Pill tone="line">Stretch: AI breakdown</Pill>}
          {gated && <Pill tone="line"><Crown size={11} /> Pro</Pill>}
        </div>
      </div>
      <ChevronRight size={18} color="var(--muted)" />
    </button>
  );
}

/* ───────────────────────── LEARN ───────────────────────── */
function LearnTab({ user, openTest, openLesson, pickTrack, askCoach }) {
  const nextIdx = MODULES.findIndex((m) => !user.passed.includes(m.id));
  const g1done = nextIdx === -1;
  return (
    <div style={{ padding: "6px 18px 24px", display: "grid", gap: 16 }}>
      <H size={30}>Learn</H>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}><b>Solfège Grade 1</b><span style={{ ...muted, fontSize: 14 }}>{user.passed.length} of 4 passed</span></div>
        <p style={{ ...muted, margin: "0 0 10px", fontSize: 14, lineHeight: 1.5 }}>Read the short interactive lesson first, then prove it with the 15-question test.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {MODULES.map((m, k) => {
            const passed = user.passed.includes(m.id), cur = k === nextIdx, locked = !passed && !cur;
            const read = user.lessons.includes(m.id);
            const tested = passed && user.answers.length && autoPassed(user.level).includes(m.id);
            return (
              <div key={m.id} style={{ background: cur ? "var(--sage)" : "var(--surface)", border: `1px solid ${cur ? "var(--ui)" : "var(--line)"}`, borderRadius: 20, padding: 14 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: passed ? "var(--good)" : "var(--bg)", border: passed ? "none" : "1px solid var(--line)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {passed ? <Check size={20} color="var(--bg)" /> : locked ? <Lock size={17} color="var(--muted)" /> : <Play size={17} color="var(--accent)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ok-display" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.15 }}>{m.title}</div>
                    <div style={{ ...muted, fontSize: 13, marginTop: 2 }}>{m.sub}</div>
                  </div>
                  {tested && <Pill>Tested out</Pill>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn variant={read ? "soft" : "primary"} onClick={() => openLesson(m.id)} icon={<BookOpen size={15} />} style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}>{read ? "Review lesson" : `Start lesson · ${LESSONS[m.id].mins} min`}</Btn>
                  <Btn variant="secondary" disabled={locked} onClick={() => openTest(m)} icon={locked ? <Lock size={14} /> : <Target size={15} />} style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}>{passed ? "Retake test" : "Mastery test"}</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <b>Theory shelf</b>
        <p style={{ ...muted, margin: "4px 0 10px", fontSize: 14, lineHeight: 1.5 }}>Short lessons you can open any time. Start here to learn sharps and flats.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {EXTRAS.map((e) => {
            const read = user.lessons.includes(e.id);
            return (
              <button key={e.id} onClick={() => openLesson(e.id)} style={{ textAlign: "left", display: "flex", gap: 12, alignItems: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "12px 14px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: read ? "var(--good)" : "var(--sage)", display: "grid", placeItems: "center", flexShrink: 0 }}>{read ? <Check size={18} color="var(--bg)" /> : <BookOpen size={17} color="var(--accent)" />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ ...muted, fontSize: 13 }}>{e.sub} · {LESSONS[e.id].mins} min</div>
                </div>
                <ChevronRight size={18} color="var(--muted)" />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <b>Your track</b>
        {!g1done && <p style={{ ...muted, margin: "6px 0 10px", fontSize: 14, lineHeight: 1.5 }}>Two tracks unlock when Grade 1 is complete.</p>}
        {g1done && !user.track && <p style={{ ...muted, margin: "6px 0 10px", fontSize: 14, lineHeight: 1.5 }}>Choose how deep you want to go. You can switch later.</p>}
        {(!user.track ? ["A", "B"] : [user.track]).map((k) => (
          <Card key={k} style={{ marginTop: 10, opacity: g1done ? 1 : 0.65, borderRadius: k === "A" ? 22 : 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="ok-display" style={{ fontSize: 20, fontWeight: 600 }}>{TRACKS[k].name}</div>
              <Pill>{TRACKS[k].sub}</Pill>
            </div>
            <p style={{ ...muted, margin: "8px 0 10px", lineHeight: 1.5, fontSize: 14 }}>{TRACKS[k].blurb}</p>
            {user.track === k ? (
              <div style={{ display: "grid", gap: 8 }}>
                {TRACKS[k].modules.map((t, j) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--line)" }}>
                    <span style={{ flex: 1 }}>{t}</span>
                    {j === 0 ? <Btn variant="soft" onClick={() => askCoach(`Give me a 3-minute starter lesson on: ${t}`)} style={{ padding: "6px 12px", fontSize: 13 }}>Preview</Btn> : <Lock size={15} color="var(--muted)" />}
                  </div>
                ))}
                <Btn variant="ghost" onClick={() => pickTrack(null)} style={{ padding: "6px 0", justifyContent: "flex-start" }}>Switch track</Btn>
              </div>
            ) : (
              <Btn disabled={!g1done} onClick={() => pickTrack(k)} style={{ width: "100%" }}>{g1done ? `Choose ${TRACKS[k].name}` : "Locked until Grade 1 is done"}</Btn>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── LIBRARY / ARRANGER ───────────────────────── */
function ArrangementCard({ a }) {
  return (
    <Card style={{ marginTop: 12, borderRadius: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="ok-display" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>{a.title}</div>
        <Pill tone="accent">{a.tier}</Pill>
      </div>
      <div style={{ ...muted, fontSize: 13, margin: "6px 0 12px" }}>{a.key} · {a.tempo} · {a.feel}</div>
      {[["Right hand", a.rightHand], ["Left hand", a.leftHand]].map(([k, v]) => (
        <div key={k} style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}><b style={{ fontSize: 14 }}>{k}</b><p style={{ margin: "3px 0 0", lineHeight: 1.45, fontSize: 14 }}>{v}</p></div>
      ))}
      <div style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}>
        <b style={{ fontSize: 14 }}>Chord map (tap to hear)</b>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {(a.chords || []).map((c, i) => (
            <button key={i} onClick={() => chordMidis(c).forEach((m, j) => tone(m, { delay: j * 0.04, dur: 1.2, vol: 0.13 }))} style={{ background: "var(--sage)", border: "none", borderRadius: 10, padding: "6px 11px", fontWeight: 600 }}>{c}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}>
        <b style={{ fontSize: 14 }}>What we simplified</b>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5, fontSize: 14 }}>{(a.simplifications || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>
      <div style={{ padding: "9px 0 0", borderTop: "1px solid var(--line)" }}>
        <b style={{ fontSize: 14 }}>Practice plan</b>
        <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5, fontSize: 14 }}>{(a.practicePlan || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
    </Card>
  );
}

function fallbackArrangement(title, level) {
  const tier = level === "Advanced" ? "Advanced" : level === "Intermediate" ? "Intermediate" : "Beginner";
  const easy = tier === "Beginner";
  return {
    title, tier, key: easy ? "C major (transposed)" : "Original key", tempo: easy ? "70 bpm to start" : "Slow to 80%, then full tempo", feel: "Lyrical",
    rightHand: easy ? "Melody in a single five-finger position, quarter and half notes only." : "Melody with occasional octave doubling on phrase peaks.",
    leftHand: easy ? "One root note per bar, held." : "Broken-chord pattern, root–fifth–octave in eighth notes.",
    chords: easy ? ["C", "Am", "F", "G"] : ["Am", "F", "C", "G"],
    simplifications: ["Fast ornaments removed", "Inner voices thinned to the chord's essential notes", easy ? "Transposed to avoid black keys" : "Left-hand leaps reduced"],
    practicePlan: ["Hands separate, 2 passes each", "Hands together at 60% speed", "Loop the hardest two bars five times", "Play the full arrangement once, no stopping"],
  };
}

function LibraryTab({ user, allowed, openPiece, requirePro, saveArr }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [arr, setArr] = useState(null);
  const list = PIECES.filter((p) => (filter === "all" ? true : filter === "mine" ? p.tier <= allowed : p.tier > allowed));
  const run = (title) => {
    const t = (title || q).trim(); if (!t) return;
    requirePro(async () => {
      setBusy(true); setArr(null);
      try {
        const txt = await askClaude({
          system: `You are the arrangement engine inside OpusKeys, a piano learning app. Return ONLY a JSON object with keys: title (string), tier ("Beginner"|"Intermediate"|"Advanced"), key (string), tempo (string), feel (string), rightHand (string, 1-2 sentences), leftHand (string, 1-2 sentences), chords (array of 4-6 chord symbols like "Am", "F", "C", "G7"), simplifications (array of 3 short strings), practicePlan (array of 4 short strings). Describe the arrangement approach in general terms. Never reproduce lyrics or copyrighted notation. If you are unsure of the song's harmony, use typical progressions for its style and key. The student's level is ${user.level}; tailor the tier to that level.`,
          messages: [{ role: "user", content: `Create an arrangement brief for: ${t}` }],
        });
        const j = parseJSON(txt); setArr(j); saveArr(j);
      } catch (e) { const f = fallbackArrangement(t, user.level); setArr(f); saveArr(f); }
      setBusy(false);
    });
  };
  return (
    <div style={{ padding: "6px 18px 24px", display: "grid", gap: 14 }}>
      <H size={30}>Library</H>
      <Card style={{ background: "var(--sage)", border: "none", borderRadius: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Wand2 size={18} color="var(--accent)" /><b>Play anything you love</b></div>
        <p style={{ ...muted, margin: "0 0 12px", fontSize: 14, lineHeight: 1.45 }}>Search any song or soundtrack. The AI arranger writes it for your level.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Song or soundtrack" style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 999, padding: "12px 16px", fontSize: 15 }} />
          <Btn onClick={() => run()} disabled={busy || !q.trim()} style={{ padding: "12px 18px" }}>Arrange</Btn>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {["Drowning Love", "Moon River", "River Flows in You"].map((s) => (
            <button key={s} onClick={() => { setQ(s); run(s); }} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 12px", fontSize: 13 }}>{s}</button>
          ))}
        </div>
        {busy && <p style={{ ...muted, margin: "12px 0 0", fontSize: 14 }}>Arranging for {user.level.toLowerCase()} level…</p>}
        {arr && !busy && <ArrangementCard a={arr} />}
        {arr && !busy && <p style={{ ...muted, fontSize: 12, margin: "10px 0 0", lineHeight: 1.4 }}>Prototype note: the arranger outputs a brief. Engraved notation arrives with the OSMD renderer in the MVP.</p>}
      </Card>
      {user.arrangements.length > 1 && (
        <div>
          <b>Your arrangements</b>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{user.arrangements.map((a, i) => <Pill key={i} tone="line">{a.title}</Pill>)}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {[["all", "All"], ["mine", "At my level"], ["stretch", "Stretch"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ border: `1px solid ${filter === k ? "var(--accent)" : "var(--line)"}`, background: filter === k ? "var(--accent)" : "transparent", color: filter === k ? "var(--onAccent)" : "var(--text)", borderRadius: 999, padding: "7px 14px", fontSize: 14, fontWeight: 600 }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((p) => <PieceRow key={p.id} piece={p} allowed={allowed} pro={user.pro} onOpen={() => openPiece(p)} />)}
      </div>
      <p style={{ ...muted, fontSize: 13, lineHeight: 1.5, margin: 0 }}>As a {user.level}, you see {TIERS.slice(0, allowed + 1).join(" and ").toLowerCase()} scores in full. Pieces above that open in AI Breakdown Mode instead.</p>
    </div>
  );
}

/* ───────────────────────── PLAYER ───────────────────────── */
function Player({ piece, allowed, onBack, onOpenPiece, onBreakdown }) {
  const items = useMemo(() => toItems(piece), [piece]);
  const { active, playing, play, stop } = useSeq();
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState("view");
  const [idx, setIdx] = useState(0);
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState({ hits: 0, miss: 0, missed: {} });
  const [flash, setFlash] = useState(null);
  const [pressed, setPressed] = useState([]);
  const [mic, setMic] = useState({ on: false, msg: "" });
  const [suggest, setSuggest] = useState(null);
  const micRef = useRef(null);
  const inputRef = useRef(null);
  const hasScore = items.length > 0;
  const fingerLabels = useMemo(() => { const o = {}; Object.entries(piece.fingering || {}).forEach(([n, f]) => { o[parseNote(n).midi] = f; }); return o; }, [piece]);

  const handleInput = (m, fromMic) => {
    if (!fromMic) tone(m, { dur: 1, vol: 0.22 });
    setPressed([m]); setTimeout(() => setPressed([]), 260);
    if (mode !== "practice" || !hasScore) return;
    const exp = items[idx].m;
    const left = pending.length ? pending : exp;
    if (left.includes(m)) {
      const rest = left.filter((x) => x !== m);
      if (!rest.length) {
        setPending([]); setStats((s) => ({ ...s, hits: s.hits + 1 })); setFlash({ ok: true, text: "Clean" });
        if (idx + 1 >= items.length) setMode("done"); else setIdx(idx + 1);
      } else setPending(rest);
    } else {
      const nm = midiToName(exp[0]);
      setStats((s) => ({ ...s, miss: s.miss + 1, missed: { ...s.missed, [nm]: (s.missed[nm] || 0) + 1 } }));
      setFlash({ ok: false, text: `Expected ${exp.map(midiToName).join(" + ")}, heard ${midiToName(m)}` });
    }
  };
  inputRef.current = handleInput;

  const stopMic = useCallback(() => {
    if (micRef.current) { clearInterval(micRef.current.id); micRef.current.stream.getTracks().forEach((t) => t.stop()); micRef.current = null; }
    setMic((m) => ({ ...m, on: false }));
  }, []);
  useEffect(() => stopMic, [stopMic]);
  const toggleMic = async () => {
    if (mic.on) { stopMic(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const c = getCtx(); const src = c.createMediaStreamSource(stream);
      const an = c.createAnalyser(); an.fftSize = 2048; src.connect(an);
      const buf = new Float32Array(2048); let last = -1, sil = 0;
      const id = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, c.sampleRate);
        if (f < 0) { sil++; if (sil > 2) last = -1; return; }
        const m = Math.round(69 + 12 * Math.log2(f / 440));
        if (m !== last || sil >= 2) inputRef.current && inputRef.current(m, true);
        last = m; sil = 0;
      }, 90);
      micRef.current = { id, stream };
      setMic({ on: true, msg: "Listening to your piano" });
    } catch (e) { setMic({ on: false, msg: "Microphone isn't available in this preview. Use the on-screen keys." }); }
  };

  const startPractice = () => { stop(); setMode("practice"); setIdx(0); setPending([]); setStats({ hits: 0, miss: 0, missed: {} }); setFlash(null); setSuggest(null); };
  const preview = () => { if (playing) stop(); else { setMode("view"); play(items, piece.bpm * speed); } };
  const total = stats.hits + stats.miss;
  const acc = total ? Math.round((stats.hits / total) * 100) : 100;
  const worst = Object.entries(stats.missed).sort((a, b) => b[1] - a[1])[0];
  const hint = mode === "practice" && hasScore ? (pending.length ? pending : items[idx].m) : [];
  const staffActive = mode === "practice" ? idx : active;
  const clefNotes = useMemo(() => staffNotes(items), [items]);

  return (
    <Page title={piece.title} onBack={onBack} right={<Pill>{TIERS[piece.tier]}</Pill>}>
      <div style={{ ...muted, fontSize: 14, margin: "-6px 0 12px" }}>{piece.by} · {piece.key} · {piece.bpm} bpm · {piece.mood}</div>
      <Card style={{ padding: "8px 8px 4px", borderRadius: 22 }}>
        {hasScore ? <Staff clef="treble" notes={clefNotes} active={staffActive} /> : (
          <div style={{ padding: 22, textAlign: "center" }}>
            <Layers size={26} color="var(--accent)" />
            <p style={{ margin: "8px 0 0", lineHeight: 1.5, fontSize: 14 }}>The full engraved score renders here with OpenSheetMusicDisplay in the MVP. This demo ships notation for five pieces.</p>
          </div>
        )}
      </Card>
      {hasScore ? (
        <>
          <div style={{ display: "flex", gap: 8, margin: "14px 0 10px", flexWrap: "wrap" }}>
            <Btn variant="soft" onClick={preview} icon={playing ? <Square size={15} /> : <Headphones size={17} />}>{playing ? "Stop" : "Listen"}</Btn>
            <Btn onClick={startPractice} icon={<Play size={16} />}>{mode === "practice" ? "Restart" : "Practice"}</Btn>
            <Btn variant={mic.on ? "primary" : "secondary"} onClick={toggleMic} icon={mic.on ? <Mic size={16} /> : <MicOff size={16} />}>{mic.on ? "Listening" : "Use mic"}</Btn>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 14 }}>
            <span style={muted}>Tempo</span>
            {[0.6, 0.8, 1].map((s) => <button key={s} onClick={() => setSpeed(s)} style={{ border: `1px solid ${speed === s ? "var(--accent)" : "var(--line)"}`, background: speed === s ? "var(--sage)" : "transparent", borderRadius: 10, padding: "4px 11px", fontWeight: 600 }}>{Math.round(s * 100)}%</button>)}
          </div>
        </>
      ) : (
        <div style={{ margin: "14px 0" }}><Btn onClick={() => onBreakdown(piece)} icon={<Layers size={17} />} style={{ width: "100%" }}>Open AI Breakdown Mode</Btn></div>
      )}
      {mic.msg && <p style={{ ...muted, fontSize: 13, margin: "0 0 10px" }}>{mic.msg}</p>}
      <Keyboard from={60} to={83} onPress={(m) => handleInput(m)} active={playing && hasScore && items[active] ? items[active].m : pressed} hint={hint} labels={fingerLabels} height={150} />
      {piece.fingering && <p style={{ ...muted, fontSize: 13, margin: "8px 0 0" }}>Numbers on the keys show the finger to use: 1 is your thumb.</p>}

      {mode === "practice" && (
        <Card style={{ marginTop: 14, borderColor: flash ? (flash.ok ? "var(--good)" : "var(--bad)") : "var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>Note {idx + 1} of {items.length}</span><b>{acc}% accurate</b>
          </div>
          <p style={{ margin: "8px 0 0", color: flash && !flash.ok ? "var(--bad)" : "var(--text)", minHeight: 22 }}>{flash ? flash.text : "Play the highlighted key. The coach is listening."}</p>
        </Card>
      )}
      {mode === "done" && (
        <Card style={{ marginTop: 14, borderRadius: 24, background: "var(--sage)", border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={18} color="var(--accent)" /><b>Run complete: {acc}% accurate</b></div>
          <p style={{ margin: "8px 0 14px", lineHeight: 1.55 }}>
            {worst ? `You missed ${worst[0]} most often (${worst[1]}×). Loop that spot at 60% for five clean passes before moving on.` : "No wrong notes. Raise the tempo to 100% and play the whole phrase twice without looking at the keys."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={startPractice} style={{ padding: "10px 16px" }}>Play again</Btn>
            <Btn variant="secondary" icon={<Shuffle size={15} />} onClick={() => setSuggest(similarPiece(piece, allowed))} style={{ padding: "10px 16px" }}>Give me another piece like this</Btn>
          </div>
        </Card>
      )}
      {mode !== "done" && hasScore && (
        <div style={{ marginTop: 14 }}>
          <Btn variant="secondary" icon={<Shuffle size={15} />} onClick={() => setSuggest(similarPiece(piece, allowed))} style={{ width: "100%" }}>Give me another piece like this</Btn>
        </div>
      )}
      {suggest && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{suggest.p.title}</b><Pill tone="accent">{Math.round(suggest.s * 100)}% match</Pill></div>
          <p style={{ ...muted, margin: "6px 0 12px", fontSize: 14, lineHeight: 1.45 }}>Closest in tempo, mood, brightness and texture, from your level's library. {suggest.p.mood} · {suggest.p.key}.</p>
          <Btn onClick={() => onOpenPiece(suggest.p)} style={{ padding: "10px 16px" }}>Open {suggest.p.title}</Btn>
        </Card>
      )}
    </Page>
  );
}

/* ───────────────────────── BREAKDOWN MODE ───────────────────────── */
function fallbackBreakdown(piece, user) {
  const chords = piece.chords || ["Dm", "Bb", "F", "C"];
  return {
    overview: `${piece.title} sits above ${user.level} level. Break it into small, repeatable pieces and rebuild it.`,
    steps: [
      { title: "Listen before you touch", detail: "Play the preview twice. Follow the shape of the phrases, not every note." },
      { title: "Hands separate", detail: "Learn the right hand in two-bar chunks, then the left hand alone." },
      { title: "Find the harmony", detail: "Play the chord map as block chords. Your hands will start to anticipate the shapes." },
      { title: "Loop the hard bars", detail: "Isolate the two hardest bars. Five clean repeats at 60% beats twenty rushed ones." },
    ],
    chords: chords.map((c) => ({ name: c, notes: "", tip: "Play as a block chord, then as an arpeggio." })),
    fingering: ["Keep fingers 1 and 5 anchored on chord tones.", "Mark thumb-under points in pencil before you play.", "Use the same fingering every repeat."],
    bars: [{ label: "Bars 1–2", why: "Sets the hand position for the whole piece." }, { label: "First leap or cross-over", why: "Where most students stall." }],
  };
}
function Breakdown({ piece, user, onBack }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("steps");
  const [seg, setSeg] = useState(0);
  const [speed, setSpeed] = useState(0.6);
  const { active, playing, play, stop } = useSeq();
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const txt = await askClaude({
          system: `You are Breakdown Mode inside OpusKeys, a piano learning app. Return ONLY a JSON object with keys: overview (1-2 sentences), steps (array of exactly 4 objects with title and detail), chords (array of 4-6 objects with name as a standard chord symbol like "Am" or "G7", notes as the note letters, and tip), fingering (array of 3 short strings), bars (array of 2-3 objects with label and why). Be practical for a ${user.level} student and focus on what makes this piece hard. Do not quote copyrighted score text. If you are unsure of exact harmony, use the common chords of the key.`,
          messages: [{ role: "user", content: `Piece: ${piece.title} by ${piece.by}, key ${piece.key}. Tier: ${TIERS[piece.tier]}.` }],
        });
        if (alive) setData(parseJSON(txt));
      } catch (e) { if (alive) setData(fallbackBreakdown(piece, user)); }
    })();
    return () => { alive = false; };
  }, [piece.id]);
  const items = useMemo(() => toItems(piece), [piece]);
  const half = Math.ceil(items.length / 2);
  const segItems = seg === 0 ? items.slice(0, half) : items.slice(half);
  const chordItems = useMemo(() => (data?.chords || []).map((c) => ({ m: chordMidis(c.name), d: 2 })).filter((c) => c.m.length), [data]);
  const fingerLabels = useMemo(() => { const o = {}; Object.entries(piece.fingering || {}).forEach(([n, f]) => { o[parseNote(n).midi] = f; }); return o; }, [piece]);
  const tabs = [["steps", "Steps"], ["chords", "Chords"], ["fingering", "Fingering"], ["loop", "Loop"]];
  return (
    <Page title="AI Breakdown Mode" onBack={() => { stop(); onBack(); }}>
      <Card style={{ background: "var(--sage)", border: "none", borderRadius: 24 }}>
        <Pill tone="line" style={{ marginBottom: 8 }}>Stretch piece · {TIERS[piece.tier]}</Pill>
        <div className="ok-display" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{piece.title}</div>
        <div style={{ ...muted, fontSize: 14, marginTop: 3 }}>{piece.by} · {piece.key}</div>
        <p style={{ margin: "10px 0 0", lineHeight: 1.5 }}>{data ? data.overview : "Breaking this piece down for you…"}</p>
      </Card>
      <div style={{ display: "flex", gap: 6, margin: "14px 0" }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => { stop(); setTab(k); }} style={{ flex: 1, border: `1px solid ${tab === k ? "var(--accent)" : "var(--line)"}`, background: tab === k ? "var(--accent)" : "transparent", color: tab === k ? "var(--onAccent)" : "var(--text)", borderRadius: 12, padding: "9px 4px", fontWeight: 600, fontSize: 14 }}>{l}</button>)}
      </div>
      {!data ? (
        <Card><div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: "var(--ui)", animation: `ok-dot 1.2s ${i * 0.2}s infinite` }} />)}</div></Card>
      ) : tab === "steps" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {(data.steps || []).map((s, i) => (
            <Card key={i} style={{ display: "flex", gap: 12 }}>
              <div className="ok-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--ui)", width: 22 }}>{i + 1}</div>
              <div><b>{s.title}</b><p style={{ margin: "4px 0 0", lineHeight: 1.5, fontSize: 14 }}>{s.detail}</p></div>
            </Card>
          ))}
        </div>
      ) : tab === "chords" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {(data.chords || []).map((c, i) => (
            <Card key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={() => chordMidis(c.name).forEach((m, j) => tone(m, { delay: j * 0.05, dur: 1.4, vol: 0.14 }))} aria-label={`Play ${c.name}`} style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent)", color: "var(--onAccent)", border: "none", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{c.name}</button>
              <div style={{ minWidth: 0 }}>{c.notes && <b style={{ fontSize: 14 }}>{c.notes}</b>}<p style={{ margin: "2px 0 0", lineHeight: 1.45, fontSize: 14 }}>{c.tip}</p></div>
            </Card>
          ))}
        </div>
      ) : tab === "fingering" ? (
        <div>
          {piece.fingering && <Card style={{ marginBottom: 10 }}><Keyboard from={60} to={71} labels={fingerLabels} onPress={(m) => tone(m)} height={120} /></Card>}
          <Card><ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{(data.fingering || []).map((f, i) => <li key={i}>{f}</li>)}</ul></Card>
          <Card style={{ marginTop: 10 }}>
            <b>Bars to isolate</b>
            {(data.bars || []).map((b, i) => <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : "none", marginTop: i ? 0 : 6 }}><b style={{ fontSize: 14 }}>{b.label}</b><div style={{ ...muted, fontSize: 14, lineHeight: 1.45 }}>{b.why}</div></div>)}
          </Card>
        </div>
      ) : (
        <Card>
          <b>Loop it</b>
          <p style={{ ...muted, margin: "4px 0 12px", fontSize: 14, lineHeight: 1.45 }}>{items.length ? "Repeat a phrase at a slower tempo until it feels easy." : "Loop the piece's chord skeleton so your ear learns the harmony."}</p>
          {items.length > 0 && (
            <>
              <div style={{ background: "var(--bg)", borderRadius: 14, padding: "4px 6px" }}><Staff clef="treble" notes={staffNotes(segItems)} active={active - 0} /></div>
              <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                {["First half", "Second half"].map((l, k) => <button key={l} onClick={() => { stop(); setSeg(k); }} style={{ border: `1px solid ${seg === k ? "var(--accent)" : "var(--line)"}`, background: seg === k ? "var(--sage)" : "transparent", borderRadius: 10, padding: "6px 12px", fontWeight: 600, fontSize: 14 }}>{l}</button>)}
              </div>
            </>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ ...muted, fontSize: 14 }}>Speed</span>
            {[0.5, 0.6, 0.8].map((s) => <button key={s} onClick={() => setSpeed(s)} style={{ border: `1px solid ${speed === s ? "var(--accent)" : "var(--line)"}`, background: speed === s ? "var(--sage)" : "transparent", borderRadius: 10, padding: "4px 11px", fontWeight: 600 }}>{Math.round(s * 100)}%</button>)}
          </div>
          <Btn onClick={() => (playing ? stop() : play(items.length ? segItems : chordItems, items.length ? piece.bpm * speed : 60 * speed * 1.4, { loop: true }))} icon={playing ? <Square size={15} /> : <RefreshCw size={16} />} style={{ width: "100%" }} disabled={!items.length && !chordItems.length}>{playing ? "Stop loop" : "Start loop"}</Btn>
        </Card>
      )}
    </Page>
  );
}

/* ───────────────────────── SCAN (OMR) ───────────────────────── */
const SYMBOLS = [
  { id: "mf", name: "Mezzo forte (mf)", meaning: "Play moderately loud: a comfortable speaking-voice volume, between mp and f.", how: "Use about 60% of your arm weight and keep the wrist loose.", lesson: "Dynamics basics · 3 min", audio: () => [60, 64, 67].forEach((m, i) => tone(m, { delay: i * 0.25, vol: 0.16, dur: 1.2 })) },
  { id: "pp", name: "Pianissimo (pp)", meaning: "Play very softly. Think of whispering the phrase.", how: "Stay close to the keys and let the weight of your fingers do the work.", lesson: "Dynamics basics · 3 min", audio: () => [60, 64, 67].forEach((m, i) => tone(m, { delay: i * 0.25, vol: 0.035, dur: 1.2 })) },
  { id: "ff", name: "Fortissimo (ff)", meaning: "Play very loudly, with full, supported tone.", how: "Use arm weight, not finger pounding, so the sound stays round.", lesson: "Dynamics basics · 3 min", audio: () => [60, 64, 67].forEach((m, i) => tone(m, { delay: i * 0.2, vol: 0.42, dur: 1.3 })) },
  { id: "cresc", name: "Crescendo", meaning: "Gradually get louder across the notes under the hairpin.", how: "Plan your peak. Start softer than you think so there's room to grow.", lesson: "Shaping phrases · 4 min", audio: () => [60, 62, 64, 65, 67].forEach((m, i) => tone(m, { delay: i * 0.3, vol: 0.04 + i * 0.09, dur: 0.7 })) },
  { id: "fermata", name: "Fermata", meaning: "Hold the note or rest longer than written. The length is your choice.", how: "Listen to the sound fade, then release together with your breath.", lesson: "Tempo and expression · 3 min", audio: () => tone(67, { dur: 2.8, vol: 0.2 }) },
  { id: "staccato", name: "Staccato", meaning: "Play the note short and detached, about half its written length.", how: "Bounce off the key as if it were hot.", lesson: "Articulation · 3 min", audio: () => [60, 64, 67, 72].forEach((m, i) => tone(m, { delay: i * 0.3, dur: 0.12, vol: 0.2 })) },
  { id: "sharp", name: "Sharp (♯)", meaning: "Raise the note by a semitone, to the very next key to the right.", how: "The sharp lasts for the rest of the bar, on that line or space only.", lesson: "Accidentals · 4 min", audio: () => { tone(65, { dur: 0.8, vol: 0.2 }); tone(66, { delay: 0.7, dur: 1, vol: 0.2 }); } },
];
function SymbolArt({ id }) {
  const s = { stroke: "var(--text)", fill: "none", strokeWidth: 3.2, strokeLinecap: "round" };
  return (
    <svg viewBox="0 0 120 80" style={{ width: "100%", height: "100%" }}>
      {["mf", "pp", "ff"].includes(id) && <text x="60" y="56" textAnchor="middle" className="ok-display" fontStyle="italic" fontWeight="600" fontSize="44" fill="var(--text)">{id}</text>}
      {id === "cresc" && <g {...s}><path d="M10 40 L110 18" /><path d="M10 40 L110 62" /></g>}
      {id === "fermata" && <g {...s}><path d="M28 52 A32 30 0 0 1 92 52" /><circle cx="60" cy="48" r="3.5" fill="var(--text)" /></g>}
      {id === "staccato" && <g><ellipse cx="55" cy="52" rx="10" ry="7.5" transform="rotate(-20 55 52)" fill="var(--text)" /><line x1="64" y1="50" x2="64" y2="16" stroke="var(--text)" strokeWidth="3" /><circle cx="55" cy="70" r="3.5" fill="var(--text)" /></g>}
      {id === "sharp" && <text x="60" y="64" textAnchor="middle" fontSize="64" fill="var(--text)" fontFamily="serif">♯</text>}
    </svg>
  );
}
function ScanTab({ user, consumeScan, askCoach }) {
  const [sel, setSel] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const sym = SYMBOLS.find((s) => s.id === sel);
  const scanSample = (s) => {
    if (!consumeScan()) return;
    setSel(s.id); setPreview(null); setResult(null); setPhase("scanning");
    setTimeout(() => { setResult({ name: s.name, meaning: s.meaning, how: s.how, lesson: s.lesson }); setPhase("done"); s.audio(); }, 1400);
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (!consumeScan()) return;
    const fr = new FileReader();
    fr.onload = async () => {
      const url = fr.result; setPreview(url); setSel(null); setResult(null); setPhase("scanning");
      try {
        const txt = await askClaude({
          system: "You are the visual music-symbol recognizer inside OpusKeys. Look at the image of sheet music or a musical symbol. Return ONLY JSON with keys: name (string), meaning (1-2 sentences), how (1 sentence on how to play it), lesson (string like 'Dynamics basics · 3 min'). If no symbol is visible, set name to 'No symbol found' and explain how to retake the photo in meaning.",
          messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: f.type || "image/jpeg", data: String(url).split(",")[1] } }, { type: "text", text: "Identify the main musical symbol or notation in this photo." }] }],
        });
        setResult(parseJSON(txt));
      } catch (err) { setResult({ name: "Couldn't read this photo", meaning: "The scanner needs a clear, well-lit close-up of one symbol or a short passage.", how: "Retake it with the symbol centered, and avoid glare on the page.", lesson: "Reading notation · 5 min" }); }
      setPhase("done");
    };
    fr.readAsDataURL(f);
  };
  return (
    <div style={{ padding: "6px 18px 24px", display: "grid", gap: 14 }}>
      <div><H size={30}>Visual key search</H><p style={{ ...muted, margin: "6px 0 0", lineHeight: 1.5 }}>Photograph any symbol you don't know. {user.pro ? "Unlimited scans on Pro." : `${user.scans} free scan${user.scans === 1 ? "" : "s"} left this month.`}</p></div>
      <div style={{ position: "relative", height: 210, borderRadius: 26, background: "var(--surface)", border: "1px solid var(--line)", overflow: "hidden", display: "grid", placeItems: "center" }}>
        {[["8%", "8%"], ["8%", "auto"], ["auto", "8%"], ["auto", "auto"]].map(([t, l], i) => (
          <div key={i} style={{ position: "absolute", top: t === "auto" ? undefined : t, bottom: t === "auto" ? "8%" : undefined, left: l === "auto" ? undefined : l, right: l === "auto" ? "8%" : undefined, width: 28, height: 28, borderTop: t !== "auto" ? "3px solid var(--accent)" : "none", borderBottom: t === "auto" ? "3px solid var(--accent)" : "none", borderLeft: l !== "auto" ? "3px solid var(--accent)" : "none", borderRight: l === "auto" ? "3px solid var(--accent)" : "none", borderRadius: 6 }} />
        ))}
        {preview ? <img src={preview} alt="Your upload" style={{ maxWidth: "70%", maxHeight: "70%", borderRadius: 10 }} /> : sym ? <div style={{ width: 150, height: 100 }}><SymbolArt id={sym.id} /></div> : <p style={{ ...muted, textAlign: "center", padding: "0 40px", lineHeight: 1.45, fontSize: 14 }}>Pick a sample symbol below, or upload a photo of your own sheet music.</p>}
        {phase === "scanning" && <div style={{ position: "absolute", left: "6%", right: "6%", height: 3, background: "var(--ui)", borderRadius: 2, animation: "ok-scan 1.2s ease-in-out infinite alternate", boxShadow: "0 0 14px var(--ui)" }} />}
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {SYMBOLS.map((s) => <button key={s.id} onClick={() => scanSample(s)} aria-label={`Scan ${s.name}`} style={{ flex: "0 0 74px", height: 58, borderRadius: 14, border: `1.5px solid ${sel === s.id ? "var(--accent)" : "var(--line)"}`, background: "var(--surface)", padding: 6 }}><SymbolArt id={s.id} /></button>)}
      </div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1.5px dashed var(--ui)", borderRadius: 999, padding: "13px 20px", fontWeight: 600, cursor: "pointer" }}>
        <Upload size={17} /> Upload a photo
        <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
      </label>
      {phase === "scanning" && <p style={{ ...muted, textAlign: "center", margin: 0 }}>Reading the symbol…</p>}
      {phase === "done" && result && (
        <Card style={{ borderRadius: 24, animation: "ok-rise .3s ease-out" }}>
          <div className="ok-display" style={{ fontSize: 24, fontWeight: 600 }}>{result.name}</div>
          <p style={{ margin: "8px 0", lineHeight: 1.5 }}>{result.meaning}</p>
          <p style={{ ...muted, margin: "0 0 14px", lineHeight: 1.5, fontSize: 14 }}>{result.how}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sym && <Btn variant="soft" icon={<Headphones size={16} />} onClick={sym.audio} style={{ padding: "9px 16px", fontSize: 14 }}>Hear it again</Btn>}
            <Btn variant="secondary" onClick={() => askCoach(`Teach me about this symbol: ${result.name}`)} style={{ padding: "9px 16px", fontSize: 14 }}>Mini-lesson: {result.lesson}</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────────── COACH ───────────────────────── */
function coachFallback(m) {
  const t = m.toLowerCase();
  if (t.includes("night")) return "Open Profile (the person icon, top right) and switch on Night practice mode. It swaps to a deep slate palette that's easier on the eyes late at night.";
  if (t.includes("arpeggio") || t.includes("drill")) return "Saved drills live in Learn. After any mastery test below 11 of 15, the 5-minute drill appears on your results screen. Retaking it won't overwrite your score history.";
  if (t.includes("dominant")) return "It's called dominant because it is built on the fifth degree of the scale, the “dominant.” In C major that's G7: G B D F. The F and B pull strongly toward E and C, which is why it makes the home chord feel like an arrival.";
  if (t.includes("thumb")) return "Pass the thumb under as your third finger plays the note before. Keep the hand quiet and move only the thumb, ahead of time. Practice slowly with the notes before the crossing as a loop.";
  return "I can't reach the AI service right now, but here's a good next step: choose the hardest two bars of your current piece, loop them at 60%, and play five clean repeats.";
}
function CoachTab({ user, seed, clearSeed, setDark }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi, I'm your OpusKeys coach. Ask me about theory, a passage that won't come together, or where something lives in the app." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const send = async (text) => {
    const t = (text ?? input).trim(); if (!t || busy) return;
    const next = [...msgs, { role: "user", content: t }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const reply = await askClaude({
        system: `You are the OpusKeys Assistant, an embedded piano and music-theory coach. The student is ${user.level}${user.track ? `, on the ${TRACKS[user.track].name} track` : ""}. Answer in 2 to 4 short sentences, concrete and encouraging, using plain language. App map for navigation questions: Night practice mode is a toggle in Profile (person icon, top right). Learn tab holds Grade 1 modules, mastery tests and tracks. Library holds scores and the AI song arranger. Scan tab is visual symbol search. Drills appear on the results screen after a mastery test under 11/15. Never invent features outside this map.`,
        messages: next.slice(1).map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e) { setMsgs([...next, { role: "assistant", content: coachFallback(t) }]); }
    setBusy(false);
  };
  useEffect(() => { if (seed) { send(seed); clearSeed(); } }, [seed]);
  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  const chips = ["How do I turn on night mode?", "Why is this chord called a Dominant Seventh?", "How do I do thumb-under in C major arpeggios?", "Explain binary form"];
  return (
    <div style={{ padding: "6px 18px 24px", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 150px)" }}>
      <H size={30} style={{ marginBottom: 12 }}>Coach</H>
      <div style={{ flex: 1, display: "grid", gap: 10, alignContent: "start" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ justifySelf: m.role === "user" ? "end" : "start", maxWidth: "88%", background: m.role === "user" ? "var(--accent)" : "var(--surface)", color: m.role === "user" ? "var(--onAccent)" : "var(--text)", border: m.role === "user" ? "none" : "1px solid var(--line)", borderRadius: m.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px", padding: "11px 15px", lineHeight: 1.5, whiteSpace: "pre-wrap", fontSize: 15 }}>{m.content}</div>
        ))}
        {busy && <div style={{ justifySelf: "start", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: "14px 18px", display: "flex", gap: 5 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 4, background: "var(--ui)", animation: `ok-dot 1.2s ${i * 0.2}s infinite` }} />)}</div>}
        <div ref={endRef} />
      </div>
      {msgs.length < 3 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0 4px" }}>{chips.map((c) => <button key={c} onClick={() => send(c)} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "7px 13px", fontSize: 13, textAlign: "left" }}>{c}</button>)}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, position: "sticky", bottom: 78 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask your coach" style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "13px 18px", fontSize: 15 }} />
        <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send" style={{ width: 48, height: 48, borderRadius: 24, background: "var(--accent)", border: "none", display: "grid", placeItems: "center", opacity: busy || !input.trim() ? 0.5 : 1 }}><Send size={18} color="var(--onAccent)" /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── PROFILE / PAYWALL / PITCH ───────────────────────── */
function Profile({ user, dark, setDark, onBack, setUser, retake, openPitch, openPaywall }) {
  const Row = ({ label, sub, children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{label}</div>{sub && <div style={{ ...muted, fontSize: 13, marginTop: 2 }}>{sub}</div>}</div>{children}
    </div>
  );
  const Toggle = ({ on, onClick }) => <button onClick={onClick} role="switch" aria-checked={on} style={{ width: 50, height: 30, borderRadius: 15, border: "none", background: on ? "var(--accent)" : "var(--line)", position: "relative" }}><span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: on ? "var(--onAccent)" : "var(--surface)", transition: "left .15s" }} /></button>;
  return (
    <Page title="Profile" onBack={onBack}>
      <Card style={{ borderRadius: 24 }}>
        <div className="ok-display" style={{ fontSize: 24, fontWeight: 600 }}>{user.level}</div>
        <div style={{ ...muted, marginTop: 2 }}>Musical Age {user.musicalAge} · {user.pro ? "OpusKeys Pro" : "Free plan"}</div>
        <Row label="Night practice mode" sub="Deep slate and chestnut for late sessions"><Toggle on={dark} onClick={() => setDark(!dark)} /></Row>
        <Row label="Plan" sub={user.pro ? "Pro: unlimited arrangements and scans" : "Free: Grade 1 and 3 scans a month"}>{user.pro ? <Pill>Active</Pill> : <Btn onClick={openPaywall} style={{ padding: "8px 14px", fontSize: 14 }}>Go Pro</Btn>}</Row>
        <Row label="Retake placement"><Btn variant="secondary" onClick={retake} style={{ padding: "8px 14px", fontSize: 14 }}>Retake</Btn></Row>
        <Row label="Investor snapshot"><Btn variant="secondary" onClick={openPitch} style={{ padding: "8px 14px", fontSize: 14 }}>Open</Btn></Row>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <b>Demo controls</b>
        <p style={{ ...muted, margin: "4px 0 10px", fontSize: 13, lineHeight: 1.45 }}>Jump the account around while you present.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LEVELS.map((l) => <button key={l} onClick={() => setUser((u) => ({ ...u, level: l, passed: autoPassed(l), track: null }))} style={{ border: `1px solid ${user.level === l ? "var(--accent)" : "var(--line)"}`, background: user.level === l ? "var(--sage)" : "transparent", borderRadius: 10, padding: "6px 11px", fontSize: 13, fontWeight: 600 }}>{l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <Btn variant="soft" onClick={() => setUser((u) => ({ ...u, passed: ["m1", "m2", "m3", "m4"] }))} style={{ padding: "8px 14px", fontSize: 13 }}>Complete Grade 1</Btn>
          <Btn variant="soft" onClick={() => setUser((u) => ({ ...u, pro: !u.pro }))} style={{ padding: "8px 14px", fontSize: 13 }}>{user.pro ? "Back to Free" : "Toggle Pro"}</Btn>
        </div>
      </Card>
    </Page>
  );
}

function Paywall({ onClose, onBuy }) {
  const [plan, setPlan] = useState("year");
  return (
    <Page title="OpusKeys Pro" onBack={onClose}>
      <H size={32}>Play the music you actually want to play.</H>
      <div style={{ display: "grid", gap: 10, margin: "18px 0" }}>
        {["Unlimited AI sheet-music arrangements at your level", "Full library playback", "Unlimited AI symbol scans", "Interactive mastery feedback while you play"].map((f) => (
          <div key={f} style={{ display: "flex", gap: 10, alignItems: "center" }}><Check size={18} color="var(--good)" /><span>{f}</span></div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {[["year", "Yearly", "$119", "about $9.92 a month · save 34%"], ["month", "Monthly", "$14.99", "billed every month"]].map(([k, n, p, s]) => (
          <button key={k} onClick={() => setPlan(k)} style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", background: plan === k ? "var(--sage)" : "var(--surface)", border: `1.5px solid ${plan === k ? "var(--accent)" : "var(--line)"}`, borderRadius: 18, padding: "15px 18px" }}>
            <div><b>{n}</b><div style={{ ...muted, fontSize: 13 }}>{s}</div></div><div className="ok-display" style={{ fontSize: 22, fontWeight: 600 }}>{p}</div>
          </button>
        ))}
      </div>
      <Btn onClick={onBuy} style={{ width: "100%", marginTop: 18 }}>Start 7-day free trial</Btn>
      <p style={{ ...muted, fontSize: 12, textAlign: "center", marginTop: 10 }}>Prototype: no payment is taken.</p>
    </Page>
  );
}

function Pitch({ onBack }) {
  const mk = [["Total market", "$12.8B", 100], ["Serviceable", "$3.4B", 51.5], ["Obtainable", "$180M", 11.9]];
  return (
    <Page title="Investor snapshot" onBack={onBack}>
      <H size={32}>The AI tutor that teaches you to read music, not just copy the keys.</H>
      <Card style={{ marginTop: 18 }}>
        <b>The problem</b>
        <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>In-person piano lessons cost over $3,000 a year. Gamified apps teach visual muscle memory, so learners plateau before they can read a score or understand harmony.</p>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <b>The product</b>
        <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>Classic solfège, an adaptive placement test, a mic-listening coach, symbol scanning, and an arranger that rewrites any song to the player's exact level. Everything in this prototype is live.</p>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <b>Market</b>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {mk.map(([l, v, w]) => (
            <div key={l}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}><span>{l}</span><b>{v}</b></div><div style={{ height: 10, background: "var(--sage)", borderRadius: 5 }}><div style={{ width: `${w}%`, height: "100%", background: "var(--accent)", borderRadius: 5 }} /></div></div>
          ))}
        </div>
        <p style={{ ...muted, fontSize: 12, margin: "10px 0 0" }}>Bar lengths are scaled by square root so the smaller markets stay visible.</p>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <b>Business model</b>
        <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>Free placement, Grade 1 and 3 scans a month. Pro at $14.99 a month or $119 a year unlocks arrangements, full library playback and unlimited scans.</p>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <b>Growth loop</b>
        <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>The placement test ends in a shareable Musical Age scorecard built from the player's 15 answers. Each share is an invitation to take the test.</p>
      </Card>
    </Page>
  );
}

/* ───────────────────────── APP SHELL ───────────────────────── */
const blankUser = { lessons: [], selfLevel: null, level: "Novice", answers: [], musicalAge: 12, track: null, passed: [], pro: false, scans: 3, streak: 1, arrangements: [] };

export default function App() {
  const [dark, setDark] = useState(false);
  const [stage, setStage] = useState("welcome");
  const [user, setUser] = useState(blankUser);
  const [tab, setTab] = useState("home");
  const [overlay, setOverlay] = useState(null);
  const [seed, setSeed] = useState(null);
  const theme = dark ? THEMES.dark : THEMES.light;
  const vars = Object.fromEntries(Object.entries(theme).map(([k, v]) => ["--" + k, v]));
  const allowed = ALLOWED_TIER[user.level];

  const finishDiag = (answers) => {
    const level = levelFrom(answers);
    const total = answers.filter((a) => a === "ok").length;
    setUser((u) => ({ ...u, answers, level, musicalAge: Math.round(5 + total * 1.8), passed: autoPassed(level) }));
    setStage("results");
  };
  const demo = () => { setUser({ ...blankUser, level: "Intermediate", answers: ["ok", "ok", "ok", "ok", "idk", "ok", "ok", "no", "ok", "ok", "no", "idk", "ok", "no", "idk"], musicalAge: 24, passed: autoPassed("Intermediate"), selfLevel: "Intermediate" }); setStage("app"); setTab("home"); };
  const openPaywall = () => setOverlay({ type: "paywall" });
  const requirePro = (cb) => (user.pro ? cb() : openPaywall());
  const consumeScan = () => {
    if (user.pro) return true;
    if (user.scans <= 0) { openPaywall(); return false; }
    setUser((u) => ({ ...u, scans: u.scans - 1 })); return true;
  };
  const openPiece = (p) => {
    if (p.tier > allowed) setOverlay({ type: "breakdown", piece: p });
    else if (!FREE_PIECES.includes(p.id) && !user.pro) openPaywall();
    else setOverlay({ type: "player", piece: p });
  };
  const openLesson = (id) => setOverlay({ type: "lesson", id });
  const askCoach = (text) => { setOverlay(null); setSeed(text); setTab("coach"); };
  const closeOverlay = () => setOverlay(null);
  const tabs = [["home", "Home", Home], ["learn", "Learn", BookOpen], ["library", "Library", LibraryIcon], ["scan", "Scan", ScanLine], ["coach", "Coach", MessageCircle]];

  let body;
  if (stage === "welcome" && overlay?.type !== "pitch") body = <Welcome onStart={() => setStage("self")} onDemo={demo} onPitch={() => setOverlay({ type: "pitch" })} />;
  else if (overlay?.type === "pitch") body = <Pitch onBack={closeOverlay} />;
  else if (stage === "self") body = <SelfAssess onPick={(l) => { setUser((u) => ({ ...u, selfLevel: l })); setStage("diag"); }} />;
  else if (stage === "diag") body = <Diagnostic onDone={finishDiag} />;
  else if (stage === "results") body = <Results user={user} onContinue={() => { setStage("app"); setTab("learn"); }} />;
  else if (overlay?.type === "test") {
    const mod = overlay.mod, isLast = MODULES[MODULES.length - 1].id === mod.id;
    body = <MasteryFlow key={mod.id + (overlay.n || 0)} mod={mod} isLast={isLast} onPass={(id) => setUser((u) => (u.passed.includes(id) ? u : { ...u, passed: [...u.passed, id] }))} onClose={() => { setOverlay(null); if (isLast && MODULES.every((m) => user.passed.includes(m.id) || m.id === mod.id)) setTab("learn"); }} />;
  }
  else if (overlay?.type === "lesson") {
    const L = LESSONS[overlay.id], mi = MODULES.findIndex((m) => m.id === overlay.id);
    const ni = MODULES.findIndex((m) => !user.passed.includes(m.id));
    body = <LessonPlayer key={overlay.id} id={overlay.id} lesson={L} isModule={mi >= 0} canTest={mi >= 0 && (user.passed.includes(overlay.id) || mi === ni)} onBack={closeOverlay} onTest={() => setOverlay({ type: "test", mod: MODULES[mi], n: Date.now() })} onDone={(id) => setUser((u) => (u.lessons.includes(id) ? u : { ...u, lessons: [...u.lessons, id] }))} askCoach={askCoach} />;
  }
  else if (overlay?.type === "player") body = <Player key={overlay.piece.id} piece={overlay.piece} allowed={allowed} onBack={closeOverlay} onOpenPiece={openPiece} onBreakdown={(p) => setOverlay({ type: "breakdown", piece: p })} />;
  else if (overlay?.type === "breakdown") body = <Breakdown key={overlay.piece.id} piece={overlay.piece} user={user} onBack={closeOverlay} />;
  else if (overlay?.type === "paywall") body = <Paywall onClose={closeOverlay} onBuy={() => { setUser((u) => ({ ...u, pro: true })); closeOverlay(); }} />;
  else if (overlay?.type === "profile") body = <Profile user={user} dark={dark} setDark={setDark} setUser={setUser} onBack={closeOverlay} retake={() => { setOverlay(null); setStage("self"); }} openPitch={() => setOverlay({ type: "pitch" })} openPaywall={openPaywall} />;
  else body = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 10px" }}>
        <div className="ok-display" style={{ fontSize: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 8, background: "var(--accent)", display: "grid", placeItems: "center" }}><Music size={14} color="var(--onAccent)" /></span>OpusKeys
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {user.pro && <Pill style={{ alignSelf: "center" }}><Crown size={11} /> Pro</Pill>}
          <button onClick={() => setDark(!dark)} aria-label="Toggle night practice mode" style={{ width: 38, height: 38, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", display: "grid", placeItems: "center" }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => setOverlay({ type: "profile" })} aria-label="Profile" style={{ width: 38, height: 38, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", display: "grid", placeItems: "center" }}><User size={18} /></button>
        </div>
      </div>
      {tab === "home" && <HomeTab user={user} allowed={allowed} setTab={setTab} openLesson={openLesson} openTest={(m) => setOverlay({ type: "test", mod: m, n: Date.now() })} openPiece={openPiece} openPaywall={openPaywall} askCoach={askCoach} />}
      {tab === "learn" && <LearnTab user={user} openLesson={openLesson} openTest={(m) => setOverlay({ type: "test", mod: m, n: Date.now() })} pickTrack={(k) => setUser((u) => ({ ...u, track: k }))} askCoach={askCoach} />}
      {tab === "library" && <LibraryTab user={user} allowed={allowed} openPiece={openPiece} requirePro={requirePro} saveArr={(a) => setUser((u) => ({ ...u, arrangements: [...u.arrangements, a] }))} />}
      {tab === "scan" && <ScanTab user={user} consumeScan={consumeScan} askCoach={askCoach} />}
      {tab === "coach" && <CoachTab user={user} seed={seed} clearSeed={() => setSeed(null)} setDark={setDark} />}
    </>
  );

  const showTabs = stage === "app" && !overlay;
  return (
    <div className="ok-root" style={vars}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", position: "relative", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
        <div style={{ flex: 1, paddingBottom: showTabs ? 78 : 0 }}>{body}</div>
        {showTabs && (
          <nav style={{ position: "sticky", bottom: 0, background: "var(--bg)", borderTop: "1px solid var(--line)", display: "flex", padding: "8px 6px 12px" }}>
            {tabs.map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)} aria-label={l} aria-current={tab === k ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", display: "grid", justifyItems: "center", gap: 3, padding: "6px 0", color: tab === k ? "var(--accent)" : "var(--muted)", fontWeight: tab === k ? 700 : 500, fontSize: 12 }}>
                <span style={{ background: tab === k ? "var(--sage)" : "transparent", borderRadius: 14, padding: "5px 16px", display: "grid", placeItems: "center" }}><Icon size={20} /></span>{l}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
