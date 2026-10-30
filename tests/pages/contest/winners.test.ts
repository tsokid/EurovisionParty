import { describe, it, expect } from 'vitest';
import { cancelledWithin, winnersData } from '@/pages/contest/winners';
import contestIndex from '../../../content/contests/index.json';
import type { ContestIndex } from '@/content/contests/types';

const data = winnersData(contestIndex as ContestIndex, 'en');

describe('cancelledWithin', () => {
  it('finds 2020 only when it is inside the window', () => {
    expect(cancelledWithin(data.all, 2010, 2025)).toBe(2020);
    expect(cancelledWithin(data.all, 2021, 2025)).toBeNull();
    expect(cancelledWithin(data.all, 1956, 2019)).toBeNull();
  });
});
