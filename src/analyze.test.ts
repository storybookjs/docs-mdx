import { dedent } from 'ts-dedent';
import { analyze, extractImports } from './analyze';

import { parse } from '@babel/parser';

export const babelParse = (code: string) =>
  parse(code, {
    sourceType: 'module',
  });

describe('extractImports', () => {
  const ast = babelParse(dedent`
    import { Meta } from '@storybook/blocks';
    import meta, { Basic } from './Button.stories';
  `);
  expect(extractImports(ast)).toMatchInlineSnapshot(`
    Object {
      "Basic": "./Button.stories",
      "Meta": "@storybook/blocks",
      "meta": "./Button.stories",
    }
  `);
});

describe('analyze', () => {
  describe('title', () => {
    it('string literal title', () => {
      const input = dedent`
        # hello
  
        <Meta title="foobar" />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        Object {
          "imports": Array [],
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
        `"Expected string literal title, received JSXExpressionContainer"`
      );
    });
    it('duplicate titles', () => {
      const input = dedent`
        <Meta title="foobar" />
  
        <Meta title="bz" />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `"Meta can only be declared once"`
      );
    });
  });
  describe('of', () => {
    it('basic', () => {
      const input = dedent`
        import { Meta } from '@storybook/blocks';
        import meta, { Basic } from './Button.stories';

        <Meta of={meta} />
      `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        Object {
          "imports": Array [
            "@storybook/blocks",
            "./Button.stories",
          ],
          "of": "./Button.stories",
          "title": undefined,
        }
      `);
    });
    it('missing variable', () => {
      const input = dedent`
        <Meta of={meta} />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(`"Unknown identifier meta"`);
    });
    it('string literal', () => {
      const input = dedent`
        import meta, { Basic } from './Button.stories';
  
        <Meta of="foobar" />
      `;
      expect(() => analyze(input)).toThrowErrorMatchingInlineSnapshot(
        `"Expected JSX expression, received StringLiteral"`
      );
    });
  });
  describe('errors', () => {
    it('no title', () => {
      const input = dedent`
      # hello
    `;
      expect(analyze(input)).toMatchInlineSnapshot(`
        Object {
          "imports": Array [],
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
        Object {
          "imports": Array [
            "./Button.stories",
          ],
          "of": undefined,
          "title": undefined,
        }
      `);
    });
  });
});
