class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._bufferSize = 4096
    this._buffer = new Float32Array(this._bufferSize)
    this._bytesWritten = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (input.length === 0) return true

    const channelData = input[0]
    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._bytesWritten++] = channelData[i]

      if (this._bytesWritten >= this._bufferSize) {
        this.port.postMessage(this._buffer.slice(0))
        this._bytesWritten = 0
      }
    }

    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
