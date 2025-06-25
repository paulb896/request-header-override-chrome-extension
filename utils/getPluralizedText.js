const getPluralizedText = (count, singular, plural) =>
  count === 1 ? singular : plural;

export default getPluralizedText;