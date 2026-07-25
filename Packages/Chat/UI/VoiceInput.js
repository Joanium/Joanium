const TARGET_SAMPLE_RATE = 16000;

function getAudioContext() {
  return new (window.AudioContext ?? window.webkitAudioContext)();
}

async function decodeAudio(blob) {
  const context = getAudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (buffer.sampleRate === TARGET_SAMPLE_RATE) return buffer.getChannelData(0).slice();

    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(buffer.duration * TARGET_SAMPLE_RATE),
      TARGET_SAMPLE_RATE,
    );
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start();
    return (await offlineContext.startRendering()).getChannelData(0).slice();
  } finally {
    await context.close();
  }
}

export function createVoiceInput({ onStateChange, onTranscript, onAudio, onError }) {
  let state = 'idle';
  let recorder = null;
  let stream = null;
  let chunks = [];

  function setState(nextState) {
    state = nextState;
    onStateChange?.(state);
  }

  function releaseMicrophone() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  async function transcribeRecording() {
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
    chunks = [];
    recorder = null;
    releaseMicrophone();

    if (!blob.size) {
      onError?.('no-speech');
      setState('idle');
      return;
    }

    setState('transcribing');
    try {
      const transcript = await onAudio?.(await decodeAudio(blob));
      if (transcript) onTranscript?.(transcript);
      else onError?.('no-speech');
    } catch (error) {
      onError?.(error?.code ?? 'transcription');
    } finally {
      setState('idle');
    }
  }

  async function start() {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (state !== 'idle' || !window.MediaRecorder || !AudioContext) {
      if (!window.MediaRecorder || !AudioContext) onError?.('unsupported');
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      chunks = [];
      const mimeType = 'audio/webm;codecs=opus';
      recorder = MediaRecorder.isTypeSupported(mimeType)
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        onError?.('recording');
      };
      recorder.onstop = () => {
        void transcribeRecording();
      };
      recorder.start();
      setState('recording');
    } catch (error) {
      releaseMicrophone();
      recorder = null;
      onError?.(error?.name === 'NotAllowedError' ? 'permission' : 'microphone');
    }
  }

  function stop() {
    if (state === 'recording' && recorder?.state === 'recording') recorder.stop();
  }

  return {
    get isListening() {
      return state === 'recording';
    },
    get isBusy() {
      return state !== 'idle';
    },
    get state() {
      return state;
    },
    start,
    stop,
    toggle() {
      if (state === 'recording') stop();
      else void start();
    },
  };
}
