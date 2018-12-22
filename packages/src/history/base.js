/**
 *
 *
 * @export
 * @class Base
 */
export class Base {

  constructor (router) {
    this.router = router
    this.current = {
      path: '/',
      query: {},
      params: {},
      name: '',
      fullPath: '/',
      route: {}
    }
  }

  /**
   * 
   * @param {目标路径} target 
   * @param {成功后的回调} cb 
   */
  transitionTo (target, cb) {
    // 通过对比传入的routes获取匹配的targetRoute对象
    const targetRoute = match(target, this.router.routes)
    console.log(targetRoute, 'color:red')
    this.confirmTransition(targetRoute, () => {
      this.current.route = targetRoute
      this.current.name = targetRoute.name
      this.current.path = targetRoute.path
      this.current.query = targetRoute.query || getQuery()
      this.current.fullPath = getFullPath(this.current)
      cb && cb()
    })
    console.log(this.current)
  } 

  /**
   * 
   * @param {确认跳转路由} route 
   * @param {回调} cb 
   */
  confirmTransition (route, cb) {
    // 钩子函数执行队列
    let queue = [].concat(
      this.router.beforeEach,
      this.current.route.beforeLeave,
      route.beforeEnter,
      route.afterEnter,
    )

    // 通过step调度执行
    let i = -1
    const step = () => {  // 相当于一个循环
      i++
      if (i > queue.length) {
        cb()   // 执行完队列任务时,执行回调,主要改变当前路径的信息
      } else if (queue[i]) {
        queue[i](step)  // i会形成闭包, 会先取执行beforeEach,beforeEnter..等再回来接着执行循环
      } else { // queue[i]为undefined时候
        step()
      }
    }
    step(i)
  }
  
}

/**
 * 
 * @param {用户输入的路径} path 
 * @param {实例化路由传入的选项} routeMap 
 * 返回与当前路由匹配的路由参数
 */
export function match(path, routeMap) {
  let match = {}
  if (typeof path === 'string' || path.name === undefined) {
    for (let route of routeMap) {
      if (route.path === path || route.path === path.path) {
        match = route
        break;
      }
    }
  } else {
    for (let route of routeMap) {
      if (route.name === path.name) {
        match = route
        if (path.query) {
          match.query = path.query
        }
        break;
      }
    }
  }
  return match
}

/**
 * getQuery 获取query参数,组成query对象,键值对的形式
 */
export function getQuery () {
  const hash = location.hash // #号以后的路径, 包括#号
  const queryStr = hash.indexOf('?') !== -1 ? hash.substring(hash.indexOf('?') + 1) : ''
  const queryArray = queryStr ? queryStr.split('&') : []
  let query = {}
  queryArray.forEach((q) => {
    let qArray = q.split('=')
    query[qArray[0]] = qArray[1]
  })
  return query
}

/**
 * 
 * @param {*} param0 
 * @param {你可以传入自己的query的stringify方法,格式化路径} _stringifyQuery
 * 返回#  后面的完整路径,不包括#号 
 */
function getFullPath ({path, query = {}, hash = ''}, _stringifyQuery) {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

function stringifyQuery (obj) {
  const res = obj ? Object.keys(obj).map(key => {
    const val = obj[key]

    if (val === undefined) {
      return ''
    }

    if (val === null) {
      return key
    }

    if (Array.isArray(val)) {
      const result = []
      val.forEach(val2 => {
        if (val2 === undefined) {
          return
        }
        if (val2 === null) {
          result.push(key)
        } else {
          result.push(key + '=' + val2)
        }
      })
      return result.join('&')
    }
    
    return key + '=' + val
  }).filter(x => x.length > 0).join('&') : null
  return res ? `?${res}`: ''
}
