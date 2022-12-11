XMLHttpRequest.prototype.realSend = XMLHttpRequest.prototype.send;
var newSend = function (vData) {
  const headerOverrides = JSON.parse(document.body.getAttribute('header-overrides'));

  if (headerOverrides) {
    headerOverrides.map(header => {
      if (header.enabled && this.__sentry_xhr__.url && this.__sentry_xhr__.url.toString().includes(header.urlRegex)) {
        this.setRequestHeader(header.name, header.value);
      }
    });
  }
  this.realSend(vData);
};
XMLHttpRequest.prototype.send = newSend;

const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  let [resource, config] = args;

  const headerOverrides = JSON.parse(document.body.getAttribute('header-overrides'));
  const headerOverrideMap = headerOverrides.reduce((headerMap, header) => {
    if (header.enabled && resource && resource.toString().includes(header.urlRegex)) {
      headerMap[header.name] = header.value;
    }

    return headerMap;
  }, {});

  const updatedConfigs = { ...config, headers: { ...headerOverrideMap, ...(config && config.headers ? config.headers : {}) } };
  const response = await originalFetch(resource, updatedConfigs);

  return response;
};