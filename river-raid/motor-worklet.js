import './motor-core.js?v=20261029-continuous';
class RiverMotorProcessor extends AudioWorkletProcessor{
 constructor(){super();this.wave=new globalThis.RiverMotor.Wave(sampleRate);this.port.onmessage=e=>this.wave.set(e.data);}
 process(inputs,outputs){this.wave.process(outputs[0][0]);return true;}
}
registerProcessor('river-motor',RiverMotorProcessor);
