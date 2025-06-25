import { OVERRIDE_TYPES } from './constants.js';

const createHeaderAction = (header) => {
  if (header.overrideType === OVERRIDE_TYPES.QUERY_PARAM) {
    return {
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: {
            addOrReplaceParams: [{
              key: header.name,
              value: header.value
            }]
          }
        }
      }
    };
  }

  return {
    type: 'modifyHeaders',
    requestHeaders: [
      { header: header.name, operation: 'set', value: header.value }
    ]
  };
};

export default createHeaderAction;