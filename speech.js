const storageKey = 'ppnckh-giong-doc-v1';
const builtIn = 'built-in';
const googleLabel = 'Google Tiếng Việt';
const audioVersion = new URL(import.meta.url).search;

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

export function createSpeechPlayer({button, voice, rate, auto, status, googleStatus}) {
  const preferences = loadPreferences();
  const synthesis = window.speechSynthesis;
  let voices = new Map();
  let active = null;
  let preferredVoice = preferences.voice ?? builtIn;
  if ([...rate.options].some(option => option.value === preferences.rate)) rate.value = preferences.rate;
  auto.checked = preferences.auto !== false;

  function showStatus(message = '') {
    status.hidden = !message;
    status.textContent = message;
  }

  function refreshVoices() {
    const vietnamese = synthesis?.getVoices().filter(item => /^vi(?:[-_]|$)/i.test(item.lang)) ?? [];
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
      localStorage.setItem(storageKey, JSON.stringify({voice: preferredVoice, rate: rate.value, auto: auto.checked}));
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
    const playback = {};
    active = playback;
    button.textContent = 'Dừng đọc';
    const nativeVoice = voices.get(voice.value);
    if (!nativeVoice) {
      playAudio(playback, file);
      return;
    }
    function speakPart(index) {
      if (active !== playback) return;
      if (index === texts.length) {
        finish(playback);
        return;
      }
      const line = new SpeechSynthesisUtterance(texts[index]);
      playback.utterance = line;
      line.lang = nativeVoice.lang;
      line.voice = nativeVoice;
      line.rate = Number(rate.value);
      line.onend = () => speakPart(index + 1);
      line.onerror = () => {
        if (active !== playback) return;
        playback.utterance = null;
        if (isGoogleVoice(nativeVoice)) {
          showStatus('Giọng Google tạm thời không phát được. Đang phát giọng tiếng Việt có sẵn.');
        }
        playAudio(playback, file);
      };
      synthesis.speak(line);
    }
    speakPart(0);
  }

  refreshVoices();
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
  auto.addEventListener('change', savePreferences);
  window.addEventListener('pagehide', stop);

  return {
    automatic: () => auto.checked,
    playing: () => active !== null,
    play,
    stop,
  };
}
