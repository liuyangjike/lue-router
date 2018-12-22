import {supportsPushState} from './util/push-state'
import {HashHistory} from './history/hash'
import {observer} from './util/observer'
import {Watcher} from './util/wathcer'

class Router {
  constructor(options) {
    this.base = options.base
    this.routes = options.routes
    this.container = options.id
    this.mode = options.mode || 'hash'
    this.fallback = this.mode === 'history' && !supportsPushState && options.fallback !== false // 是否做降级处理
    if (this.fallback) {
      this.mode = 'hash'
    }
    this.history = this.mode === 'history' ? new HTML5History(this) : new HashHistory(this)  // 模式选择

    Object.defineProperty(this, 'route', {
      get: () => {
        return this.history.current
      }
    })
    this.init()
  }

  push(location) {
    this.history.push(location)
  }
  
  render () {
    let i 
    // 当 this.history.current存在,且this.history.current.route且this.history.current.route.component存在
    if ((i = this.history.current) && (i = i.route) && (i = i.component)) {
      document.getElementById(this.container).innerHTML = i
    }
  }

  init() {
    const history = this.history
    observer.call(this, this.history.current)
    new Watcher(this.history.current, 'route', this.render.bind(this))
    console.log(history.getCurrentLocation())
    history.transitionTo(history.getCurrentLocation())
  }
}

window.Router = Router