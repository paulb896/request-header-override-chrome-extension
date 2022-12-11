
var s = document.createElement('script');
s.src = chrome.runtime.getURL('addHttpInterceptors.bundle.js');
s.onload = function () {
  this.remove();
};

// TODO: Move this to head script or even a background task
(document.documentElement).appendChild(s);
