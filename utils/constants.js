const CONSTANTS = {
  MAX_HEADER_ID: 9999999,
  DEFAULT_OVERRIDE_TYPE: 'header',
  RESOURCE_TYPES: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'other'],
  RULE_PRIORITY: 1,
  WILDCARD_URL_FILTER: '*',
  STORAGE_KEY: 'requestHeaders'
};

const OVERRIDE_TYPES = {
  HEADER: 'header',
  QUERY_PARAM: 'requestQueryParam'
};

export { CONSTANTS, OVERRIDE_TYPES };