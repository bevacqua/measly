'use strict';

function aggregate (context, clear) {
  var result = context.requests.concat(context.children.reduce(expand, []));
  if (clear) {
    context.requests = [];
  }
  return result;
}

function expand (accumulator, child) {
  accumulator.push.apply(accumulator, aggregate(child));
  return accumulator;
}

module.exports = aggregate;
