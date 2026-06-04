import { prodDb } from './prod';

describe('Prod DB Connection', () => {
  it('should export a prodDb instance', () => {
    expect(prodDb).toBeDefined();
    expect(prodDb.isProdConnection).toBe(true);
  });
});
