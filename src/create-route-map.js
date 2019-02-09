/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>;
  pathMap: Dictionary<RouteRecord>;
  nameMap: Dictionary<RouteRecord>;
} {
  //由于 pathList、pathMap、nameMap 都是引用类型，
  //所以在遍历整个 routes 过程中去执行 addRouteRecord 方法，会不断给他们添加数据
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || [] // 储存所有的path
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null) //path到RouteRecord的映射关系
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)  // name到RouteRecord的映射关系

  routes.forEach(route => {  // 遍历 routes 为每一个 route 执行 addRouteRecord 方法生成一条记录
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord ( // 生成一条路由记录
  pathList: Array<string>,  // 存储所有路径
  pathMap: Dictionary<RouteRecord>,  // 存储path到RouteRecord的映射关系
  nameMap: Dictionary<RouteRecord>,  // 储存name到RouteRecord的映射关系
  route: RouteConfig,
  parent?: RouteRecord,  // 父路由记录
  matchAs?: string
) {
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(path || name)} cannot be a ` +
      `string id. Use an actual component instead.`
    )
  }

  const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  )   // 规范后的路径

  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = {  // 记录
    path: normalizedPath,  // 路径
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), // path解析成正则的结果
    components: route.components || { default: route.component },  // 当前路由对应的组件
    instances: {},
    name,
    parent,  // 确定父子关系
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props: route.props == null
      ? {}
      : route.components
        ? route.props
        : { default: route.props }
  }

  // 如果配置子路由,遍历子路由, addRouteRecord, 传入当前record作为parent形成树状结构的路由
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (route.name && !route.redirect && route.children.some(child => /^\/?$/.test(child.path))) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
          `When navigating to this named route (:to="{name: '${route.name}'"), ` +
          `the default child route will not be rendered. Remove the name from ` +
          `this route and use the name of the default child route for named ` +
          `links instead.`
        )
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias)
      ? route.alias
      : [route.alias]

    aliases.forEach(alias => {
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    })
  }

  if (!pathMap[record.path]) {  // 为pathList和pathMap添加一条记录
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  if (name) {
    if (!nameMap[name]) {  // 为nameMap添加一条记录
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
        `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex (path: string, pathToRegexpOptions: PathToRegexpOptions): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(!keys[key.name], `Duplicate param keys in route with path: "${path}"`)
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath (path: string, parent?: RouteRecord, strict?: boolean): string {
  if (!strict) path = path.replace(/\/$/, '')
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)
}
