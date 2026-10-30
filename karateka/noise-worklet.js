import './noise.js';
class KaratekaNoiseProcessor extends AudioWorkletProcessor{
 constructor(){super();this.wave=new globalThis.KaratekaNoise.Wave(sampleRate);this.port.onmessage=e=>this.wave.set(e.data);}
 process(inputs,outputs){this.wave.process(outputs[0][0]);return true;}
}
registerProcessor('karateka-noise',KaratekaNoiseProcessor);
