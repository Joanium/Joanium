import path from 'path';
import Paths from '../Core/Paths.js';
import { ensureDir, fileExists, loadText, persistText, scanFiles } from '../Core/FileSystem.js';
const MARKDOWN_FILE_REGEX = /\.md$/i,
  HIDDEN_FILE_PREFIXES = ['Archive-', 'Legacy-', '_'],
  INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g,
  DEFAULT_MEMORY_FILES = [
    {
      filename: 'Memory.md',
      title: 'Memory',
      description:
        'Important facts, reminders, and notes the user has explicitly asked to remember long-term. Acts as a persistent sticky note across all conversations.',
      content: '# Memory\n',
    },
    {
      filename: 'User.md',
      title: 'User Profile',
      description:
        'Core identity details about the user — name, age, gender, location, nationality, languages spoken, and any other foundational biographical info.',
      content: '# User Profile\n',
    },
    {
      filename: 'Likes.md',
      title: 'Likes',
      description:
        'Things the user enjoys, prefers, or feels positively about — hobbies, foods, music, media, activities, topics, and general interests.',
      content: '# Likes\n',
    },
    {
      filename: 'Dislikes.md',
      title: 'Dislikes',
      description:
        "Things the user dislikes, finds annoying, or wants to avoid — topics, behaviors, foods, habits, or anything they've expressed negativity toward.",
      content: '# Dislikes\n',
    },
    {
      filename: 'Family.md',
      title: 'Family',
      description:
        "Details about the user's family members — parents, siblings, children, extended family — including names, relationships, and relevant context.",
      content: '# Family\n',
    },
    {
      filename: 'Friends.md',
      title: 'Friends',
      description:
        "Information about the user's close friends and social circle — names, how they're connected, and any relevant details about those relationships.",
      content: '# Friends\n',
    },
    {
      filename: 'Relationships.md',
      title: 'Relationships',
      description:
        'Romantic or significant personal relationships — partner details, relationship status, history, and any context needed to give thoughtful advice.',
      content: '# Relationships\n',
    },
    {
      filename: 'Education.md',
      title: 'Education',
      description:
        "The user's educational background — schools attended, degrees, fields of study, current courses, academic strengths, and learning style.",
      content: '# Education\n',
    },
    {
      filename: 'Career.md',
      title: 'Career',
      description:
        "The user's professional life — current job, role, company, industry, work history, skills, colleagues, and any ongoing career situations.",
      content: '# Career\n',
    },
    {
      filename: 'Goals.md',
      title: 'Goals',
      description:
        'Short-term and long-term goals the user is working toward — personal, professional, creative, financial, or health-related ambitions and milestones.',
      content: '# Goals\n',
    },
    {
      filename: 'Health.md',
      title: 'Health',
      description:
        "The user's physical health information — medical conditions, medications, allergies, diet restrictions, fitness level, and health-related concerns.",
      content: '# Health\n',
    },
    {
      filename: 'Wellbeing.md',
      title: 'Wellbeing',
      description:
        "The user's mental and emotional state — stress levels, mood patterns, mental health history, therapy, coping strategies, and overall life satisfaction.",
      content: '# Wellbeing\n',
    },
    {
      filename: 'Support.md',
      title: 'Support',
      description:
        'How the user prefers to be supported during hard times — whether they want advice, validation, distraction, or just to vent without judgment.',
      content: '# Support\n',
    },
    {
      filename: 'Communication.md',
      title: 'Communication',
      description:
        "The user's preferred communication style — tone (casual/formal), response length, use of humor, directness, and how they like information presented.",
      content: '# Communication\n',
    },
    {
      filename: 'Values.md',
      title: 'Values',
      description:
        "The user's core beliefs, ethics, and principles — what matters most to them in life, morally and personally, including cultural or religious values.",
      content: '# Values\n',
    },
    {
      filename: 'Habits.md',
      title: 'Habits',
      description:
        "The user's daily routines and recurring behaviors — sleep schedule, morning/evening rituals, productive habits, and habits they're trying to build or break.",
      content: '# Habits\n',
    },
    {
      filename: 'Wishlist.md',
      title: 'Wishlist',
      description:
        "Things the user wants to buy, experience, or receive — products, experiences, gifts, or upgrades they've mentioned wanting at some point.",
      content: '# Wishlist\n',
    },
    {
      filename: 'Routines.md',
      title: 'Daily Routines',
      description:
        "A breakdown of the user's typical day — wake time, morning and night routines, meal times, workout schedule, and how structured or flexible their day tends to be.",
      content: '# Daily Routines\n',
    },
    {
      filename: 'Fashion.md',
      title: 'Fashion & Style',
      description:
        "The user's personal style, clothing preferences, brands they like, how much they care about appearance, and any aesthetic they gravitate toward.",
      content: '# Fashion & Style\n',
    },
    {
      filename: 'Learning.md',
      title: 'Learning & Development',
      description:
        'Courses, books, certifications, or skills the user is actively studying or wants to learn — including platforms they use (Coursera, YouTube, etc.) and their learning pace.',
      content: '# Learning & Development\n',
    },
    {
      filename: 'Meetings.md',
      title: 'Meetings & Commitments',
      description:
        'Recurring or important meetings, deadlines, and professional commitments the user has mentioned — useful context for scheduling, prepping, or following up.',
      content: '# Meetings & Commitments\n',
    },
    {
      filename: 'WorkChallenges.md',
      title: 'Work Challenges',
      description:
        'Current or recurring challenges at work — difficult colleagues, unclear direction, imposter syndrome, workload issues, or anything making their professional life harder.',
      content: '# Work Challenges\n',
    },
    {
      filename: 'WorkStyle.md',
      title: 'Work Style',
      description:
        'How the user works best — deep focus vs collaborative, morning vs night, remote vs office, how they handle stress at work, and what environments make them most productive.',
      content: '# Work Style\n',
    },
    {
      filename: 'ImportantDates.md',
      title: 'Important Dates',
      description:
        "Key dates in the user's life — birthdays, anniversaries, deadlines, holidays they celebrate, and other recurring or one-time dates that matter.",
      content: '# Important Dates\n',
    },
    {
      filename: 'Finance.md',
      title: 'Finance',
      description:
        "The user's financial situation — income range, savings, expenses, debts, financial goals, spending habits, and any money-related concerns or context.",
      content: '# Finance\n',
    },
    {
      filename: 'Astrology.md',
      title: 'Astrology',
      description:
        "The user's astrological details — sun, moon, and rising signs, birth chart info, and how much they engage with or believe in astrology.",
      content: '# Astrology\n',
    },
    {
      filename: 'Workspace.md',
      title: 'Workspace',
      description:
        "The user's physical and digital work setup — devices, tools, apps, home office or workplace environment, and any setup preferences.",
      content: '# Workspace\n',
    },
    {
      filename: 'Personality.md',
      title: 'Personality',
      description:
        "The user's personality traits and self-perception — introvert/extrovert, MBTI or Enneagram type, how they describe themselves, and how others see them.",
      content: '# Personality\n',
    },
    {
      filename: 'Pets.md',
      title: 'Pets',
      description:
        "Details about the user's pets — species, names, ages, and any relevant context about their role in the user's life.",
      content: '# Pets\n',
    },
    {
      filename: 'Travel.md',
      title: 'Travel',
      description:
        "The user's travel history, upcoming trips, dream destinations, travel style (budget vs luxury, solo vs group), and how often they travel.",
      content: '# Travel\n',
    },
    {
      filename: 'Entertainment.md',
      title: 'Entertainment',
      description:
        'Media the user consumes and enjoys — favorite movies, shows, books, podcasts, games, music genres, and artists they follow.',
      content: '# Entertainment\n',
    },
    {
      filename: 'Skills.md',
      title: 'Skills',
      description:
        "Practical and creative skills the user has — professional expertise, hobbies they're good at, languages spoken, instruments played, or things they're currently learning.",
      content: '# Skills\n',
    },
    {
      filename: 'Projects.md',
      title: 'Projects',
      description:
        'Active or ongoing personal and professional projects the user is working on — context, progress, goals, blockers, and collaborators involved.',
      content: '# Projects\n',
    },
    {
      filename: 'Context.md',
      title: 'Current Context',
      description:
        "What's going on in the user's life right now — recent events, current mood, active stressors, life phase, or anything that gives the AI situational awareness.",
      content: '# Current Context\n',
    },
    {
      filename: 'Humor.md',
      title: 'Humor',
      description:
        "The user's sense of humor — what makes them laugh, their comedic style (dry, sarcastic, absurd, dark), and humor they dislike or find offensive.",
      content: '# Humor\n',
    },
    {
      filename: 'Food.md',
      title: 'Food & Diet',
      description:
        "The user's food preferences, dietary restrictions, cuisine favorites, cooking habits, and any foods they love or absolutely avoid.",
      content: '# Food & Diet\n',
    },
    {
      filename: 'Secrets.md',
      title: 'Secrets & Confessions',
      description:
        'Private thoughts, confessions, or sensitive information the user has shared in confidence — to be handled with care and never brought up unsolicited.',
      content: '# Secrets & Confessions\n',
    },
    {
      filename: 'LivingSituation.md',
      title: 'Living Situation',
      description:
        'Where and how the user lives — city, neighborhood, type of home, who they live with (alone, roommates, family, partner), and how they feel about their current living arrangement.',
      content: '# Living Situation\n',
    },
    {
      filename: 'Fears.md',
      title: 'Fears & Insecurities',
      description:
        "Things the user is afraid of or feels insecure about — phobias, social anxieties, deep-seated worries, and recurring self-doubt patterns they've shared.",
      content: '# Fears & Insecurities\n',
    },
    {
      filename: 'Dreams.md',
      title: 'Dreams & Aspirations',
      description:
        "The user's big-picture dreams that go beyond goals — bucket list items, fantasy life scenarios, things they'd do if money or time weren't a constraint.",
      content: '# Dreams & Aspirations\n',
    },
    {
      filename: 'Struggles.md',
      title: 'Personal Struggles',
      description:
        'Ongoing personal challenges the user is dealing with — emotional, social, situational, or existential. Helps the AI give empathetic, contextually aware responses.',
      content: '# Personal Struggles\n',
    },
    {
      filename: 'SocialLife.md',
      title: 'Social Life',
      description:
        'How the user socializes — frequency, preferred settings (parties vs small hangouts), social energy levels, current social satisfaction, and any ongoing social dynamics.',
      content: '# Social Life\n',
    },
  ],
  DEFAULT_FILE_ORDER = new Map(
    DEFAULT_MEMORY_FILES.map((entry, index) => [entry.filename.toLowerCase(), index]),
  ),
  DEFAULT_FILE_META = new Map(
    DEFAULT_MEMORY_FILES.map((entry) => [entry.filename.toLowerCase(), entry]),
  );
