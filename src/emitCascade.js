'use strict';

function emitCascade () {
  var args = Array.prototype.slice.call(arguments);
  var req = args.shift();
  var targets = [req];
  var layer = req.layer;

  while (layer) {
    targets.push(layer);
    layer = layer.parent;
  }

  targets.reverse().forEach(function emitInContext (target) {
    target.emit.apply(req, args);
  });
}

module.exports = emitCascade;
