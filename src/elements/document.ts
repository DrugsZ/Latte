import { Container } from 'Latte/core/Container'

export class EditorDocument extends Container {
  constructor(data) {
    super(data)
    this.addEventListener('pointerdown', console.log)
  }
}
