// Bible Verse Extractor - Detects and normalizes Bible verse references in text

// Book name mappings (abbreviations to full names)
const BOOK_MAPPINGS: Record<string, string> = {
  // Old Testament
  'gen': 'Genesis', 'ge': 'Genesis', 'gn': 'Genesis',
  'ex': 'Exodus', 'exo': 'Exodus', 'exod': 'Exodus',
  'lev': 'Leviticus', 'le': 'Leviticus', 'lv': 'Leviticus',
  'num': 'Numbers', 'nu': 'Numbers', 'nm': 'Numbers',
  'deut': 'Deuteronomy', 'de': 'Deuteronomy', 'dt': 'Deuteronomy',
  'josh': 'Joshua', 'jos': 'Joshua',
  'judg': 'Judges', 'jdg': 'Judges', 'jg': 'Judges',
  'ruth': 'Ruth', 'ru': 'Ruth',
  '1sam': '1 Samuel', '1sa': '1 Samuel', '1 sam': '1 Samuel',
  '2sam': '2 Samuel', '2sa': '2 Samuel', '2 sam': '2 Samuel',
  '1kgs': '1 Kings', '1ki': '1 Kings', '1 kings': '1 Kings', '1 kgs': '1 Kings',
  '2kgs': '2 Kings', '2ki': '2 Kings', '2 kings': '2 Kings', '2 kgs': '2 Kings',
  '1chr': '1 Chronicles', '1ch': '1 Chronicles', '1 chron': '1 Chronicles',
  '2chr': '2 Chronicles', '2ch': '2 Chronicles', '2 chron': '2 Chronicles',
  'ezra': 'Ezra', 'ezr': 'Ezra',
  'neh': 'Nehemiah', 'ne': 'Nehemiah',
  'esth': 'Esther', 'est': 'Esther', 'es': 'Esther',
  'job': 'Job', 'jb': 'Job',
  'ps': 'Psalm', 'psa': 'Psalm', 'psalm': 'Psalm', 'psalms': 'Psalm',
  'prov': 'Proverbs', 'pr': 'Proverbs', 'prv': 'Proverbs',
  'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ec': 'Ecclesiastes',
  'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'sg': 'Song of Solomon',
  'isa': 'Isaiah', 'is': 'Isaiah',
  'jer': 'Jeremiah', 'je': 'Jeremiah',
  'lam': 'Lamentations', 'la': 'Lamentations',
  'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ez': 'Ezekiel',
  'dan': 'Daniel', 'da': 'Daniel', 'dn': 'Daniel',
  'hos': 'Hosea', 'ho': 'Hosea',
  'joel': 'Joel', 'jl': 'Joel',
  'amos': 'Amos', 'am': 'Amos',
  'obad': 'Obadiah', 'ob': 'Obadiah',
  'jonah': 'Jonah', 'jon': 'Jonah',
  'mic': 'Micah', 'mi': 'Micah',
  'nah': 'Nahum', 'na': 'Nahum',
  'hab': 'Habakkuk',
  'zeph': 'Zephaniah', 'zep': 'Zephaniah',
  'hag': 'Haggai',
  'zech': 'Zechariah', 'zec': 'Zechariah',
  'mal': 'Malachi',
  
  // New Testament
  'matt': 'Matthew', 'mt': 'Matthew', 'mat': 'Matthew',
  'mark': 'Mark', 'mk': 'Mark', 'mr': 'Mark',
  'luke': 'Luke', 'lk': 'Luke', 'lu': 'Luke',
  'john': 'John', 'jn': 'John', 'jhn': 'John',
  'acts': 'Acts', 'ac': 'Acts',
  'rom': 'Romans', 'ro': 'Romans', 'rm': 'Romans',
  '1cor': '1 Corinthians', '1co': '1 Corinthians', '1 cor': '1 Corinthians',
  '2cor': '2 Corinthians', '2co': '2 Corinthians', '2 cor': '2 Corinthians',
  'gal': 'Galatians', 'ga': 'Galatians',
  'eph': 'Ephesians',
  'phil': 'Philippians', 'php': 'Philippians',
  'col': 'Colossians',
  '1thess': '1 Thessalonians', '1th': '1 Thessalonians', '1 thess': '1 Thessalonians',
  '2thess': '2 Thessalonians', '2th': '2 Thessalonians', '2 thess': '2 Thessalonians',
  '1tim': '1 Timothy', '1ti': '1 Timothy', '1 tim': '1 Timothy',
  '2tim': '2 Timothy', '2ti': '2 Timothy', '2 tim': '2 Timothy',
  'titus': 'Titus', 'tit': 'Titus',
  'phlm': 'Philemon', 'phm': 'Philemon', 'philem': 'Philemon',
  'heb': 'Hebrews',
  'james': 'James', 'jas': 'James', 'jm': 'James',
  '1pet': '1 Peter', '1pe': '1 Peter', '1 pet': '1 Peter', '1 peter': '1 Peter',
  '2pet': '2 Peter', '2pe': '2 Peter', '2 pet': '2 Peter', '2 peter': '2 Peter',
  '1john': '1 John', '1jn': '1 John', '1 john': '1 John', '1 jn': '1 John',
  '2john': '2 John', '2jn': '2 John', '2 john': '2 John', '2 jn': '2 John',
  '3john': '3 John', '3jn': '3 John', '3 john': '3 John', '3 jn': '3 John',
  'jude': 'Jude',
  'rev': 'Revelation', 're': 'Revelation', 'rv': 'Revelation',
  
  // Full names (already normalized - only those not already defined above)
  'genesis': 'Genesis', 'exodus': 'Exodus', 'leviticus': 'Leviticus',
  'numbers': 'Numbers', 'deuteronomy': 'Deuteronomy', 'joshua': 'Joshua',
  'judges': 'Judges', 'nehemiah': 'Nehemiah', 'esther': 'Esther',
  'proverbs': 'Proverbs', 'ecclesiastes': 'Ecclesiastes',
  'song of solomon': 'Song of Solomon', 'isaiah': 'Isaiah', 'jeremiah': 'Jeremiah',
  'lamentations': 'Lamentations', 'ezekiel': 'Ezekiel', 'daniel': 'Daniel',
  'hosea': 'Hosea', 'obadiah': 'Obadiah', 'micah': 'Micah',
  'nahum': 'Nahum', 'habakkuk': 'Habakkuk', 'zephaniah': 'Zephaniah',
  'haggai': 'Haggai', 'zechariah': 'Zechariah', 'malachi': 'Malachi',
  'matthew': 'Matthew', 'romans': 'Romans',
  '1 corinthians': '1 Corinthians', '2 corinthians': '2 Corinthians',
  'galatians': 'Galatians', 'ephesians': 'Ephesians', 'philippians': 'Philippians',
  'colossians': 'Colossians', '1 thessalonians': '1 Thessalonians',
  '2 thessalonians': '2 Thessalonians', '1 timothy': '1 Timothy',
  '2 timothy': '2 Timothy', 'philemon': 'Philemon', 'hebrews': 'Hebrews',
  'revelation': 'Revelation',
};

