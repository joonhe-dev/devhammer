import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, type LogLevel } from './logger.js';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const originalLevel = logger.getLevel();

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.setLevel('debug'); // show all messages by default in tests
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    logger.setLevel(originalLevel);
  });

  it('info logs with ℹ prefix', () => {
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0]!;
    const output = call.join('');
    expect(output).toContain('ℹ');
    expect(output).toContain('test message');
  });

  it('success logs with ✔ prefix', () => {
    logger.success('done');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('✔');
    expect(output).toContain('done');
  });

  it('warn logs with ⚠ prefix', () => {
    logger.warn('caution');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('⚠');
    expect(output).toContain('caution');
  });

  it('error logs with ✖ prefix', () => {
    logger.error('failed');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('✖');
    expect(output).toContain('failed');
  });

  it('debug logs with timestamp', () => {
    logger.debug('debug msg');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('debug msg');
    // Should contain a timestamp in brackets
    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
  });

  it('heading logs with bold magenta', () => {
    logger.heading('Section Title');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('Section Title');
  });

  it('dim logs with gray text', () => {
    logger.dim('muted text');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('muted text');
  });

  it('table logs structured data', () => {
    logger.table([
      { Name: 'foo', Value: 'bar' },
      { Name: 'baz', Value: 'qux' },
    ]);
    // Should have logged header, separator, and 2 rows
    expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('table skips empty array', () => {
    logger.table([]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  // ── progress ──────────────────────────────────────────────────

  it('progress logs step counter with message', () => {
    logger.progress(2, 5, 'Analyzing deps');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('[2/5]');
    expect(output).toContain('Analyzing deps');
  });

  // ── log level filtering ──────────────────────────────────────

  it('setLevel filters messages below current level', () => {
    logger.setLevel('warn');
    logger.info('should be suppressed');
    logger.debug('should also be suppressed');
    logger.warn('should appear');
    logger.error('should also appear');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    const outputs = consoleSpy.mock.calls.map((c) => c.join(''));
    expect(outputs[0]).toContain('should appear');
    expect(outputs[1]).toContain('should also appear');
  });

  it('setLevel=error only shows errors', () => {
    logger.setLevel('error');
    logger.info('nope');
    logger.warn('nope');
    logger.error('yes');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]!.join('')).toContain('yes');
  });

  it('getLevel returns current level', () => {
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
    logger.setLevel('warn');
    expect(logger.getLevel()).toBe('warn');
  });
});