function normalizeFilename(value, fallback = '') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/\.md$/i, '')
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!cleaned && !fallback) throw new Error('Memory filename is required.');
  const filename = `${cleaned || String(fallback).replace(/\.md$/i, '')}.md`;
  if (!MARKDOWN_FILE_REGEX.test(filename)) throw new Error('Memory filename must end with .md');
  if (HIDDEN_FILE_PREFIXES.some((prefix) => filename.startsWith(prefix)))
    throw new Error('Hidden memory filenames are reserved.');
  return filename;
}
function buildMemoryPath(filename) {
  return (
    initializePersonalMemoryLibrary(),
    path.join(Paths.MEMORIES_DIR, normalizeFilename(filename))
  );
}
function isVisibleMemoryFilename(filename) {
  return (
    MARKDOWN_FILE_REGEX.test(filename) &&
    !HIDDEN_FILE_PREFIXES.some((prefix) => filename.startsWith(prefix))
  );
}
function getTemplateMeta(filename) {
  const normalized = String(filename ?? '').toLowerCase();
  return DEFAULT_FILE_META.get(normalized) ?? null;
}
function countBulletLines(content = '') {
  return String(content)
    .split('\n')
    .filter((line) => /^\s*[-*]\s+/.test(line)).length;
}
function stripHeading(content = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  return (lines[0]?.trim().startsWith('#') && lines.shift(), lines.join('\n').trim());
}
function hasMeaningfulMemoryContent(content = '') {
  return Boolean(stripHeading(content));
}
function buildTitleFromFilename(filename) {
  return String(filename ?? '')
    .replace(/\.md$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}
function normalizeForComparison(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function finalizeMemoryContent(content, filename) {
  const meta = getTemplateMeta(filename),
    fallbackHeading = `# ${meta?.title ?? buildTitleFromFilename(filename)}`,
    base =
      String(content ?? '')
        .replace(/\r\n/g, '\n')
        .trim() ||
      String(meta?.content ?? `${fallbackHeading}\n\n`)
        .replace(/\r\n/g, '\n')
        .trim();
  return `${(function (lines = []) {
    const next = [];
    let previousBlank = !1;
    for (const line of lines) {
      const isBlank = !line.trim();
      (isBlank && previousBlank) || (next.push(line), (previousBlank = isBlank));
    }
    return next;
  })(
    (function (lines = []) {
      const seen = new Set(),
        next = [];
      for (const line of lines) {
        const match = line.match(/^(\s*[-*]\s+)(.+)$/);
        if (!match) {
          next.push(line);
          continue;
        }
        const normalized = normalizeForComparison(match[2]);
        normalized &&
          !seen.has(normalized) &&
          (seen.add(normalized), next.push(`${match[1]}${match[2].trim()}`));
      }
      return next;
    })((base.startsWith('#') ? base : `${fallbackHeading}\n\n${base}`).split('\n')),
  )
    .join('\n')
    .trim()}\n`;
}
function getVisibleMemoryEntries() {
  const filenames = (initializePersonalMemoryLibrary(),
  scanFiles(Paths.MEMORIES_DIR, (entry) => MARKDOWN_FILE_REGEX.test(entry.name)).map((fullPath) =>
    path.basename(fullPath),
  )).filter(isVisibleMemoryFilename);
  return [...new Set(filenames)]
    .map((filename) => {
      const meta = getTemplateMeta(filename),
        content = loadText(path.join(Paths.MEMORIES_DIR, filename), ''),
        trimmed = content.trim();
      return {
        filename: filename,
        title: meta?.title ?? buildTitleFromFilename(filename),
        description: meta?.description ?? 'Custom personal memory file.',
        content: content,
        empty: !hasMeaningfulMemoryContent(trimmed),
        bulletCount: countBulletLines(trimmed),
        lineCount: hasMeaningfulMemoryContent(trimmed)
          ? stripHeading(trimmed).split(/\r?\n/).length
          : 0,
      };
    })
    .sort(
      (left, right) =>
        (DEFAULT_FILE_ORDER.get(left.filename.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
          (DEFAULT_FILE_ORDER.get(right.filename.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) ||
        left.filename.localeCompare(right.filename),
    );
}
export function initializePersonalMemoryLibrary() {
  ensureDir(Paths.MEMORIES_DIR);
  for (const entry of DEFAULT_MEMORY_FILES) {
    const filePath = path.join(Paths.MEMORIES_DIR, entry.filename);
    fileExists(filePath) ||
      persistText(filePath, entry.content, { normalizeLineEndings: !0, finalNewline: !0 });
  }
}
export function listPersonalMemoryFiles() {
  return getVisibleMemoryEntries().map(({ content: _content, ...entry }) => entry);
}
export function searchPersonalMemory(query, limit = 5) {
  const terms = (function (query = '') {
    return normalizeForComparison(query)
      .split(' ')
      .map((term) => term.trim())
      .filter(Boolean);
  })(query);
  return terms.length
    ? getVisibleMemoryEntries()
        .map((entry) => {
          const haystacks = [
            normalizeForComparison(entry.filename),
            normalizeForComparison(stripHeading(entry.content)),
          ];
          let score = 0;
          for (const term of terms)
            (haystacks[0].includes(term) && (score += 6),
              haystacks[1].includes(term) && (score += 5));
          const matchingLines = (function (content = '', terms = []) {
            if (!terms.length) return [];
            const matches = [];
            for (const line of String(content).split(/\r?\n/)) {
              const normalized = normalizeForComparison(line);
              if (
                normalized &&
                (terms.some((term) => normalized.includes(term)) && matches.push(line.trim()),
                matches.length >= 3)
              )
                break;
            }
            return matches;
          })(entry.content, terms);
          return (
            (score += 3 * matchingLines.length),
            {
              filename: entry.filename,
              title: entry.title,
              description: entry.description,
              score: score,
              matches: matchingLines,
            }
          );
        })
        .filter((entry) => entry.score > 0)
        .sort(
          (left, right) => right.score - left.score || left.filename.localeCompare(right.filename),
        )
        .slice(0, Math.min(Math.max(Number(limit) || 5, 1), 12))
    : [];
}
export function readPersonalMemoryFiles(filenames = []) {
  const requested = Array.isArray(filenames) ? filenames : [filenames];
  return [...new Set(requested.map((filename) => normalizeFilename(filename)))].map((filename) => {
    const filePath = buildMemoryPath(filename),
      meta = getTemplateMeta(filename);
    return {
      filename: filename,
      title: meta?.title ?? buildTitleFromFilename(filename),
      description: meta?.description ?? 'Custom personal memory file.',
      content: loadText(filePath, ''),
    };
  });
}
export function readPersonalMemoryCatalog() {
  return getVisibleMemoryEntries();
}
export function applyPersonalMemoryUpdates(payload = {}) {
  const entries = [
      ...(Array.isArray(payload.updates) ? payload.updates : []),
      ...(Array.isArray(payload.newFiles) ? payload.newFiles : []),
    ],
    touched = [];
  for (const entry of entries) {
    const filename = normalizeFilename(entry?.filename),
      filePath = buildMemoryPath(filename),
      created = !fileExists(filePath),
      nextContent = finalizeMemoryContent(entry?.content, filename);
    persistText(filePath, nextContent, { normalizeLineEndings: !0, finalNewline: !0 });
    const meta = getTemplateMeta(filename);
    touched.push({
      filename: filename,
      title: meta?.title ?? buildTitleFromFilename(filename),
      created: created,
    });
  }
  return touched;
}
export function readPinnedMemory() {
  return (initializePersonalMemoryLibrary(), loadText(Paths.MEMORY_FILE, ''));
}
export function writePinnedMemory(content) {
  (initializePersonalMemoryLibrary(),
    persistText(Paths.MEMORY_FILE, finalizeMemoryContent(content, 'Memory.md'), {
      normalizeLineEndings: !0,
      finalNewline: !0,
    }));
}
