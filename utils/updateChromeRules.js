import createRuleFromHeader from './createRuleFromHeader.js';
import logCurrentRules from './logCurrentRules.js';

const updateChromeRules = (headerOverrides, removeRuleIds = []) => {
  const enabledHeaders = headerOverrides.filter(header => header.enabled);
  const rulesToAdd = enabledHeaders.map(createRuleFromHeader);
  // Remove all IDs that will be added, plus any explicit removals
  const allRemoveIds = [
    ...new Set([
      ...removeRuleIds,
      ...rulesToAdd.map(rule => rule.id)
    ])
  ];

  // Use Chrome's declarativeNetRequest API to update rules in a single operation
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: allRemoveIds,
    addRules: rulesToAdd
  }, () => {
    console.log(`Rules updated: removed ${allRemoveIds.length}, added ${rulesToAdd.length}`);
    logCurrentRules();
  });
};

export default updateChromeRules;