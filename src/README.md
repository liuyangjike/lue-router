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
    this.app = null  //根 Vue 实例
    this.apps = []  //this.apps 保存持有 $options.router 属性的 Vue 实例
    this.options = options  //传入的路由配置
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    this.matcher = createMatcher(options.routes || [], this)  // 路由匹配器: {match, addRoute}

    let mode = options.mode || 'hash'  //路由创建的模式
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false  // 是否降级处理
    if (this.fallback) {
      mode = 'hash'
    }
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode

    switch (mode) {  // 生成不同模式下的history对象
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

`this.fallback` 表示在浏览器不支持 `history.pushState` 的情况下，根据传入的` fallback `配置参数，决定是否回退到`hash`模式，`this.mode` 表示路由创建的模式，`this.history` 表示路由历史的具体的实现实例，它是根据 `this.mode` 的不同实现不同，它有 `History` 基类，然后不同的 `history` 实现都是继承 `History`

接着会执行`beforeCreate`的`router.init`
```js
  init (app: any /* Vue component instance */) {  // beforeCreate的时候执行
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    this.apps.push(app) // 保存Vue实例, 存储到this.apps中, 只有根Vue实例会保存在this.app中

    // main app already initialized.
    if (this.app) {
      return
    }

    this.app = app // 保存根组件的实例

    const history = this.history // 路由历史的具体的实现实例

    if (history instanceof HTML5History) {  //html5模式
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {  // hash模式
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
      )
    }

    history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }
```

`init` 的逻辑很简单，它传入的参数是 `Vue` 实例，然后存储到 `this.apps` 中；只有根 `Vue` 实例会保存到 `this.app `中，并且会拿到当前的 `this.history`,
来看看`transitionTo`, 做路由过渡的
```js
transitionTo (location: RawLocation, onComplete?: Function, onAbort?: Function) {
  const route = this.router.match(location, this.current)
  // ...
}
```

## matcher路由匹配器

`Matcher` 返回了 2 个方法，`match `和 `addRoutes`

* `Location`
是对 `url` 的结构化描述
```js
declare type Location = {
  _normalized?: boolean;
  name?: string;
  path?: string;
  hash?: string;
  query?: Dictionary<string>;
  params?: Dictionary<string>;
  append?: boolean;
  replace?: boolean;
}
```
* Route
`Route` 表示的是路由中的一条线路，它除了描述了类似 `Loctaion `的 `path、query、hash` 这些概念，还有` matched` 表示匹配到的所有的 `RouteRecord`
```js
declare type Route = {
  path: string;
  name: ?string;
  hash: string;
  query: Dictionary<string>;
  params: Dictionary<string>;
  fullPath: string;
  matched: Array<RouteRecord>;
  redirectedFrom?: string;
  meta?: any;
}
```
### createMatcher
`createRouteMap`生成一张路由映射表
* `pathList`: 存储所有的 `path`
* `pathMap`: 表示一个 `path` 到 `RouteRecord` 的映射关系
* `nameMap`: 表示 `name` 到 `RouteRecord` 的映射关系
```js
export function createMatcher (
  routes: Array<RouteConfig>, //  传入的用户配置
  router: VueRouter   // 路由实例
): Matcher {
  const { pathList, pathMap, nameMap } = createRouteMap(routes)
  

  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  function match (
    raw: RawLocation,  //其中 raw 是 RawLocation 类型，它可以是一个 url 字符串，也可以是一个 Location 对象；
    currentRoute?: Route, //currentRoute 是 Route 类型
    redirectedFrom?: Location
  ): Route {
    // 是根据 raw，current 计算出新的 location
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location

    if (name) {
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      if (!record) return _createRoute(null, location)
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      if (typeof location.params !== 'object') {
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      if (record) {
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        return _createRoute(record, location, redirectedFrom)
      }
    } else if (location.path) {
      // 处理非命名路由, 寻找计1算出新的location对应的那一条记录record
      // 因为location里面可能含有params, 不能直接找出, 只能通过遍历pathList,再通过mathcRoute塞选出想要的
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }
  // ...省略

  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoutes
  }
}
```

`RoutedRecord`是每一个`route`对于的一条记录, `RoutedRecord`的`parent`来实现嵌套路由, 其实钱通过遍历`route.children`调用`addRouteRecord`实现父子关系
### addRoutes
`addRoutes` 方法的作用是动态添加路由配置
```js
function addRoutes (routes) {
  createRouteMap(routes, pathList, pathMap, nameMap)
}
```
其实就是`addRoute`之前闭包映射表, 通过`createRouteMap`直接修改路由映射表达到目的
### match

其实就是根据`record`和`location`找到对应的路径`Route`
最终会调用 `createRoute` 方法
```js
// 生成一条路径
export function createRoute (
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  const stringifyQuery = router && router.options.stringifyQuery

  let query: any = location.query || {}
  try {
    query = clone(query)
  } catch (e) {}

  // 路径对象
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : [] // 它记录了一条线路上的所有record
  }
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  return Object.freeze(route)
}
```
注意`matched`, 通过`formatMatch`方法生成, 它记录了一条线路上的所有 `record`, `matched` 属性非常有用，它为之后渲染组件提供了依据

## 路径切换
`history.transitionTo` 是 `Vue-Router` 中非常重要的方法，当我们切换路由线路的时候，就会执行到该方法，前
而 `transitionTo` 实际上也就是在切换 `this.current`
```js
  //当我们执行路切换的时候,就会执行该方法
  transitionTo (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // location 代表目标路径, current代表当前路径
    const route = this.router.match(location, this.current)  // 匹配出新的路由对象
    this.confirmTransition(route, () => {
      this.updateRoute(route)
      onComplete && onComplete(route)
      this.ensureURL()

      // fire ready cbs once
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => { cb(route) })
      }
    }, err => {
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach(cb => { cb(err) })
      }
    })
  }

  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current  // 获取当前路由
    const abort = err => {  // 定义了abort
      if (isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    if (  // 判断计算后的route和current是相同的路径的话
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }


    // 解析出来三个RouteRecord的数组
    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)
    

    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      //在失活的组件里调用离开守卫
      extractLeaveGuards(deactivated),
      // global before hooks
      // 调用全局的 beforeEach 守卫
      this.router.beforeHooks,
      // in-component update hooks
      // 在重用的组件里调用 beforeRouteUpdate 守卫
      extractUpdateHooks(updated),
      // in-config enter guards
      // 在激活的路由配置里调用 beforeEnter
      activated.map(m => m.beforeEnter),
      // async components
      // 解析异步路由组件
      resolveAsyncComponents(activated)
    )

    this.pending = route
    // 迭代器, 执行前guard,触发下一个guard
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        // 执行每个导航守卫hook, 参数route, current, 匿名函数, 分别对应官方文档的to, from, next
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      // 在被激活的组件里调用 beforeRouteEnter
      // 调用全局的 beforeResolve 守卫。
      // 调用全局的 afterEach 钩子
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => { cb() })
          })
        }
      })
    })
  }
```
`confirmTransition `方法去做真正的切换， 注意`resolveQueue`, 

因为 `route.matched` 是一个` RouteRecord` 的数组，由于路径是由 `current `变向 `route`，那么就遍历对比 2 边的 `RouteRecord`，找到一个不一样的位置 i，那么 `next` 中从 0 到 i 的 `RouteRecord `是两边都一样，则为 `updated` 的部分；从 `i` 到最后的 `RouteRecord` 是 `next` 独有的，为 `activated` 的部分；而 `current` 中从 `i` 到最后的` RouteRecord `则没有了，为 `deactivated `的部分。

接着会执行一系列的钩子函数

那么至此我们把所有导航守卫的执行分析完毕了，我们知道路由切换除了执行这些钩子函数，从表象上有 2 个地方会发生变化，一个是 `url` 发生变化，一个是组件发生变化。接下来我们分别介绍这两块的实现原理。

## url
当我们点击 `router-link` 的时候，实际上最终会执行 `router.push`，
其实就是会调用浏览器原生的 `history` 的 `pushState` 接口或者 `replaceState` 接口，更新浏览器的 `url `地址，并把当前 `url` 压入历史栈中。

## 组件
路由最终的渲染离不开组件，`Vue-Router` 内置了 `<router-view>` 组件
```js
export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {
    data.routerView = true
   
    const h = parent.$createElement
    const name = props.name
    const route = parent.$route
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    let depth = 0
    let inactive = false
    while (parent && parent._routerRoot !== parent) {
      if (parent.$vnode && parent.$vnode.data.routerView) {
        depth++
      }
      if (parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    data.routerViewDepth = depth

    if (inactive) {
      return h(cache[name], data, children)
    }

    //depth 的概念，它表示 <router-view> 嵌套的深度。
    const matched = route.matched[depth]
    if (!matched) {
      cache[name] = null
      return h()
    }

    const component = cache[name] = matched.components[name]
   
    data.registerRouteInstance = (vm, val) => {     
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }
    
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    let propsToPass = data.props = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      propsToPass = data.props = extend({}, propsToPass)
      const attrs = data.attrs = data.attrs || {}
      for (const key in propsToPass) {
        if (!component.props || !(key in component.props)) {
          attrs[key] = propsToPass[key]
          delete propsToPass[key]
        }
      }
    }

    return h(component, data, children)
  }
}
```

`<router-view>` 是一个` functional` 组件，它的渲染也是依赖 `render` 函数,

```js
data.routerView = true
// ...
while (parent && parent._routerRoot !== parent) {
  if (parent.$vnode && parent.$vnode.data.routerView) {
    depth++
  }
  if (parent._inactive) {
    inactive = true
  }
  parent = parent.$parent
}

const matched = route.matched[depth] //对应的RouteRecord
// ...
const component = cache[name] = matched.components[name]  // 要渲染的组件

```
`depth` 的概念，它表示` <router-view> `嵌套的深度。
`parent._routerRoot` 表示的是根 Vue 实例，那么这个循环就是从当前的 `<router-view>` 的父节点向上找，一直找到根 `Vue` 实例，在这个过程，如果碰到了父节点也是 `<router-view> `的时候，说明 `<router-view> `有嵌套的情况，`depth++`。遍历完成后，根据当前线路匹配的路径和` depth` 找到对应的 `RouteRecord`，进而找到该渲染的组件,
`render` 函数的最后根据 `component` 渲染出对应的组件 `vonde`
```js
return h(component, data, children)
```


## 总结

我们要记住以下内容：路由始终会维护当前的线路，路由切换的时候会把当前线路切换到目标线路，切换过程中会执行一系列的导航守卫钩子函数，会更改 `url`，同样也会渲染对应的组件，切换完毕后会把目标线路更新替换当前线路，这样就会作为下一次的路径切换的依据