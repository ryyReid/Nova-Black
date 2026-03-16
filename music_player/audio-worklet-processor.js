/**
 * AudioWorkletProcessor for real-time audio capture
 * Replaces deprecated ScriptProcessorNode
 */
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.isProcessing = false;
        this.port.onmessage = (event) => {
            if (event.data.command === 'start') {
                this.isProcessing = true;
            } else if (event.data.command === 'stop') {
                this.isProcessing = false;
            }
        };
    }

    process(inputs) {
        if (!this.isProcessing) return true;
        
        const input = inputs[0];
        if (input && input[0]) {
            const audioData = input[0];
            // Send audio chunk to main thread
            this.port.postMessage({
                audio: Array.from(audioData)
            });
        }
        
        // Return true to keep the processor alive
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
