'use strict';

function expand (accumulator, child) {
  accumulator.push.apply(accumulator, aggregate(child));
  return accumulator;
}

function requests (layer, clear) {
  var result = layer.requests.concat(layer.children.reduce(expand, []));
  if (clear) {
    layer.requests = [];
  }
  return result;
}

function contexts (layer) {
  var self = [{
    context: layer.context,
    layer: layer
  }];
  return self.concat(layer.children.reduce(expand, []));
}

module.exports = {
  requests: requests,
  contexts: contexts
};
