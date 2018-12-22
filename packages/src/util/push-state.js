

export const inBrowser = window !== undefined

export const supportsPushState = inBrowser && (function () { // 判断浏览器是否支持pushState方法
  const ua = window.navigator.userAgent

  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Window Phone') === -1
  ) {
    return false
  }
  return window.history && 'pushState' in window.history
})()