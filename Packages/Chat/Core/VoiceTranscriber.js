import { mkdir } from 'node:fs/promises';

const VOICE_MODEL = 'Xenova/whisper-base.en';
const MINIMUM_SAMPLE_COUNT = 1600;
const MINIMUM_RMS_AMPLITUDE = 0.005;

function createVoiceTranscriptionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hasAudibleSpeech(samples) {
  let total = 0;
  for (const sample of samples) total += sample * sample;
  return Math.sqrt(total / samples.length) >= MINIMUM_RMS_AMPLITUDE;
}

export function createVoiceTranscriber({ cacheDirectory }) {
  let transcriberPromise = null;

  async function getTranscriber(onProgress) {
    if (!transcriberPromise) {
      transcriberPromise = (async () => {
        await mkdir(cacheDirectory, { recursive: true });
        const { env, pipeline } = await import('@huggingface/transformers');
        env.cacheDir = cacheDirectory;
        return pipeline('automatic-speech-recognition', VOICE_MODEL, {
          dtype: 'q8',
          progress_callback: onProgress,
        });
      })();
    }

    try {
      return await transcriberPromise;
    } catch (error) {
      transcriberPromise = null;
      throw createVoiceTranscriptionError(
        'model',
        error?.message ?? 'Failed to load speech model.',
      );
    }
  }

  async function transcribe(samples, onProgress) {
    if (
      !(samples instanceof Float32Array) ||
      samples.length < MINIMUM_SAMPLE_COUNT ||
      !hasAudibleSpeech(samples)
    ) {
      throw createVoiceTranscriptionError('no-speech', 'No speech was detected.');
    }

    const transcriber = await getTranscriber(onProgress);
    try {
      const result = await transcriber(samples);
      return String(result?.text ?? '').trim();
    } catch (error) {
      throw createVoiceTranscriptionError(
        'transcription',
        error?.message ?? 'Failed to transcribe speech.',
      );
    }
  }

  return { transcribe };
}
