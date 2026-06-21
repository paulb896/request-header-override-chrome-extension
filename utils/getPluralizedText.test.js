import getPluralizedText from './getPluralizedText';

describe('getPluralizedText', () => {
  it('should return singular when count is 1', () => {
    expect(getPluralizedText(1, 'apple', 'apples')).toBe('apple');
  });

  it('should return plural when count is 0', () => {
    expect(getPluralizedText(0, 'apple', 'apples')).toBe('apples');
  });

  it('should return plural when count is > 1', () => {
    expect(getPluralizedText(5, 'apple', 'apples')).toBe('apples');
  });
});
