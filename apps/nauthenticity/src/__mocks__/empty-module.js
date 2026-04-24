const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return proxy;
    return proxy;
  },
  apply() { return proxy; },
  construct() { return proxy; },
};
const proxy = new Proxy(function () {}, handler);
module.exports = proxy;
