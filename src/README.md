## 路由安装

如`vue`的插件安装, 会执行`install`方法
```js

export let _Vue

export function install (Vue) {
  if (install.installed && _Vue === Vue) return  // 判断是否安装过
  install.installed = true

  _Vue = Vue // 储存Vue

  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    // 执行 vm.$options._parentVnode.data.registerRouteInstance 渲染 router-view 组件
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  Vue.mixin({
    beforeCreate () {  // new Vue时候执行
      // 通过this.$options.router存不存在,判断是不是根组件
      if (isDef(this.$options.router)) {
        this._routerRoot = this  // 跟组件
        this._router = this.$options.router  // 路由实例
        this._router.init(this) // 执行init方法(原型)
        Vue.util.defineReactive(this, '_route', this._router.history.current) // 响应式
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this // 等于父组件实例
      }
      registerInstance(this, this) // 对`router-view`的挂载操作
    },
    destroyed () { // destoryed 钩子
      registerInstance(this)
    }
  })

  Object.defineProperty(Vue.prototype, '$router', {  // 原型上定义了$router
    get () { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', { // 原型上定义了$route
    get () { return this._routerRoot._route }
  })

  Vue.component('RouterView', View)  // 通过Vue.component定义了<router-view>
  Vue.component('RouterLink', Link)  //通过Vue.component定义了<router-link>

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
```

通过`install`方法混入`beforeCreate`和`destoryed`钩子函数, `defineReactive` 方法把 `this._route `变成响应式对象

## 实例化VueRouter对象
先看看构造函数
```js
constructor (options: RouterOptions = {}) {
  this.app = null
  this.apps = []
  this.options = options
  this.beforeHooks = []
  this.resolveHooks = []
  this.afterHooks = []
  this.matcher = createMatcher(options.routes || [], this)

  let mode = options.mode || 'hash'
  this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
  if (this.fallback) {
    mode = 'hash'
  }
  if (!inBrowser) {
    mode = 'abstract'
  }
  this.mode = mode

  switch (mode) {
    case 'history':
      this.history = new HTML5History(this, options.base)
      break
    case 'hash':
      this.history = new HashHistory(this, options.base, this.fallback)
      break
    case 'abstract':
      this.history = new AbstractHistory(this, options.base)
      break
    default:
      if (process.env.NODE_ENV !== 'production') {
        assert(false, `invalid mode: ${mode}`)
      }
  }
}
```