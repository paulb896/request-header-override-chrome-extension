import { CONSTANTS } from './constants.js';

const getUrlFilter = (urlRegex) =>
  urlRegex && urlRegex.trim() ? urlRegex : CONSTANTS.WILDCARD_URL_FILTER;

export default getUrlFilter;