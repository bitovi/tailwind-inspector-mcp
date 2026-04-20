import { hexToOklch } from './color-utils';

test('hexToOklch converts black', () => {
  const result = hexToOklch('#000000');
  expect(result).toMatch(/^oklch\(0 0 /);
});

test('hexToOklch converts white', () => {
  const result = hexToOklch('#ffffff');
  // L should be close to 1
  expect(result).toMatch(/^oklch\(1 /);
});

test('hexToOklch converts a known blue', () => {
  const result = hexToOklch('#3b82f6');
  expect(result).toMatch(/^oklch\(/);
  // Should have 3 numeric parts
  const match = result.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  expect(match).toBeTruthy();
  const [, L, C, H] = match!;
  expect(parseFloat(L)).toBeGreaterThan(0.5);
  expect(parseFloat(L)).toBeLessThan(0.8);
  expect(parseFloat(C)).toBeGreaterThan(0);
  expect(parseFloat(H)).toBeGreaterThan(200); // blue hue
  expect(parseFloat(H)).toBeLessThan(280);
});

test('hexToOklch converts pure red', () => {
  const result = hexToOklch('#ff0000');
  expect(result).toMatch(/^oklch\(/);
  const match = result.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  expect(match).toBeTruthy();
  const [, , , H] = match!;
  // Red hue should be around 29
  expect(parseFloat(H)).toBeGreaterThan(15);
  expect(parseFloat(H)).toBeLessThan(35);
});
