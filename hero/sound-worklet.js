import './sound-core.js';
class HeroAudioProcessor extends AudioWorkletProcessor{
 constructor(){super();this.wave=new globalThis.HeroSound.Wave(sampleRate);this.port.onmessage=e=>this.wave.set(e.data);}
 process(inputs,outputs){this.wave.process(outputs[0][0]);return true;}
}
registerProcessor('hero-audio',HeroAudioProcessor);
