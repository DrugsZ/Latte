export interface INodeService {
  create(type: string, x: number, y: number): Promise<string>

  updateFast$(id: string, x: number, y: number): void
}
