import * as t from '@babel/types';
import toBabel from 'estree-to-babel';
import * as babelTraverse from '@babel/traverse';
import { compileSync } from '@mdx-js/mdx';
import { toEstree } from 'hast-util-to-estree';
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

const getJSXElements = (jsxParent: t.JSXFragment, elementName: string) => {
  return jsxParent.children.filter((child: t.JSXElement) => {
    if (t.isJSXElement(child)) {
      if (t.isJSXIdentifier(child.openingElement.name)) {
        const name = child.openingElement.name.name;
        return name.toLowerCase() === elementName.toLowerCase();
      }
    }
    return false;
  }) as t.JSXElement[];
};

const extractTitle = (root: t.File, varToImport: Record<string, string>) => {
  const result = {
    title: undefined,
    of: undefined,
    name: undefined,
    isTemplate: false,
    tags: [],
  } as {
    title: string | undefined;
    of: string | undefined;
    name: string | undefined;
    isTemplate: boolean;
    tags: string[];
  };
  let contents: t.ExpressionStatement;
  root.program.body.forEach((child: t.JSXElement) => {
    if (t.isExpressionStatement(child) && t.isJSXFragment(child.expression)) {
      if (contents) throw new Error('duplicate contents');
      contents = child;
    }
  });
  if (contents) {
    const jsx = contents.expression as t.JSXFragment;
    const children = getJSXElements(jsx, 'Meta');

    if (children.length) {
      children.forEach((child) => {
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
        const tagsAttr = getAttr(child.openingElement, 'tags');
        if (tagsAttr) {
          if (t.isJSXExpressionContainer(tagsAttr.value)) {
            const tags = tagsAttr.value.expression;
            if (t.isArrayExpression(tags)) {
              result.tags = tags.elements
                .map((el: any) => {
                  if (t.isStringLiteral(el)) {
                    return el.value;
                  } else {
                    throw new Error(`Expected string literal title, received ${el.type}`);
                  }
                })
                .filter(Boolean);
            }
          }
        }
      });
    }
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
      enter({ node }: { node: t.ImportDeclaration }) {
        const { source, specifiers } = node;
        if (t.isStringLiteral(source)) {
          specifiers.forEach((s: t.ImportDeclaration) => {
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

export const plugin = (store: any) => (root: any) => {
  const estree = store.toEstree(root);
  const clone = cloneDeep(estree);
  const babel = toBabel(clone);
  const varToImport = extractImports(babel);
  const { title, of, name, isTemplate, tags } = extractTitle(babel, varToImport);
  store.title = title;
  store.of = of;
  store.name = name;
  store.isTemplate = isTemplate;
  store.tags = tags;
  store.imports = Array.from(new Set(Object.values(varToImport)));

  return root;
};

export const analyze = (code: string) => {
  const store = {
    title: undefined,
    of: undefined,
    name: undefined,
    isTemplate: false,
    imports: undefined,
    tags: undefined,
    toEstree,
  } as any;
  compileSync(code, {
    rehypePlugins: [[plugin, store]],
  });
  const { title, of, name, isTemplate, imports = [], tags = [] } = store;
  return { title, of, name, isTemplate, imports, tags };
};
