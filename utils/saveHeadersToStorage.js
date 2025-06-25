import { CONSTANTS } from './constants.js';
import updateChromeRules from './updateChromeRules.js';

const saveHeadersToStorage = (requestHeaders, removeRuleIds = []) => {
  chrome.storage.local.set({
    [CONSTANTS.STORAGE_KEY]: JSON.stringify(requestHeaders)
  }, () => updateChromeRules(requestHeaders, removeRuleIds));
};

export default saveHeadersToStorage;