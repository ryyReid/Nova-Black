// Path to your new folder
const whisperWorker = new Worker('./Whisper/worker.js', { type: 'module' });

whisperWorker.onmessage = (e) => {
    const { status, text } = e.data;
    if (status === 'ready') showToast('✅ AI Model Loaded', 2000);
    if (status === 'interim') updateInterim(text);
    if (status === 'final') appendFinalLine(text);
};