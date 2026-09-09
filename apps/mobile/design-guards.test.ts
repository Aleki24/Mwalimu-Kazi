import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from '@mwalimu/ui/tokens.json';

/**
 * Three rules the type checker cannot see, each of which has already shipped
 * a bug in this app.
 *
 * They are static checks over the source rather than rendering tests: what
 * went wrong each time was structural and visible in the file, and a guard
 * that needs a running app is a guard that gets skipped. Driving the real
 * thing in a browser still catches what these cannot — this is the floor, not
 * the ceiling.
 */

const ROOT = new URL('.', import.meta.url).pathname;

function sources(): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        walk(path);
      } else if (entry.endsWith('.tsx')) {
        out.push(path);
      }
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'components'));
  return out;
}

const FILES = sources().map((path) => ({
  path: relative(ROOT, path),
  src: readFileSync(path, 'utf8'),
}));

/** The opening tag of every `<Pressable …>` in a file, with its line number. */
function pressables(src: string): ReadonlyArray<{ tag: string; line: number }> {
  const out: Array<{ tag: string; line: number }> = [];
  for (const match of src.matchAll(/<Pressable\b/g)) {
    const start = match.index;
    let i = start;
    let depth = 0;
    // Walk to the end of the opening tag, stepping over `{…}` expressions so a
    // `>` inside an arrow function does not end it early.
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0 && src[i - 1] !== '=') break;
      i += 1;
    }
    out.push({ tag: src.slice(start, i), line: src.slice(0, start).split('\n').length });
  }
  return out;
}

describe('press targets', () => {
  /**
   * The Resources download button shipped as a `Pressable` with an
   * `accessibilityLabel`, a nice icon, and no handler at all. It looked
   * identical to a working button and did nothing.
   */
  it('every Pressable either has a handler or is a Link child', () => {
    const orphans: string[] = [];
    for (const { path, src } of FILES) {
      for (const { tag, line } of pressables(src)) {
        if (/\bonPress(?:In|Out)?\b/.test(tag)) continue;
        // `<Link asChild>` passes the press down, so the child needs no handler.
        const before = src.slice(0, src.indexOf(tag));
        if (/<Link\b[^>]*asChild[^>]*>\s*$/.test(before.trimEnd() + '\n')) continue;
        if (/<Link\b(?:(?!<\/Link>)[\s\S]){0,400}$/.test(before)) continue;
        orphans.push(`${path}:${line}`);
      }
    }
    expect(orphans, 'press targets with no handler and no Link parent').toEqual([]);
  });

  /**
   * A Chip is itself a Pressable. Wrapping one in another Pressable to attach
   * the handler puts a hit target on top of the handler: the press lands on
   * the inner Chip and stops. That shipped on onboarding, and was still live
   * on Jobs, News and Resources months later.
   */
  it('no Chip is wrapped in a Pressable', () => {
    const nested: string[] = [];
    for (const { path, src } of FILES) {
      const re = /<Pressable\b[\s\S]{0,300}?<Chip\b/g;
      for (const match of src.matchAll(re)) {
        nested.push(`${path}:${src.slice(0, match.index).split('\n').length}`);
      }
    }
    expect(nested, 'a Chip inside a Pressable swallows the press').toEqual([]);
  });

  /**
   * The job card's bookmark sat inside the card's own Link. Every tap on save
   * also opened the job, and `stopPropagation` did not help: on web the Link
   * is an anchor wrapping the whole card, and an inner press cannot cancel the
   * anchor's own navigation.
   *
   * This is the narrow rule, not "never nest a press target". A dismissing
   * scrim around a sheet that blocks — compose-fab's modal — is Pressable
   * inside Pressable, correct, and shipped working; there stopPropagation does
   * what it says. It is specifically a Link that cannot be escaped.
   */
  it('no press target sits inside a Link', () => {
    const inside: string[] = [];
    for (const { path, src } of FILES) {
      for (const match of src.matchAll(/<Link\b[\s\S]*?<\/Link>/g)) {
        const block = match[0];
        // The first Pressable is the Link's own asChild target, which is the
        // whole point. A second one inside the same Link is the bug.
        const count = [...block.matchAll(/<Pressable\b/g)].length;
        if (count < 2) continue;
        inside.push(`${path}:${src.slice(0, match.index).split('\n').length}`);
      }
    }
    expect(
      inside,
      'a second press target inside a Link: the anchor navigates whatever the inner handler does',
    ).toEqual([]);
  });
});

describe('design tokens', () => {
  /**
   * Tailwind silently drops a class whose colour does not exist, so a renamed
   * token leaves text the wrong colour with nothing failing. `text-danger`
   * lingered that way, and the indigo retune renamed most of the palette.
   */
  it('every colour utility resolves in tokens.json', () => {
    const names = new Set(Object.keys(tokens.colors));
    // Tailwind's own words that share the utility prefixes.
    const builtin = new Set([
      'transparent', 'current', 'inherit', 'black', 'white', 'none', 'auto',
      'clip', 'ellipsis', 'center', 'left', 'right', 'justify', 'start', 'end',
      'top', 'bottom', 'wrap', 'nowrap', 'reverse', 'row', 'col', 'solid',
      'dashed', 'dotted', 'double', 'hidden', 'visible', 'uppercase',
      'lowercase', 'capitalize', 'normal', 'medium', 'light', 'semibold',
      'bold', 'thin', 'tight', 'tighter', 'wide', 'wider', 'widest', 'snug',
      'relaxed', 'loose', 'xs', 'sm', 'base', 'lg', 'xl', 'full', 'pill',
      'px', 'x', 'y', 't', 'b', 'l', 'r', 'se', 'ss', 'ee', 'es',
    ]);
    const prefixes = 'bg|text|border|from|to|via|fill|stroke|ring|decoration|placeholder|divide|outline|shadow|accent|caret';
    const re = new RegExp(`\\b(?:${prefixes})-([A-Za-z][A-Za-z0-9]*)\\b`, 'g');

    const unknown = new Map<string, string>();
    for (const { path, src } of FILES) {
      // Only inside className, because prose is full of words that look like
      // utilities: `must-have` in a comment read as `text-have` and failed
      // this test on its first run.
      const classNames = [
        ...src.matchAll(/className="([^"]*)"/g),
        ...src.matchAll(/className=\{`([^`]*)`\}/g),
      ].map((m) => m[1] ?? '');

      for (const value of classNames) {
        for (const match of value.matchAll(re)) {
          const name = match[1];
          if (name === undefined || builtin.has(name) || names.has(name)) continue;
          if (!unknown.has(name)) unknown.set(name, path);
        }
      }
    }
    expect(
      [...unknown].map(([name, path]) => `${name} (${path})`),
      'colour utilities with no matching token — Tailwind emits nothing for these',
    ).toEqual([]);
  });
});
