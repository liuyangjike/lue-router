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

  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

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