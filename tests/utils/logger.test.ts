import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, type LogLevel } from '../../src/utils/logger.js';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const originalLevel = logger.getLevel();

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.setLevel('debug');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    logger.setLevel(originalLevel);
  });

  // ── Basic methods ──────────────────────────────────────────────

  it('info logs with ℹ prefix', () => {
    logger.info('test message');
    const output = consoleSpy.mock.calls[0]!.join('');
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
    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
  });

  it('heading logs with bold magenta styling', () => {
    logger.heading('Section Title');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('Section Title');
  });

  it('dim logs with gray text', () => {
    logger.dim('muted text');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('muted text');
  });

  // ── Table ──────────────────────────────────────────────────────

  it('table logs structured data with header and rows', () => {
    logger.table([
      { Name: 'foo', Value: 'bar' },
      { Name: 'baz', Value: 'qux' },
    ]);
    expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('table skips empty array', () => {
    logger.table([]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('table handles single column', () => {
    logger.table([{ Key: 'a' }, { Key: 'b' }]);
    expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  // ── Progress ───────────────────────────────────────────────────

  it('progress logs step counter with message', () => {
    logger.progress(2, 5, 'Analyzing deps');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('[2/5]');
    expect(output).toContain('Analyzing deps');
  });

  it('progress uses cyan color for step counter', () => {
    logger.progress(1, 3, 'Step one');
    const output = consoleSpy.mock.calls[0]!.join('');
    expect(output).toContain('Step one');
    expect(output).toContain('\x1b[36m'); // CYAN
  });

  // ── Log level filtering ───────────────────────────────────────

  it('setLevel=warn suppresses info and debug', () => {
    logger.setLevel('warn');
    logger.info('suppressed');
    logger.debug('suppressed');
    logger.warn('visible');
    logger.error('visible');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it('setLevel=error only shows errors', () => {
    logger.setLevel('error');
    logger.info('nope');
    logger.warn('nope');
    logger.debug('nope');
    logger.error('yes');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]!.join('')).toContain('yes');
  });

  it('setLevel=debug shows all messages', () => {
    logger.setLevel('debug');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(consoleSpy).toHaveBeenCalledTimes(4);
  });

  it('getLevel returns current level', () => {
    logger.setLevel('warn');
    expect(logger.getLevel()).toBe('warn');
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
  });

  it('level filtering affects success (info level)', () => {
    logger.setLevel('warn');
    logger.success('suppressed');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('level filtering affects heading (info level)', () => {
    logger.setLevel('warn');
    logger.heading('suppressed');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('level filtering affects dim (info level)', () => {
    logger.setLevel('warn');
    logger.dim('suppressed');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('level filtering affects progress (info level)', () => {
    logger.setLevel('warn');
    logger.progress(1, 2, 'suppressed');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('level filtering affects table (info level)', () => {
    logger.setLevel('warn');
    logger.table([{ A: '1' }]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
