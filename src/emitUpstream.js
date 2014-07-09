'use strict';

module.exports = function (emitter, context, types) {
  types.forEach(function through (type) {
    emitter.on(type, raise);
  });

  function raise () {
    var ctx = context;
    console.log(arguments);
    while (ctx) {
      ctx.emit.apply(emitter, arguments);
      ctx = ctx.parent;
    }
  }
};
