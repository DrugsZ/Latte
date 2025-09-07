class Node<E> {
  static readonly Undefined = new Node<any>(undefined)

  element: E

  next: Node<E>

  prev: Node<E>

  constructor(element: E) {
    this.element = element
    this.next = Node.Undefined
    this.prev = Node.Undefined
  }
}

export class LinkedList<E> {
  #first: Node<E> = Node.Undefined
  #last: Node<E> = Node.Undefined
  #size: number = 0

  get size(): number {
    return this.#size
  }

  isEmpty(): boolean {
    return this.#first === Node.Undefined
  }

  clear(): void {
    let node = this.#first.next
    while (node) {
      const { next } = node
      node.prev = Node.Undefined
      node.next = Node.Undefined
      node = next
    }
    this.#first = Node.Undefined
    this.#last = Node.Undefined
    this.#size = 0
  }

  push(element: E): () => void {
    return this.#insert(element, true)
  }

  unshift(element: E): () => void {
    return this.#insert(element, false)
  }

  shift(): E | undefined {
    if (this.#first === Node.Undefined) {
      return undefined
    }
    const res = this.#first.element
    this.#remove(this.#first)
    return res
  }

  pop(): E | undefined {
    if (this.#last === Node.Undefined) {
      return undefined
    }
    const res = this.#last.element
    this.#remove(this.#last)
    return res
  }

  #insert(element: E, atTheEnd: boolean): () => void {
    const newNode = new Node(element)
    if (this.#first === Node.Undefined) {
      this.#first = newNode
      this.#last = newNode
    } else if (atTheEnd) {
      // push
      const oldLast = this.#last
      this.#last = newNode
      newNode.prev = oldLast
      oldLast.next = newNode
    } else {
      // unshift
      const oldfirst = this.#first
      this.#first = newNode
      newNode.next = oldfirst
      oldfirst.prev = newNode
    }
    this.#size += 1

    let didRemove = false
    return () => {
      if (!didRemove) {
        didRemove = true
        this.#remove(newNode)
      }
    }
  }

  #remove(node: Node<E>): void {
    if (node.prev !== Node.Undefined && node.next !== Node.Undefined) {
      // middle
      const anchor = node.prev
      anchor.next = node.next
      // eslint-disable-next-line no-param-reassign
      node.next.prev = anchor
    } else if (node.prev === Node.Undefined && node.next === Node.Undefined) {
      // only node
      this.#first = Node.Undefined
      this.#last = Node.Undefined
    } else if (node.next === Node.Undefined) {
      // last
      this.#last = this.#last!.prev!
      this.#last.next = Node.Undefined
    } else if (node.prev === Node.Undefined) {
      // first
      this.#first = this.#first!.next!
      this.#first.prev = Node.Undefined
    }

    // done
    this.#size -= 1
  }

  *[Symbol.iterator](): Iterator<E> {
    let node = this.#first
    while (node !== Node.Undefined) {
      yield node.element
      node = node.next
    }
  }
}
