export class WasmLoader {
    static async load(url: string): Promise<WebAssembly.Module> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const module = await WebAssembly.compile(buffer);
        return module;
    }

    static async instantiate(module: WebAssembly.Module, imports: any = {}): Promise<WebAssembly.Instance> {
        return await WebAssembly.instantiate(module, imports);
    }
}
