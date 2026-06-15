import type { IDocument as IBaseDocument } from '@latte-js/bean'

export type IDocument<TGraph = unknown> = IBaseDocument<TGraph>

export class LatteDocument<TGraph = unknown> implements IDocument<TGraph> {
  public isDirty = false

  constructor(
    public readonly id: string,
    public readonly uri: string,
    public readonly graph: TGraph
  ) {}
}
