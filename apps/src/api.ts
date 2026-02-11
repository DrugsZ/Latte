export const ProxyLatte = {
  editor: {},
} as typeof latte

/**
 * the temp resolve
 */
export function registerAPI<K extends keyof typeof latte.editor>(
  key: K,
  value: (typeof latte.editor)[K]
) {
  ProxyLatte.editor[key] = value
}
