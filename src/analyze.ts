import * as t from '@babel/types';
import toBabel from 'estree-to-babel';
import traverse from '@babel/traverse';
import { compileSync } from '@mdx-js/mdx';
import { toEstree } from 'hast-util-to-estree';

const getAttr = (elt: t.JSXOpeningElement, what: string): t.JSXAttribute['value'] | undefined => {
  const attr = (elt.attributes as t.JSXAttribute[]).find((n) => n.name.name === what);
  return attr?.value;
};

const extractTitle = (root: t.File, varToImport: Record<string, string>) => {
  const result = { title: undefined, of: undefined } as {
    title: string | undefined;
    of: string | undefined;
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
            if (result.title) {
              throw new Error('Meta can only be declared once');
            }
            const titleAttr = getAttr(child.openingElement, 'title');
            if (titleAttr) {
              if (t.isStringLiteral(titleAttr)) {
                result.title = titleAttr.value;
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
                    result.of = importName;
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

  return result;
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
  const { title, of } = extractTitle(babel, varToImport);
  store.title = title;
  store.of = of;
  store.imports = Array.from(new Set(Object.values(varToImport)));

  return root;
};

export const analyze = (code: string) => {
  const store = { title: undefined, of: undefined, imports: undefined, toEstree } as any;
  compileSync(code, {
    rehypePlugins: [[plugin, store]],
  });
  const { title, of, imports = [] } = store;
  return { title, of, imports };
};
