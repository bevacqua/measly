'use strict';

module.exports = function (emitter, context, types) {
  types.forEach(function through (type) {
    emitter.on(type, raise.bind(emitter, type));
  });

  function raise (type) {
    var args = Array.prototype.slice.call(arguments);
    var all = [type].concat(args);
    var ctx = context;

    while (ctx) {
      ctx.emit.apply(emitter, all);
      ctx = ctx.parent;
    }
  }
};
