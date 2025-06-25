import { CONSTANTS } from './constants.js';
import createHeaderAction from './createHeaderAction.js';
import getUrlFilter from './getUrlFilter.js';

const createRuleFromHeader = (header) => ({
  id: header.id,
  priority: CONSTANTS.RULE_PRIORITY,
  action: createHeaderAction(header),
  condition: {
    urlFilter: getUrlFilter(header.urlRegex),
    resourceTypes: CONSTANTS.RESOURCE_TYPES
  }
});

export default createRuleFromHeader;