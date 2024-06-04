import SparkMD5 from 'spark-md5'

class TextureCache {
  private _cache: Map<string, ImageBitmap> = new Map()

  public async add(id: string, data: File) {
    if (this._cache.has(id)) {
      return this._cache.get(id)
    }
    const bitmap = await createImageBitmap(data)
    this._cache.set(id, bitmap)
    return bitmap
  }

  public get(id: string) {
    // const value = this._cache.values()
    // return value.next().value
    return this._cache.get(id)
  }
}

export interface ITextureLoadResult {
  hash: string
  name: string
  type: string
  size: {
    x: number
    y: number
  }
}

const fileReader = new FileReader()

class TextureManager {
  private _textureCache: TextureCache = new TextureCache()

  private _getFileHash(file: File) {
    const p = new Promise((resolve, reject) => {
      fileReader.onloadend = ev =>
        resolve(SparkMD5.hashBinary(ev.target.result))
    })
    fileReader.readAsDataURL(file)
    return p
  }

  async load(source: File): Promise<ITextureLoadResult> {
    const hash = (await this._getFileHash(source)) as string
    const bitmap = await this._textureCache.add(hash, source)
    const { width: x, height: y } = bitmap as ImageBitmap
    return {
      hash,
      name: source.name,
      type: source.type,
      size: {
        x,
        y,
      },
    }
  }

  getTexture(id: string) {
    return this._textureCache.get(id)
  }
}

export const textureManager = new TextureManager()
window.textureManager = textureManager
