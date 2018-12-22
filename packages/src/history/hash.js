
import {Base, match} from './base'

export class HashHistory extends Base {
  constructor (router) {
    super(router)  // 调用Base的构造函数
    this.ensureSlash()
    window.addEventListener('hashchange', () => {
      console.log('==========')
      this.transitionTo(this.getCurrentLocation())  // 改变当前的current.route值触发依赖
    })
  }
  ensureSlash () {
    // 得到hash值
    const path = this.getCurrentLocation()
    // 如果说以/ 开头, 直接返回即可
    if (path.charAt(0) === '/') {
      return true
    }
    // 不是的话需要手工保证一次  替换hash值
    changeUrl(path)
    return false
  }
  push(location) {
    const targetRoute = match(location, this.router.routes)

    this.transitionTo(targetRoute, () => {
      changeUrl(this.current.fullPath.substring(1))
    })
  }

  replaceState(location) {
    const targetRoute = match(location, this.router.routes)

    this.transitionTo(targetRoute, () => {
      changeUrl(this.current.fullPath.substring(1), true)
    })
  }

  go (n) {
    window.history.go(n)  // 保留视图
  }

  getCurrentLocation () {
    // 因为兼容性问题, 这里没有直接使用window.location.hash
    // 因为Firefox decode hash值
    const href = window.location.href
    const index = href.indexOf('#')
    // 如果此时没有 # 则返回‘’
    // 否则  取的 # 后的所有内容
    return index === -1 ? '': href.slice(index + 1)
  }
}

// 改变浏览器地址栏的地址
function changeUrl (path, replace) {
  const href = window.location.href 
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i): href
  if (replace) {
    window.history.replaceState({}, '', `${base}#/${path}`)
  } else {
    window.history.pushState({}, '', `${base}#/${path}`)
  }
}