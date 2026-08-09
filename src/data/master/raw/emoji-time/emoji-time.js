(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.emojiTime = factory());
}(this, (function () { 'use strict';

  var clocks = Array.from('🕛🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕧🕜🕝🕞🕟🕠🕡🕢🕣🕤🕥🕦');

  function emojiTime(date) {
    var m, H;
    if (typeof date === 'string') {
      var a = date.split(/\D/, 2);
      m = +a[1] || +a[0].slice(2, 4);
      H = +a[0].slice(0, 2);
    } else {
      var d = date || new Date();
      m = d.getMinutes();
      H = d.getHours();
    }
    var h = (m > 45 ? H + 1 : H) % 12;
    var isHalf = m > 15 && m <= 45;
    return clocks[isHalf ? 12 + h : h];
  }

  return emojiTime;

})));
