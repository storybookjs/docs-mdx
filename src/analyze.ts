import * as t from '@babel/types';
import toBabel from 'estree-to-babel';
import * as babelTraverse from '@babel/traverse';
import { compileSync } from '@mdx-js/mdx';
import { toEstree } from 'hast-util-to-estree';
import { selectAll } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import cloneDeep from 'lodash/cloneDeep';

const getAttr = (elt: t.JSXOpeningElement, what: string): t.JSXAttribute | undefined => {
  const attr = (elt.attributes as t.JSXAttribute[]).find((n) => n.name.name === what);
  return attr;
};

const getAttrValue = (
  elt: t.JSXOpeningElement,
  what: string
): t.JSXAttribute['value'] | undefined => {
  return getAttr(elt, what)?.value;
};

const extractTitle = (root: t.File, varToImport: Record<string, string>) => {
  const result = { title: undefined, of: undefined, name: undefined, isTemplate: false } as {
    title: string | undefined;
    of: string | undefined;
    name: string | undefined;
    isTemplate: boolean;
  };
  let contents: t.ExpressionStatement;
  root.program.body.forEach((child) => {
    if (t.isExpressionStatement(child) && t.isJSXFragment(child.expression)) {
      if (contents) throw new Error('duplicate contents');
      contents = child;
    }
  });
  if (contents) {
    const jsx = contents.expression as t.JSXFragment;
    jsx.children.forEach((child) => {
      if (t.isJSXElement(child)) {
        if (t.isJSXIdentifier(child.openingElement.name)) {
          const name = child.openingElement.name.name;
          if (name === 'Meta') {
            if (result.title || result.name || result.of) {
              throw new Error('Meta can only be declared once');
            }
            const titleAttrValue = getAttrValue(child.openingElement, 'title');
            if (titleAttrValue) {
              if (t.isStringLiteral(titleAttrValue)) {
                result.title = titleAttrValue.value;
              } else {
                throw new Error(`Expected string literal title, received ${titleAttrValue.type}`);
              }
            }
            const nameAttrValue = getAttrValue(child.openingElement, 'name');
            if (nameAttrValue) {
              if (t.isStringLiteral(nameAttrValue)) {
                result.name = nameAttrValue.value;
              } else {
                throw new Error(`Expected string literal name, received ${nameAttrValue.type}`);
              }
            }
            const ofAttrValue = getAttrValue(child.openingElement, 'of');
            if (ofAttrValue) {
              if (t.isJSXExpressionContainer(ofAttrValue)) {
                const of = ofAttrValue.expression;
                if (t.isIdentifier(of)) {
                  const importName = varToImport[of.name];
                  if (importName) {
                    result.of = importName;
                  } else {
                    throw new Error(`Unknown identifier ${of.name}`);
                  }
                } else {
                  throw new Error(`Expected identifier, received ${of.type}`);
                }
              } else {
                throw new Error(`Expected JSX expression, received ${ofAttrValue.type}`);
              }
            }
            const isTemplateAttr = getAttr(child.openingElement, 'isTemplate');
            if (isTemplateAttr) {
              if (!isTemplateAttr.value) {
                // no value, implicit true
                result.isTemplate = true;
              } else if (t.isJSXExpressionContainer(isTemplateAttr.value)) {
                const isTemplate = isTemplateAttr.value.expression;
                if (t.isBooleanLiteral(isTemplate)) {
                  result.isTemplate = isTemplate.value;
                } else {
                  throw new Error(`Expected boolean isTemplate, received ${isTemplate.type}`);
                }
              } else {
                throw new Error(
                  `Expected JSX expression isTemplate, received ${isTemplateAttr.value.type}`
                );
              }
            }
          }
        }
      } else if (t.isJSXExpressionContainer(child)) {
        // Skip string literals & other JSX expressions
      } else {
        throw new Error(`Unexpected JSX child: ${child.type}`);
      }
    });
  }

  return result;
};

/**
 * This is a hack to get around inconsistencies between
 * Babel's own weird interop code AND the typescript types (definitelyTyped)
 * and the fact that we're using `type: "module"` in this package
 * which has some weird behaviors
 */
const getTraverse = (input: any): typeof babelTraverse.default => {
  switch (true) {
    case typeof input === 'function': {
      return input;
    }
    case typeof input.traverse === 'function': {
      return input.traverse;
    }
    case typeof input.default === 'function': {
      return input.default;
    }
    case typeof input.default.default === 'function': {
      return input.default.default;
    }
    default: {
      throw new Error(`Unable to get traverse function from ${input}`);
    }
  }
};

export const extractImports = (root: t.File) => {
  const varToImport = {} as Record<string, string>;
  getTraverse(babelTraverse)(root, {
    ImportDeclaration: {
      enter({ node }) {
        const { source, specifiers } = node;
        if (t.isStringLiteral(source)) {
          specifiers.forEach((s) => {
            varToImport[s.local.name] = source.value;
          });
        } else {
          throw new Error('MDX: unexpected import source');
        }
      },
    },
  });
  return varToImport;
};

export const getHeadings = (root: any) => {
  const headings = [] as string[];
  ['h1', 'h2', 'h3', 'h4'].forEach((tag) => {
    selectAll(tag, root).forEach((node: any) => {
      const heading = toString(node);
      headings.push(heading);
    });
  });
  return headings;
};

export const plugin = (store: any) => (root: any) => {
  const estree = store.toEstree(root);
  const clone = cloneDeep(estree);
  const babel = toBabel(clone);
  const varToImport = extractImports(babel);
  const { title, of, name, isTemplate } = extractTitle(babel, varToImport);
  store.title = title;
  store.of = of;
  store.name = name;
  store.isTemplate = isTemplate;
  store.imports = Array.from(new Set(Object.values(varToImport)));
  store.headings = getHeadings(root);

  return root;
};

export const analyze = (code: string) => {
  const store = {
    title: undefined,
    of: undefined,
    name: undefined,
    isTemplate: false,
    imports: undefined,
    toEstree,
  } as any;
  compileSync(code, {
    rehypePlugins: [[plugin, store]],
  });
  const { title, of, name, isTemplate, imports = [], headings = [] } = store;
  return { title, of, name, isTemplate, imports, headings };
};
