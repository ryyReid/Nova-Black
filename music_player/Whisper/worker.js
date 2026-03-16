import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

env.allowLocalModels = false;

let transcriber = null;
let isProcessing = false;

(async () => {
    try {
        console.log('[Worker] Loading Whisper model...');
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        console.log('[Worker] Model loaded');
        self.postMessage({ status: 'ready' });
    } catch (err) {
        console.error('[Worker] Model load error:', err);
        self.postMessage({ status: 'error', message: 'Failed to load model: ' + err.message });
    }
})();

self.onmessage = async (e) => {
    const { audio } = e.data;

    if (!transcriber) {
        self.postMessage({ status: 'final', text: '' });
        return;
    }

    if (!audio || isProcessing) return;
    isProcessing = true;

    try {
        const chunk = new Float32Array(audio);

        const output = await transcriber(chunk, {
            chunk_length_s: 10,
            stride_length_s: 2,
            language: 'english',
            task: 'transcribe',
        });

        const text = output?.text?.trim() || '';
        self.postMessage({ status: 'final', text });

    } catch (err) {
        console.error('[Worker] Transcription error:', err);
        self.postMessage({ status: 'error', message: err.message });
    } finally {
        isProcessing = false;
    }
};
