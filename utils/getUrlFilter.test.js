import getUrlFilter from './getUrlFilter';
import { CONSTANTS } from './constants';

describe('getUrlFilter', () => {
  it('should return the urlFilter if provided', () => {
    expect(getUrlFilter('example.com')).toBe('example.com');
  });

  it('should return wildcard if urlFilter is empty string', () => {
    expect(getUrlFilter('')).toBe(CONSTANTS.WILDCARD_URL_FILTER);
  });

  it('should return wildcard if urlFilter is only whitespace', () => {
    expect(getUrlFilter('   ')).toBe(CONSTANTS.WILDCARD_URL_FILTER);
  });

  it('should return wildcard if urlFilter is undefined', () => {
    expect(getUrlFilter(undefined)).toBe(CONSTANTS.WILDCARD_URL_FILTER);
  });

  it('should return wildcard if urlFilter is null', () => {
    expect(getUrlFilter(null)).toBe(CONSTANTS.WILDCARD_URL_FILTER);
  });
});
