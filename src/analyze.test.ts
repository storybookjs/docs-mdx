import { describe, it, expect } from 'vitest';
import { dedent } from 'ts-dedent';
import { extractImports, analyze } from './analyze';

import { parse } from '@babel/parser';

export const babelParse = (code: string) =>
  parse(code, {
    sourceType: 'module',
  });

describe('extractImports', () => {
  it('single block', () => {
    const ast = babelParse(dedent`
      import { Meta } from '@storybook/blocks';
      import * as ButtonStories from './Button.stories';
    `);
    expect(extractImports(ast)).toMatchInlineSnapshot(`
      {
        "ButtonStories": "./Button.stories",
        "Meta": "@storybook/blocks",
      }
    `);
  });

  it('multiple blocks', () => {
    const ast = babelParse(dedent`
      import { Meta } from '@storybook/blocks';

      import * as ButtonStories from './Button.stories';
    `);
    expect(extractImports(ast)).toMatchInlineSnapshot(`
      {
        "ButtonStories": "./Button.stories",
        "Meta": "@storybook/blocks",
      }
    `);
  });
});

describe('analyze', () => {
  describe('title', () => {
    it('string literal title', () => {
      const input = dedent`
        # hello

        <Meta title="foobar" />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [],
          "isTemplate": false,
          "name": undefined,
          "of": undefined,
          "title": "foobar",
        }
      `);
    });

    it('template literal title', () => {
      const input = dedent`
        # hello

        <Meta title={\`foobar\`} />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Expected string literal title, received JSXExpressionContainer]`
      );
    });
  });

  describe('name', () => {
    it('string literal name', () => {
      const input = dedent`
        # hello

        <Meta name="foobar" />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [],
          "isTemplate": false,
          "name": "foobar",
          "of": undefined,
          "title": undefined,
        }
      `);
    });
    it('template literal name', () => {
      const input = dedent`
        # hello

        <Meta name={\`foobar\`} />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Expected string literal name, received JSXExpressionContainer]`
      );
    });
  });

  describe('of', () => {
    it('basic', () => {
      const input = dedent`
        import { Meta } from '@storybook/blocks';
        import * as ButtonStories from './Button.stories';

        <Meta of={ButtonStories} />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [
            "@storybook/blocks",
            "./Button.stories",
          ],
          "isTemplate": false,
          "name": undefined,
          "of": "./Button.stories",
          "title": undefined,
        }
      `);
    });
    it('missing variable', () => {
      const input = dedent`
        <Meta of={meta} />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Unknown identifier meta]`
      );
    });
    it('string literal', () => {
      const input = dedent`
        import * as ButtonStories from './Button.stories';

        <Meta of="foobar" />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Expected JSX expression, received StringLiteral]`
      );
    });
    it('multiple import blocks', () => {
      const input = dedent`
        import { Meta } from '@storybook/blocks';

        import * as ButtonStories from './Button.stories';

        <Meta of={ButtonStories} />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [
            "@storybook/blocks",
            "./Button.stories",
          ],
          "isTemplate": false,
          "name": undefined,
          "of": "./Button.stories",
          "title": undefined,
        }
      `);
    });
  });

  describe('of and name', () => {
    it('gets the name correctly', () => {
      const input = dedent`
        import * as AStories from '../src/A.stories';

        {/* This is the same name as a story */}

        <Meta of={AStories} name="Story One" />

        # Docs with of

        hello docs
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [
            "../src/A.stories",
          ],
          "isTemplate": false,
          "name": "Story One",
          "of": "../src/A.stories",
          "title": undefined,
        }
      `);
    });
  });

  describe('exported named declarations', () => {
    it('should not throw when exporting named declarations', () => {
      const input = dedent`
        <Meta name="foobar" />
        export const status = "ready";
        export const values = [{ name: 'label' }]
      `;
      expect(() => analyze(input)).not.toThrow();
    });
  });

  describe('isTemplate', () => {
    it('boolean implicit', () => {
      const input = dedent`
        <Meta isTemplate />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [],
          "isTemplate": true,
          "name": undefined,
          "of": undefined,
          "title": undefined,
        }
      `);
    });

    // For some reason these two tests throw with:
    //   "TypeError: this[node.value.type] is not a function"
    // It's not clear why?
    it('boolean expression, true', () => {
      const input = dedent`
        <Meta isTemplate={true} />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [],
          "isTemplate": true,
          "name": undefined,
          "of": undefined,
          "title": undefined,
        }
      `);
    });

    it('boolean expression, false', () => {
      const input = dedent`
        <Meta isTemplate={false} />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [],
          "isTemplate": false,
          "name": undefined,
          "of": undefined,
          "title": undefined,
        }
      `);
    });

    it('string literal', () => {
      const input = dedent`
        <Meta isTemplate="foo" />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Expected JSX expression isTemplate, received StringLiteral]`
      );
    });

    it('other expression', () => {
      const input = dedent`
        <Meta isTemplate={1} />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Expected boolean isTemplate, received NumericLiteral]`
      );
    });
  });

  describe('errors', () => {
    it('no title', () => {
      const input = dedent`
      # hello
    `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [],
          "isTemplate": false,
          "name": undefined,
          "of": undefined,
          "title": undefined,
        }
      `);
    });
    it('Bad MDX formatting', () => {
      const input = dedent`
        import meta, { Basic } from './Button.stories';

        <Meta of={meta} />/>
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [
            "./Button.stories",
          ],
          "isTemplate": false,
          "name": undefined,
          "of": undefined,
          "title": undefined,
        }
      `);
    });

    it('duplicate meta, both title', () => {
      const input = dedent`
        <Meta title="foobar" />

        <Meta title="bz" />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Meta can only be declared once]`
      );
    });

    it('duplicate meta, different', () => {
      const input = dedent`
        import * as ButtonStories from './Button.stories';

        <Meta title="foobar" />

        <Meta of={ButtonStories} />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Meta can only be declared once]`
      );
    });
    it('MDX comments', () => {
      const input = dedent`
        import meta, { Basic } from './Button.stories';

        <Meta of={meta} />

        {/* whatever */}
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        {
          "imports": [
            "./Button.stories",
          ],
          "isTemplate": false,
          "name": undefined,
          "of": "./Button.stories",
          "title": undefined,
        }
      `);
    });
  });
});
