import {
  DEFAULT_PAGE_SCHEMA,
  DEFAULT_LATTE_FILE,
  DEFAULT_DOCUMENT_SCHEMA,
  DEFAULT_RECTANGLE_SCHEMA,
} from 'Latte/constants/schema'

let sessionID = 1
export function setSessionId(newSessionId: number) {
  sessionID = newSessionId
}

// only use to copy schema
function deepCopySchema<T>(schema: T): T {
  return JSON.parse(JSON.stringify(schema))
}

let uuid = 0
export const getUId = () => ({
  sessionID,
  localID: ++uuid,
})

export const createDefaultPageNode = (parentIndex?: {
  guid?: DefaultIDType
  position?: string
}) => {
  const newPage = deepCopySchema(DEFAULT_PAGE_SCHEMA)
  newPage.guid = getUId()
  if (parentIndex) {
    newPage.parentIndex = {
      ...newPage.parentIndex,
      ...parentIndex,
    }
  }
  return newPage
}

export const createDefaultElementSchema = (
  { left, top, width = 100, height = 100 },
  parentIndex?: {
    guid?: DefaultIDType
    position?: string
  }
) => {
  const newRect = deepCopySchema(DEFAULT_RECTANGLE_SCHEMA)
  newRect.guid = getUId()
  if (parentIndex) {
    newRect.parentIndex = {
      ...newRect.parentIndex,
      ...parentIndex,
    }
  }
  newRect.transform.tx = left
  newRect.transform.ty = top
  newRect.size.x = width
  newRect.size.y = height
  return newRect
}

export const createDefaultDocument = () =>
  deepCopySchema(DEFAULT_DOCUMENT_SCHEMA)

export const createDefaultFile = () => {
  const newDocument = createDefaultDocument()
  const newFile = deepCopySchema(DEFAULT_LATTE_FILE)
  const page = createDefaultPageNode({
    guid: newDocument.guid,
  })
  newFile.elements.push(newDocument)
  newFile.elements.push(page)
  return newFile
}

export const createDefaultElement = () => {}
