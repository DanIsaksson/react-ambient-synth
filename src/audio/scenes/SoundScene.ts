export interface SoundScene {
  name: string;
  setup(context: AudioContext, destination: AudioNode): void;
  teardown(): void;
  setParam?(param: string, value: number): void;
  getVisualState?(): any;
}
