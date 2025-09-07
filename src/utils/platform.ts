let _isWindows = false
let _isMacintosh = false
let _isLinux = false
let _isWeb = false
let _isIOS = false
let _isMobile = false
const _userAgent = navigator.userAgent

_isWindows = _userAgent.indexOf('Windows') >= 0
_isMacintosh = _userAgent.indexOf('Macintosh') >= 0
_isIOS =
  (_userAgent.indexOf('Macintosh') >= 0 ||
    _userAgent.indexOf('iPad') >= 0 ||
    _userAgent.indexOf('iPhone') >= 0) &&
  !!navigator.maxTouchPoints &&
  navigator.maxTouchPoints > 0
_isLinux = _userAgent.indexOf('Linux') >= 0
_isMobile = _userAgent?.indexOf('Mobi') >= 0
_isWeb = true

export const enum Platform {
  Web,
  Mac,
  Linux,
  Windows,
}
export type PlatformName = 'Web' | 'Windows' | 'Mac' | 'Linux'

let _platform: Platform = Platform.Web
if (_isMacintosh) {
  _platform = Platform.Mac
} else if (_isWindows) {
  _platform = Platform.Windows
} else if (_isLinux) {
  _platform = Platform.Linux
}

const $globalThis: any = globalThis

export const isWindows = _isWindows
export const isMacintosh = _isMacintosh
export const isLinux = _isLinux
export const isWeb = _isWeb
export const isWebWorker =
  _isWeb && typeof $globalThis.importScripts === 'function'
export const webWorkerOrigin = isWebWorker ? $globalThis.origin : undefined
export const isIOS = _isIOS
export const isMobile = _isMobile

export const isFirefox = _userAgent.indexOf('Firefox') >= 0
export const isWebKit = _userAgent.indexOf('AppleWebKit') >= 0
export const isChrome = _userAgent.indexOf('Chrome') >= 0
export const isSafari = !isChrome && _userAgent.indexOf('Safari') >= 0
export const isWebkitWebView = !isChrome && !isSafari && isWebKit
export const isElectron = _userAgent.indexOf('Electron/') >= 0
export const isAndroid = _userAgent.indexOf('Android') >= 0

export const enum OperatingSystem {
  Windows = 1,
  Macintosh = 2,
  Linux = 3,
}

export const OS =
  _isMacintosh || _isIOS
    ? OperatingSystem.Macintosh
    : _isWindows
    ? OperatingSystem.Windows
    : OperatingSystem.Linux
