import {Base, match} from './base'

export class HTML5History extends Base {
  constructor (router) {
    super(router)  // 调用Base的构造函数
    window.addEventListener('popstate', () => { //popstate事件只会在浏览器某些行为下触发, 比如点击后退、前进按钮
      this.transitionTo(this.getLocation())  
    })
  }

  push(location) {
    const targetRoute = match(location, this.router.routes)

    this.transitionTo(targetRoute, () => {
      changeUrl(this.router.base, this.current.fullPath)
    })
  }

  replaceState(location) {
    const targetRoute = match(location, this.router.routes)

    this.transitionTo(targetRoute, () => {
      changeUrl(this.router.base, this.current.fullPath, true)
    })
  }

  go (n) {
    window.history.go(n)  // 保留视图
  }

  getLocation (base = '') {
    let path = window.location.pathname
    if (base && path.indexOf(base) === 0) {
      path = path.slice(base.length)
    }
    return (path || '/') + window.location.search + window.location.hash
  }
  
  getCurrentLocation () {
    return this.getLocation(this.router.base)
  }
}


// 改变浏览器地址栏的地址
function changeUrl (base, path, replace) {
  if (replace) {
    window.history.replaceState({}, '', (base + path).replace(/\/\//g, '/'))  // "//"变“/”
  } else {
    window.history.pushState({}, '', (base + path).replace(/\/\//g, '/'))
  }
}