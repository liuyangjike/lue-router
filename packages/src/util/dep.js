
export class Dep {
  constructor () {
    this.subs = []
  }
  add () {
    this.subs.push(Dep.target)
  }
  notify () {
    console.log('--=====')
    this.subs.forEach(target => {
      target.update()
    })
  }
}


Dep.target = null

export function setTarget (target) {
  Dep.target = target
}

export function cleanTarget () {
  Dep.target = null
}