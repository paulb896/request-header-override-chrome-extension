import createHeaderAction from './createHeaderAction';
import { OVERRIDE_TYPES } from './constants';

describe('createHeaderAction', () => {
  it('should return redirect action for query param override', () => {
    const action = createHeaderAction({
      overrideType: OVERRIDE_TYPES.QUERY_PARAM,
      name: 'foo',
      value: 'bar'
    });
    
    expect(action).toEqual({
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: {
            addOrReplaceParams: [
              { key: 'foo', value: 'bar' }
            ]
          }
        }
      }
    });
  });

  it('should return modifyHeaders action for header override', () => {
    const action = createHeaderAction({
      overrideType: OVERRIDE_TYPES.HEADER,
      name: 'foo',
      value: 'bar'
    });
    
    expect(action).toEqual({
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'foo', operation: 'set', value: 'bar' }
      ]
    });
  });
});
