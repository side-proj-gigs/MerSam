import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../../src');

function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

function importsIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  const pattern = /(?:from\s+|import\s*\()['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]!);
  return specifiers;
}

function offenders(layer: string, forbidden: RegExp): { file: string; specifier: string }[] {
  return filesUnder(path.join(SRC, layer)).flatMap((file) =>
    importsIn(file)
      .filter((specifier) => forbidden.test(specifier))
      .map((specifier) => ({ file: path.relative(SRC, file).replace(/\\/g, '/'), specifier })),
  );
}

/**
 * The dependency rule is the whole point of the layering, and it is the kind of
 * thing that erodes one convenient import at a time. These tests fail the build
 * rather than let that happen quietly.
 */
describe('architecture boundaries', () => {
  it('the domain depends on nothing but itself', () => {
    // No framework, no database, no application or infrastructure code.
    const forbidden = /^(next|react|drizzle|pg$|@neondatabase|zod|bcryptjs|jose|@infra|@app-layer|@\/)/;
    expect(offenders('core', forbidden)).toEqual([]);
  });

  it('use cases depend on ports, never on infrastructure', () => {
    const forbidden = /^(@infra|drizzle|pg$|@neondatabase|next|bcryptjs|jose|@\/lib|@\/components)/;
    expect(offenders('application', forbidden)).toEqual([]);
  });

  it('the domain and use cases stay free of UI imports', () => {
    for (const layer of ['core', 'application']) {
      expect(offenders(layer, /^(@\/components|@\/hooks)/)).toEqual([]);
    }
  });

  it('infrastructure is wired in exactly one composition root', () => {
    const roots = filesUnder(path.join(SRC, 'infrastructure')).filter((file) =>
      /container\.ts$/.test(file),
    );
    expect(roots).toHaveLength(1);
  });

  it('nothing asks the browser to confirm, alert or prompt', () => {
    // These are the only controls in the product that cannot be designed,
    // cannot say what is about to happen, and name the action "OK". They were
    // replaced by ConfirmProvider, and this is what keeps them gone: reaching
    // for window.confirm is a one-line convenience that would otherwise creep
    // back the next time somebody wants a quick guard.
    const pattern = /(?<![\w.$])(?:window\s*\.\s*)?(confirm|alert|prompt)\s*\(/;
    const posix = (file: string) => path.relative(SRC, file).split(path.sep).join('/');

    const offending = filesUnder(SRC)
      // The replacement itself is allowed to name what it replaces.
      .filter((file) => posix(file) !== 'components/ui/confirm.tsx')
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, index) => ({ line: line.trim(), number: index + 1, file }))
          // A call site, not a comment, a prop name or a type.
          .filter((entry) => pattern.test(entry.line))
          .filter((entry) => !entry.line.startsWith('*') && !entry.line.startsWith('//'))
          .filter(
            (entry) => !/\b(confirmLabel|confirmPassword|onConfirm|useConfirm)\b/.test(entry.line),
          )
          .map((entry) => `${posix(entry.file)}:${entry.number}`),
      );

    expect(offending).toEqual([]);
  });

  it('route handlers reach the database only through the dependency builders', () => {
    const direct = filesUnder(path.join(SRC, 'app')).flatMap((file) =>
      importsIn(file)
        .filter((specifier) => /@infra\/db\/(client|schema)/.test(specifier))
        .map((specifier) => ({ file: path.relative(SRC, file).replace(/\\/g, '/'), specifier })),
    );

    // The health probe is the one honest exception: its whole job is to prove
    // the database connection itself is alive.
    expect(direct.filter((entry) => !entry.file.includes('health'))).toEqual([]);
  });
});
