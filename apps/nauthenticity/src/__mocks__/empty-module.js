const handler = {
  get: () => noopFn,
  construct: () => proxy,
  apply: () => proxy,
};
function noopFn() { return proxy; }
const proxy = new Proxy(noopFn, handler);
module.exports = proxy;
module.exports.default = proxy;