export interface ExtractedVerse {
  verseRef: string;     // Normalized reference: "Matthew 6:21"
  book: string;         // Full book name: "Matthew"
  chapter: number;      // Chapter number: 6
  verseStart: number;   // Starting verse: 21
  verseEnd?: number;    // Ending verse (for ranges): undefined or 25
  originalText: string; // Original matched text: "Matt 6:21"
}

/**
 * Extract Bible verse references from text
 * Handles various formats:
 * - "Matt 6:21", "Matthew 6:21"
 * - "Ps 23:1-4", "Psalm 23:1-4"
 * - "1 Cor 13:4-7", "1 Corinthians 13:4-7"
 * - "(John 3:16)", "John 3:16"
 */
export function extractVerses(text: string): ExtractedVerse[] {
  const verses: ExtractedVerse[] = [];
  
  // Pattern to match Bible verse references
  // Matches: [optional number] [book name/abbrev] [chapter]:[verse(s)]
  const versePattern = /\(?(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d{1,3})\s*[:\.]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\)?/gi;
  
  let match;
  while ((match = versePattern.exec(text)) !== null) {
    const [originalText, bookPart, chapterStr, verseStartStr, verseEndStr] = match;
    
    // Normalize book name
    const bookLower = bookPart.toLowerCase().trim();
    const normalizedBook = BOOK_MAPPINGS[bookLower];
    
    if (!normalizedBook) {
      // Not a recognized book name
      continue;
    }
    
    const chapter = parseInt(chapterStr, 10);
    const verseStart = parseInt(verseStartStr, 10);
    const verseEnd = verseEndStr ? parseInt(verseEndStr, 10) : undefined;
    
    // Create normalized reference
    const verseRef = verseEnd 
      ? `${normalizedBook} ${chapter}:${verseStart}-${verseEnd}`
      : `${normalizedBook} ${chapter}:${verseStart}`;
    
    verses.push({
      verseRef,
      book: normalizedBook,
      chapter,
      verseStart,
      verseEnd,
      originalText: originalText.trim(),
    });
  }
  
  // Remove duplicates (same verseRef)
  const uniqueVerses = verses.filter((verse, index, self) => 
    index === self.findIndex(v => v.verseRef === verse.verseRef)
  );
  
  return uniqueVerses;
}

/**
 * Format a list of verse references for display
 */
export function formatVerseList(verses: ExtractedVerse[]): string {
  return verses.map(v => v.verseRef).join(', ');
}

/**
 * Check if two verses overlap (for detecting similar references)
 */
export function versesOverlap(v1: ExtractedVerse, v2: ExtractedVerse): boolean {
  if (v1.book !== v2.book || v1.chapter !== v2.chapter) {
    return false;
  }
  
  const v1End = v1.verseEnd || v1.verseStart;
  const v2End = v2.verseEnd || v2.verseStart;
  
  return v1.verseStart <= v2End && v2.verseStart <= v1End;
}
