const spokenLabels = ['a', 'bê', 'xê', 'đê'];

// Match complete terms so Vietnamese words without accent marks stay in context.
const englishTerms = [
  'E-Learning', 'SMART', 'AND', 'IEEE Xplore', 'ScienceDirect', 'Wikipedia', 'SpringerLink',
  'Layered Reading', 'Skimming', 'Scanning', 'Deep Reading', 'Discussion',
  'Specific', 'Measurable', 'Realistic', 'Expressive',
  'Normalization', 'Data Cleaning', 'Data Augmentation', 'Feature Engineering',
  'Pie Chart', 'Bar Chart', 'Line Chart', 'Scatter Plot',
  'Cornell Note-Taking', 'Mind Mapping', 'SQ3R', 'Survey, Question, Read, Recite, Review',
  'Bullet Points', 'Big Data', 'Deep Learning', 'Monte Carlo', 'AI', 'API', 'CPU',
  'Pseudocode', 'Correctness', 'Efficiency', 'Generality', 'Clarity', 'Deterministic', 'Flowchart',
  'Normal Distribution', 'Right-skewed', 'Outliers', 'Descriptive and Statistical',
  'Mean', 'Median', 'Variance, Standard Deviation', 'Quartiles',
  'Paraphrasing', 'Self-plagiarism', 'Copyright Infringement',
  'BibTeX', 'LaTeX', 'VS Code', 'Overleaf', 'TeXworks', 'MiKTeX', 'Visual Studio', 'Google Docs',
  'Word', 'logic', 'camera',
];
const pronunciations = new Map([
  ['AI', 'A I'], ['API', 'A P I'], ['CPU', 'C P U'], ['SQ3R', 'S Q three R'],
  ['IEEE Xplore', 'I triple E Explore'], ['SMART', 'smart'], ['AND', 'and'],
  ['LaTeX', 'Lay tech'], ['BibTeX', 'Bib tech'], ['TeXworks', 'Tech Works'], ['MiKTeX', 'Mick Tech'],
  ['ScienceDirect', 'Science Direct'], ['SpringerLink', 'Springer Link'],
  ['\\bibliographystyle{}', 'bibliography style'], ['\\bibitem{}', 'bib item'],
  ['\\bibstyle{}', 'bib style'], ['\\maketitle', 'make title'], ['[h]', 'H'],
]);
const escapePattern = term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const englishPattern = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' +
  englishTerms.sort((a, b) => b.length - a.length).map(escapePattern).join('|') +
  '|\\\\[a-z]+(?:\\{[a-z]*\\})?|\\[h\\])(?![\\p{L}\\p{N}])', 'gu',
);

export function questionLines(question) {
  return [question.question, ...question.options.map((text, index) => 'Phương án ' + spokenLabels[index] + '. ' + text)];
}

export function answerLine(question) {
  return 'Đáp án đúng là ' + spokenLabels[question.answer] + '. ' + question.options[question.answer];
}

export function splitSpeech(line) {
  const segments = [];
  let offset = 0;
  function append(language, text) {
    const phrase = text.trim()
      .replace(/^[(),"'“”‘’\s]+|[()"'“”‘’\s]+$/gu, '')
      .replace(/\)(?=[.!?,;:]$)/u, '')
      .trim();
    if (/[\p{L}\p{N}&]/u.test(phrase)) segments.push({language, text: phrase});
  }
  for (const match of line.matchAll(englishPattern)) {
    const term = match[0];
    append('vi', line.slice(offset, match.index));
    const code = term.startsWith('\\') ? term.slice(1).replace(/\{([a-z]*)\}/, ' $1') : term;
    append('en', pronunciations.get(term) ?? code);
    offset = match.index + term.length;
  }
  append('vi', line.slice(offset));
  for (const segment of segments) {
    if (segment.language === 'vi') segment.text = segment.text.replace(/\bCNTT\b/g, 'công nghệ thông tin').replace(/&/g, 'và');
  }
  return segments;
}
