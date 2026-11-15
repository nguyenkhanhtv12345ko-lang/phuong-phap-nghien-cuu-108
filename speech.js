import { splitSpeech } from './speech-text.js?v=bilingual';

const storageKey = 'ppnckh-giong-doc-v1';
const builtIn = 'built-in';
const googleLabel = 'Google Tiếng Việt';
const audioVersion = '?v=bilingual';

function isGoogleVoice(voice) {
  return /\bGoogle\b/i.test(voice.name) || /\bcom\.google\.android\.tts\b/i.test(voice.voiceURI);
}

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? {};
  } catch {
    return {};
  }
}

export function createSpeechPlayer({button, voice, rate, volume, volumeValue, readOptions, auto, status, googleStatus}) {
  const preferences = loadPreferences();
  const synthesis = window.speechSynthesis;
  let voices = new Map();
  let englishVoices = [];
  let active = null;
  let preferredVoice = preferences.voice ?? builtIn;
  if ([...rate.options].some(option => option.value === preferences.rate)) rate.value = preferences.rate;
  if (Number.isInteger(preferences.volume) && preferences.volume >= 0 && preferences.volume <= 100) {
    volume.valueAsNumber = preferences.volume;
  }
  auto.checked = preferences.auto !== false;
  readOptions.checked = preferences.readOptions !== false;

  function updateVolume() {
    const percent = volume.value + '%';
    volumeValue.textContent = percent;
    volume.setAttribute('aria-valuetext', percent);
    if (active?.audio) {
      active.audio.volume = volume.valueAsNumber / 100;
      active.audio.muted = volume.valueAsNumber === 0;
    }
  }

  function showStatus(message = '') {
    status.hidden = !message;
    status.textContent = message;
  }

  function refreshVoices() {
    const installedVoices = synthesis?.getVoices() ?? [];
    const vietnamese = installedVoices.filter(item => /^vi(?:[-_]|$)/i.test(item.lang));
    englishVoices = installedVoices.filter(item => /^en(?:[-_]|$)/i.test(item.lang));
    voices = new Map(vietnamese.map(item => [item.voiceURI, item]));
    voice.replaceChildren(new Option('Tiếng Việt có sẵn', builtIn));
    const googleVoices = [...voices.values()].filter(isGoogleVoice);
    for (const item of googleVoices) {
      const label = googleVoices.length === 1 ? googleLabel : googleLabel + ' · ' + item.name;
      voice.add(new Option(label, item.voiceURI));
    }
    if (!googleVoices.length) {
      const unavailable = new Option(googleLabel, '');
      unavailable.disabled = true;
      voice.add(unavailable);
    }
    for (const [id, item] of voices) {
      if (!isGoogleVoice(item)) voice.add(new Option(item.name, id));
    }
    googleStatus.hidden = googleVoices.length > 0;
    if (googleStatus.hidden) voice.removeAttribute('aria-describedby');
    else voice.setAttribute('aria-describedby', googleStatus.id);
    voice.value = voices.has(preferredVoice) ? preferredVoice : builtIn;
  }

  function savePreferences() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        voice: preferredVoice, rate: rate.value, volume: volume.valueAsNumber, auto: auto.checked,
        readOptions: readOptions.checked,
      }));
    } catch {
      // Settings still work for the current page.
    }
  }

  function finish(playback) {
    if (active !== playback) return;
    active = null;
    button.textContent = 'Đọc câu hỏi';
  }

  function stop() {
    const playback = active;
    if (!playback) return;
    finish(playback);
    playback.audio?.pause();
    if (playback.utterance) synthesis.cancel();
  }

  function playAudio(playback, file) {
    const source = new URL('./audio/' + file + '.mp3', import.meta.url);
    source.search = audioVersion;
    const audio = new Audio(source);
    playback.audio = audio;
    audio.playbackRate = Number(rate.value);
    updateVolume();
    function reportFailure() {
      if (active !== playback) return;
      finish(playback);
      showStatus('Không phát được âm thanh. Hãy bấm “Đọc câu hỏi” để thử lại.');
    }
    audio.addEventListener('ended', () => finish(playback), {once: true});
    audio.addEventListener('error', reportFailure, {once: true});
    audio.play().catch(reportFailure);
  }

  function play(texts, file) {
    stop();
    showStatus();
    const playback = {file};
    active = playback;
    button.textContent = 'Dừng đọc';
    const nativeVoice = voices.get(voice.value);
    if (!nativeVoice) {
      playAudio(playback, file);
      return;
    }
    const parts = texts.flatMap(splitSpeech);
    const englishVoice = (isGoogleVoice(nativeVoice) && englishVoices.find(isGoogleVoice))
      || englishVoices.find(item => /^en[-_]US$/i.test(item.lang))
      || englishVoices[0];
    if (!englishVoice && parts.some(part => part.language === 'en')) {
      playAudio(playback, file);
      return;
    }
    function speakPart(index) {
      if (active !== playback) return;
      if (index === parts.length) {
        finish(playback);
        return;
      }
      const part = parts[index];
      const partVoice = part.language === 'en' ? englishVoice : nativeVoice;
      const line = new SpeechSynthesisUtterance(part.text);
      playback.utterance = line;
      line.lang = partVoice.lang;
      line.voice = partVoice;
      line.rate = Number(rate.value);
      line.volume = volume.valueAsNumber / 100;
      line.onend = () => {
        if (playback.utterance === line) speakPart(index + 1);
      };
      line.onerror = () => {
        if (active !== playback || playback.utterance !== line) return;
        playback.utterance = null;
        if (isGoogleVoice(nativeVoice)) {
          showStatus('Giọng Google tạm thời không phát được. Đang phát giọng tiếng Việt có sẵn.');
        }
        playAudio(playback, file);
      };
      // Create a new utterance because engines can ignore changes after speak().
      playback.applyVolume = () => {
        if (playback.utterance !== line || line.volume === volume.valueAsNumber / 100) return;
        playback.utterance = null;
        synthesis.cancel();
        speakPart(index);
      };
      synthesis.speak(line);
    }
    speakPart(0);
  }

  refreshVoices();
  updateVolume();
  synthesis?.addEventListener('voiceschanged', refreshVoices);
  voice.addEventListener('change', () => {
    preferredVoice = voice.value;
    stop();
    savePreferences();
  });
  rate.addEventListener('change', () => {
    if (active?.audio) active.audio.playbackRate = Number(rate.value);
    savePreferences();
  });
  volume.addEventListener('input', updateVolume);
  volume.addEventListener('change', () => {
    updateVolume();
    active?.applyVolume?.();
    savePreferences();
  });
  auto.addEventListener('change', savePreferences);
  readOptions.addEventListener('change', () => {
    if (!readOptions.checked && active?.file.startsWith('cau-')) stop();
    savePreferences();
  });
  window.addEventListener('pagehide', stop);

  return {
    automatic: () => auto.checked,
    playing: () => active !== null,
    play,
    stop,
  };
}
