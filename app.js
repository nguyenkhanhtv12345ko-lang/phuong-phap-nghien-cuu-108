import { questions } from './questions.js';
import { createSpeechPlayer } from './speech.js?v=practice-menu';
import { answerLine, questionLines } from './speech-text.js?v=bilingual';
import { buildPractice, choiceRecording, labels, modes, originalChoices, presentQuestion, savedChoiceOrders, sets } from './practice.js?v=practice-menu';

const storageKey = 'ppnckh-luot-luyen-v1';
const byId = new Map(questions.map(question => [question.id, question]));
const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
const speech = createSpeechPlayer({
  button: ui['read-question'],
  voice: ui['speech-voice'],
  rate: ui['speech-rate'],
  volume: ui['speech-volume'],
  volumeValue: ui['speech-volume-value'],
  readOptions: ui['speech-options'],
  auto: ui['speech-auto'],
  status: ui['speech-status'],
  googleStatus: ui['google-voice-status'],
});

function readQuestion() {
  const id = session.order[session.cursor];
  const question = byId.get(id);
  if (!ui['speech-options'].checked) {
    speech.play([question.question], 'de-bai-' + question.id);
    return;
  }
  const order = choiceOrder(id);
  const shown = presentQuestion(question, order);
  const recordings = order === originalChoices ? undefined : [
    'de-bai-' + id,
    ...order.flatMap((_, position) => ['nhan-' + position, choiceRecording(shown, position, order)]),
  ];
  speech.play(questionLines(shown), 'cau-' + id, recordings);
}

function readAutomatically() {
  if (speech.automatic()) readQuestion();
  else speech.stop();
}

function newSession(practice = buildPractice('all', 'original')) {
  return { ...practice, cursor: 0, selected: {}, graded: {}, flagged: [], view: 'quiz' };
}

function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.order) || !saved.order.length ||
      new Set(saved.order).size !== saved.order.length || !saved.order.every(id => byId.has(id))) {
      return newSession();
    }
    const cleanAnswers = answers => Object.fromEntries(saved.order.flatMap(id => (
      Number.isInteger(answers?.[id]) && answers[id] >= 0 && answers[id] < 4 ? [[id, answers[id]]] : []
    )));
    const fallbackMode = saved.order.some((id, index) => index > 0 && id < saved.order[index - 1]) ? 'questions' : 'original';
    return {
      order: saved.order,
      setId: sets.some(set => set.id === saved.setId) ? saved.setId : 'all',
      modeId: modes.some(mode => mode.id === saved.modeId) ? saved.modeId : fallbackMode,
      choiceOrders: savedChoiceOrders(saved.choiceOrders, saved.order),
      cursor: Number.isInteger(saved.cursor) && saved.cursor >= 0 && saved.cursor < saved.order.length ? saved.cursor : 0,
      selected: cleanAnswers(saved.selected),
      graded: cleanAnswers(saved.graded),
      flagged: Array.isArray(saved.flagged) ? saved.flagged.filter(id => saved.order.includes(id)) : [],
      view: saved.view === 'results' ? 'results' : 'quiz',
    };
  } catch {
    return newSession();
  }
}

let session = readSession();

function choiceOrder(id) {
  return session.choiceOrders[id] ?? originalChoices;
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    ui['storage-status'].hidden = false;
  }
}

function statusOf(id) {
  if (!Object.hasOwn(session.graded, id)) return 'open';
  return session.graded[id] === byId.get(id).answer ? 'right' : 'wrong';
}

function renderChoices(question) {
  const status = statusOf(question.id);
  const checked = status !== 'open';
  const order = choiceOrder(question.id);
  const selected = order.indexOf(checked ? session.graded[question.id] : session.selected[question.id]);
  question = presentQuestion(question, order);
  [...ui.choices.children].slice(1).forEach(node => node.remove());
  question.options.forEach((option, index) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'choice';
    choice.dataset.answer = index;
    choice.disabled = checked;
    choice.setAttribute('aria-keyshortcuts', labels[index]);
    if (!checked && index === selected) choice.classList.add('pending');
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = labels[index];
    const text = document.createElement('span');
    text.textContent = option;
    choice.append(letter, text);
    if (checked && (index === question.answer || index === selected)) {
      const isCorrect = index === question.answer;
      choice.classList.add(isCorrect ? 'right' : 'wrong');
      const mark = document.createElement('span');
      mark.className = 'choice-state';
      mark.textContent = isCorrect ? '✓' : '×';
      mark.setAttribute('aria-label', isCorrect ? 'Đáp án đúng' : 'Đáp án sai');
      choice.append(mark);
    }
    ui.choices.append(choice);
  });
  ui.feedback.hidden = !checked;
  ui.feedback.className = 'feedback ' + status;
  ui.feedback.textContent = checked
    ? (status === 'right' ? 'Chính xác! ' : 'Chưa đúng. ') + 'Đáp án đúng là ' + labels[question.answer] + '. ' + question.options[question.answer]
    : '';
}

