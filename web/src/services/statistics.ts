import type { NumberStatistics } from '../types';

const percentile = (sorted: number[], fraction: number): number => {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

export const calculateNumberStatistics = (values: number[]): NumberStatistics | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length;
  const variance = sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / sorted.length;
  return {
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    mean,
    median: percentile(sorted, 0.5),
    standardDeviation: Math.sqrt(variance),
    firstQuartile: percentile(sorted, 0.25),
    thirdQuartile: percentile(sorted, 0.75),
  };
};

export const formatNumber = (value: number, maximumFractionDigits = 1): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
