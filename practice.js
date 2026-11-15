export const labels = 'ABCD';
export const originalChoices = [0, 1, 2, 3];

export const sets = [
  {id: 'all', label: '108 câu', start: 1, end: 108},
  {id: '1', label: 'Đề 1', start: 1, end: 27},
  {id: '2', label: 'Đề 2', start: 28, end: 54},
  {id: '3', label: 'Đề 3', start: 55, end: 81},
  {id: '4', label: 'Đề 4', start: 82, end: 108},
];

export const modes = [
  {id: 'original', label: 'Nguyên bản theo Word'},
  {id: 'questions', label: 'Chỉ đảo câu hỏi'},
  {id: 'choices', label: 'Chỉ đảo phương án trả lời'},
  {id: 'both', label: 'Đảo câu hỏi và phương án'},
];

function shuffled(values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result.every((value, i) => value === values[i])) {
    result.push(result.shift());
  }
  return result;
}

export function buildPractice(setId, modeId) {
  const set = sets.find(item => item.id === setId) ?? sets[0];
  const mode = modes.find(item => item.id === modeId) ?? modes[0];
  const ids = Array.from({length: set.end - set.start + 1}, (_, i) => set.start + i);
  const order = ['questions', 'both'].includes(mode.id) ? shuffled(ids) : ids;
  const choiceOrders = ['choices', 'both'].includes(mode.id)
    ? Object.fromEntries(ids.map(id => [id, shuffled(originalChoices)]))
    : {};
  return {setId: set.id, modeId: mode.id, order, choiceOrders};
}

export function savedChoiceOrders(data, order) {
  return Object.fromEntries(order.flatMap(id => {
    const indices = data?.[id];
    return Array.isArray(indices) && indices.length === 4 &&
      originalChoices.every(index => indices.includes(index)) ? [[id, indices]] : [];
  }));
}

const choiceReference = /^([A-D]) và ([A-D]) đều (đúng|sai)$/u;

export function presentQuestion(question, order) {
  if (order === originalChoices) return question;
  const options = order.map(index => {
    const option = question.options[index];
    return option.replace(choiceReference, (_, first, second, verdict) => {
      const mapped = [first, second].map(letter => order.indexOf(labels.indexOf(letter))).sort((a, b) => a - b);
      return labels[mapped[0]] + ' và ' + labels[mapped[1]] + ' đều ' + verdict;
    });
  });
  return {...question, options, answer: order.indexOf(question.answer)};
}

export function choiceRecording(question, position, order) {
  const reference = question.options[position].match(choiceReference);
  if (reference) {
    const [, first, second, verdict] = reference;
    return 'tham-chieu-' + first + second + '-' + (verdict === 'đúng' ? 'dung' : 'sai');
  }
  return 'phuong-an-' + question.id + '-' + order[position];
}
