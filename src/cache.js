'use strict';

function find (url, context) {
  var ctx = context;
  var cache;
  while (ctx) {
    cache = ctx.cache;
    if (url in cache) {
      if (isStale(cache[url])) {
        delete cache[url];
      }
      return cache[url];
    }
    ctx = ctx.parent;
  }
}

function isStale (entry) {
  return entry.expires - new Date() < 0;
}

function expires (duration) {
  return Date.now() + duration;
}

module.exports = {
  find: find,
  expires: expires
};
