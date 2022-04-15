import * as t from '@babel/types';
import toBabel from 'estree-to-babel';
import traverse from '@babel/traverse';

export const NO_TITLE = '__sb_undefined__';
export const OF_TITLE = '__sb_of__:';

const getAttr = (elt: t.JSXOpeningElement, what: string): t.JSXAttribute['value'] | undefined => {
  const attr = (elt.attributes as t.JSXAttribute[]).find((n) => n.name.name === what);
  return attr?.value;
};

const extractTitle = (root: t.File, varToImport: Record<string, string>) => {
  let title: string;
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
            if (title) {
              throw new Error('Meta can only be declared once');
            }
            const titleAttr = getAttr(child.openingElement, 'title');
            if (titleAttr) {
              if (t.isStringLiteral(titleAttr)) {
                title = titleAttr.value;
              } else {
                throw new Error(`Expected string literal title, received ${titleAttr.type}`);
              }
            }
            const ofAttr = getAttr(child.openingElement, 'of');
            if (ofAttr) {
              if (t.isJSXExpressionContainer(ofAttr)) {
                const of = ofAttr.expression;
                if (t.isIdentifier(of)) {
                  const importName = varToImport[of.name];
                  if (importName) {
                    title = `${OF_TITLE}${importName}`;
                  } else {
                    throw new Error(`Unknown identifier ${of.name}`);
                  }
                } else {
                  throw new Error(`Expected identifier, received ${of.type}`);
                }
              } else {
                throw new Error(`Expected JSX expression, received ${ofAttr.type}`);
              }
            }
          }
        }
      } else if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
        // Skip string literals
      } else {
        throw new Error(`Unexpected JSX child: ${child.type}`);
      }
    });
  }

  if (title) {
    return title;
  } else {
    return NO_TITLE;
  }
};

export const extractImports = (root: t.File) => {
  const varToImport = {} as Record<string, string>;
  traverse(root, {
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

export const plugin = (store: any) => (root: any) => {
  const imports = root.children.find((child: any) => child.type === 'mdxjsEsm');

  let varToImport = {};
  if (imports) {
    varToImport = extractImports(toBabel(imports.data.estree));
  }

  const estree = store.toEstree(root);
  // toBabel mutates root, bug we don't need to clone it because
  // we're not using it again
  // const clone = cloneDeep(estree);
  const babel = toBabel(estree);
  store.title = extractTitle(babel, varToImport);

  return root;
};

export const analyze = (code: string) => {
  const { compileSync } = require('@mdx-js/mdx');
  const { toEstree } = require('hast-util-to-estree');

  const store = { title: undefined, toEstree } as any;
  compileSync(code, {
    rehypePlugins: [[plugin, store]],
  });
  const { title } = store;
  if (title === NO_TITLE) {
    return { title: undefined };
  } else if (title.startsWith(OF_TITLE)) {
    return { of: title.substring(OF_TITLE.length) };
  }
  return { title };
};
