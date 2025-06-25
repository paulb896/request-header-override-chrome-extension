import createRuleFromHeader from './createRuleFromHeader.js';

const addRulesToChrome = (enabledHeaders) => {
  if (enabledHeaders.length === 0) return;

  const rulesToAdd = enabledHeaders.map(createRuleFromHeader);

  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rulesToAdd
  }, () => console.log(`Rules saved for ${JSON.stringify(enabledHeaders)}`));
};

export default addRulesToChrome;