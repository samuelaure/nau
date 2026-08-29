import type { SystemConfig } from '../../core/contract';

/**
 * Settings that belong to the Gregorian calendar and to no other.
 *
 * Which day opens a week is a question only this calendar can be asked. The naŭ
 * calendar counts in nines that reset with the month and has no weekday to
 * start from; a lunation begins when the Sun and Moon say so. Hanging the
 * setting off the person rather than the calendar would force every other
 * system to carry an option that means nothing to it.
 */
export interface GregorianConfig {
  /**
   * 0 = Sunday, 1 = Monday.
   *
   * Defaults to Sunday. ISO 8601 says Monday and much of Europe agrees, but the
   * default is a product decision rather than a standards one, and plenty of
   * the world opens its week on Sunday.
   *
   * Existing workspaces are unaffected: migration `20260824180000_calendar_config`
   * wrote `firstDayOfWeek: 1` into every row that existed, so their value is
   * stored rather than inherited and nobody's weeks move underneath them. Only
   * workspaces created from here on get Sunday.
   */
  firstDayOfWeek: 0 | 1;
}

export const DEFAULT_GREGORIAN_CONFIG: GregorianConfig = {
  firstDayOfWeek: 0,
};

/**
 * Reads a stored config, filling in what is missing.
 *
 * Config arrives as opaque JSON from the database, so this is the one place it
 * becomes typed. A malformed value falls back to the default rather than
 * throwing: a bad row should not take down the period calculation for every
 * workspace queued behind it.
 */
export function readConfig(config: SystemConfig): GregorianConfig {
  const raw = config['firstDayOfWeek'];
  const firstDayOfWeek = raw === 0 || raw === 1 ? raw : DEFAULT_GREGORIAN_CONFIG.firstDayOfWeek;
  return { firstDayOfWeek };
}

/** What is wrong with this config, if anything. Empty means it is usable. */
export function validateConfig(config: SystemConfig): readonly string[] {
  const problems: string[] = [];
  const raw = config['firstDayOfWeek'];
  if (raw !== undefined && raw !== 0 && raw !== 1) {
    problems.push('firstDayOfWeek must be 0 (Sunday) or 1 (Monday)');
  }
  return problems;
}
