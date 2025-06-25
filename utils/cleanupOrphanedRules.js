import removeRulesFromChrome from './removeRulesFromChrome.js';

const cleanupOrphanedRules = (requestOverrides) => {
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    const orphanedRules = rules.filter(rule =>
      !requestOverrides.find(override => override.id === rule.id)
    );

    if (orphanedRules.length > 0) {
      const orphanedRuleIds = orphanedRules.map(rule => rule.id);
      removeRulesFromChrome(orphanedRuleIds);
    }
  });
};

export default cleanupOrphanedRules;