const largeFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumSignificantDigits: 3,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const fractionFormatter = new Intl.NumberFormat("en-US", {
  notation: "standard",
  maximumFractionDigits: 2,
});

export function getReadableNumber(input: number) {
  if (input < 1) {
    return fractionFormatter.format(input);
  } else if (input < 1000) {
    return integerFormatter.format(input);
  } else {
    return largeFormatter.format(input);
  }
}
