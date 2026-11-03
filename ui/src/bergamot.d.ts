declare module "@browsermt/bergamot-translator/translator.js" {
  export class TranslatorBacking {
    constructor(options?: object);
    loadModelRegistery(): Promise<unknown>;
    loadWorker(): Promise<unknown>;
  }
  export class BatchTranslator {
    constructor(options?: object, backing?: TranslatorBacking);
    translate(request: { from: string; to: string; text: string; html: boolean }): Promise<{ target: { text: string } }>;
    delete(): void;
  }
}
