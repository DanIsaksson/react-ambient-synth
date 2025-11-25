export interface AudioModule {
    name?: string;
    input: AudioNode;
    output: AudioNode;
    connect(destination: AudioNode): void;
    setParam(param: string, value: number): void;
    bypass?(active: boolean): void;
}
