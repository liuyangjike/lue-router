import View from './components/view'
import Link from './components/link'

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
