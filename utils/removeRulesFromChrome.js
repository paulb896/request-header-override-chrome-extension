const removeRulesFromChrome = (ruleIds) => {
  if (ruleIds.length === 0) return;

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: ruleIds,
    },
    () => {}
  );
};

export default removeRulesFromChrome;
