const logCurrentRules = () => {
  chrome.declarativeNetRequest.getDynamicRules(rawRules => {
    console.log('Current rules:', rawRules);
  });
};

export default logCurrentRules;