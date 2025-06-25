const removeRulesFromChrome = (ruleIds) => {
  if (ruleIds.length === 0) return;

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds
  }, () => console.log(`Rules removed for ${JSON.stringify(ruleIds)}`));
};

export default removeRulesFromChrome;