function renderProgress(counts) {
  const total = session.order.length;
  const done = counts.right + counts.wrong;
  ui.progress.max = total;
  ui.progress.value = done;
  ui['progress-value'].textContent = done + ' / ' + total;
  ui.correct.textContent = counts.right;
  ui.incorrect.textContent = counts.wrong;
  ui.remaining.textContent = counts.open;

  const filter = ui.filter.value;
  const mapScroll = ui.map.scrollTop;
  ui.map.replaceChildren();
  session.order.forEach((id, position) => {
    const status = statusOf(id);
    const flagged = session.flagged.includes(id);
    if (filter !== 'all' && (filter === 'flagged' ? !flagged : filter !== status)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile ' + status + (flagged ? ' flagged' : '');
    button.textContent = position + 1;
    button.dataset.position = position;
    const states = {right: 'đúng', wrong: 'sai', open: 'chưa chấm'};
    button.setAttribute('aria-label', 'Câu ' + (position + 1) + ', ' + states[status] + (flagged ? ', đã đánh dấu' : ''));
    if (position === session.cursor && session.view === 'quiz') button.setAttribute('aria-current', 'true');
    ui.map.append(button);
  });
  ui.map.scrollTop = mapScroll;
  const current = ui.map.querySelector('[aria-current=true]');
  if (current && (current.offsetTop < ui.map.offsetTop + mapScroll ||
      current.offsetTop + current.offsetHeight > ui.map.offsetTop + mapScroll + ui.map.clientHeight)) {
    ui.map.scrollTop = current.offsetTop - ui.map.offsetTop - ui.map.clientHeight / 2;
  }
  ui['map-empty'].hidden = ui.map.childElementCount > 0;
  ui.finish.setAttribute('aria-pressed', String(session.view === 'results'));
}

function renderResults(counts) {
  const total = session.order.length;
  const title = document.createElement('h2');
  title.id = 'result-title';
  title.tabIndex = -1;
  title.textContent = 'Kết quả luyện tập';
  const score = document.createElement('p');
  score.className = 'score';
  score.textContent = counts.right + '/' + total;
  const summary = document.createElement('p');
  summary.textContent = counts.right + ' đúng · ' + counts.wrong + ' sai · ' + counts.open + ' chưa chấm';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const back = document.createElement('button');
  back.className = 'button secondary';
  back.textContent = counts.open ? 'Tiếp tục luyện tập' : 'Xem lại đề';
  back.onclick = () => {
    const firstOpen = session.order.findIndex(id => statusOf(id) === 'open');
    goTo(firstOpen < 0 ? session.cursor : firstOpen);
  };
  actions.append(back);
  if (counts.wrong) {
    const retry = document.createElement('button');
    retry.className = 'button primary';
    retry.textContent = 'Luyện lại ' + counts.wrong + ' câu sai';
    retry.onclick = () => {
      session = newSession({
        setId: session.setId,
        modeId: session.modeId,
        order: session.order.filter(id => statusOf(id) === 'wrong'),
        choiceOrders: session.choiceOrders,
      });
      ui.filter.value = 'all';
      update(true);
      readAutomatically();
    };
    actions.append(retry);
  }
  ui.results.replaceChildren(title, score, summary, actions);
}

function render(focus = false) {
  const counts = {right: 0, wrong: 0, open: 0};
  session.order.forEach(id => counts[statusOf(id)]++);
  const set = sets.find(item => item.id === session.setId);
  const isReview = session.order.length !== set.end - set.start + 1;
  ui['current-practice'].textContent = isReview
    ? 'Ôn ' + session.order.length + ' câu sai'
    : set.label + (set.id === 'all' ? '' : ' · 27 câu');
  ui['question-card'].hidden = session.view !== 'quiz';
  ui.results.hidden = session.view !== 'results';
  if (session.view === 'quiz') {
    const question = byId.get(session.order[session.cursor]);
    ui.position.textContent = 'Câu ' + (session.cursor + 1) + ' / ' + session.order.length;
    ui.question.textContent = question.question;
    const flagged = session.flagged.includes(question.id);
    ui.bookmark.setAttribute('aria-pressed', String(flagged));
    ui.bookmark.textContent = flagged ? '★ Đã đánh dấu' : '☆ Đánh dấu';
    ui.previous.disabled = session.cursor === 0;
    ui.next.textContent = session.cursor === session.order.length - 1 ? 'Xem kết quả →' : 'Câu sau →';
    renderChoices(question);
    if (focus) ui.question.focus();
  } else {
    renderResults(counts);
    if (focus) ui.results.firstElementChild.focus();
  }
  renderProgress(counts);
}

function update(focus = false) {
  persist();
  render(focus);
}

function goTo(position) {
  session.cursor = position;
  session.view = 'quiz';
  update(true);
  readAutomatically();
}

function showResults() {
  speech.stop();
  session.view = 'results';
  update(true);
}

ui.choices.addEventListener('click', event => {
  const choice = event.target.closest('button[data-answer]');
  if (!choice) return;
  const id = session.order[session.cursor];
  if (Object.hasOwn(session.graded, id)) return;
  const order = choiceOrder(id);
  const question = presentQuestion(byId.get(id), order);
  const position = Number(choice.dataset.answer);
  session.graded[id] = order[position];
  update();
  const recordings = order === originalChoices ? undefined
    : ['dung-' + question.answer, choiceRecording(question, question.answer, order)];
  speech.play([answerLine(question)], 'dap-an-' + id, recordings);
  ui.next.focus();
});

ui['read-question'].onclick = () => {
  if (speech.playing()) speech.stop();
  else readQuestion();
};

ui.previous.onclick = () => { if (session.cursor > 0) goTo(session.cursor - 1); };
ui.next.onclick = () => {
  if (session.cursor === session.order.length - 1) showResults();
  else goTo(session.cursor + 1);
};
ui.finish.onclick = showResults;

document.addEventListener('keydown', event => {
  const target = event.target;
  if (session.view !== 'quiz' || ui['reset-dialog'].open || event.defaultPrevented ||
      event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      target.closest?.('input, select, textarea, summary, [contenteditable]:not([contenteditable=false])')) return;

  const {key} = event;
  if (key === ' ') {
    event.preventDefault();
    if (!event.repeat) ui['read-question'].click();
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    event.preventDefault();
    const position = session.cursor + (key === 'ArrowLeft' ? -1 : 1);
    if (!event.repeat && position >= 0 && position < session.order.length) goTo(position);
    return;
  }
  if (key === 'Enter') {
    const option = target.closest?.('button[data-answer]:enabled');
    if (event.repeat || option) event.preventDefault();
    if (!event.repeat) option?.click();
    return;
  }

  const options = [...ui.choices.querySelectorAll('button[data-answer]:enabled')];
  if (!options.length) return;
  if (/^[a-d]$/i.test(key)) {
    event.preventDefault();
    options[labels.indexOf(key.toUpperCase())].focus();
  } else if (key === 'ArrowUp' || key === 'ArrowDown') {
    event.preventDefault();
    const current = options.indexOf(document.activeElement);
    const next = key === 'ArrowDown' ? current + 1 : (current === -1 ? options.length - 1 : current - 1);
    options[(next + options.length) % options.length].focus();
  }
});

ui.bookmark.onclick = () => {
  const id = session.order[session.cursor];
  session.flagged = session.flagged.includes(id)
    ? session.flagged.filter(flag => flag !== id)
    : [...session.flagged, id];
  update();
};

ui.filter.onchange = () => {
  ui.map.scrollTop = 0;
  render();
};

ui.map.onclick = event => {
  const tile = event.target.closest('button[data-position]');
  if (tile) goTo(Number(tile.dataset.position));
};

const setSelect = ui['practice-set'];
const modeSelect = ui['practice-mode'];
for (const set of sets) {
  const label = set.id === 'all' ? 'Toàn bộ 108 câu' : set.label + ' · Câu ' + set.start + '–' + set.end;
  setSelect.add(new Option(label, set.id));
}
for (const mode of modes) modeSelect.add(new Option(mode.label, mode.id));

function choosePractice() {
  speech.stop();
  setSelect.value = session.setId;
  modeSelect.value = session.modeId;
  ui['reset-warning'].hidden = !Object.keys(session.graded).length && !session.flagged.length;
  ui['reset-dialog'].returnValue = '';
  ui['reset-dialog'].showModal();
}
ui.reset.onclick = choosePractice;
ui['choose-practice'].onclick = choosePractice;
ui['reset-dialog'].addEventListener('close', () => {
  if (ui['reset-dialog'].returnValue !== 'start') return;
  session = newSession(buildPractice(setSelect.value, modeSelect.value));
  ui.filter.value = 'all';
  update(true);
  readAutomatically();
});

render();
