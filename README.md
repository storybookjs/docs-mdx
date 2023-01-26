## @storybook/docs-mdx

Storybook MDX docs is a small library that analyzes the contents of a `.docs.mdx` file and produces metadata about its contents.

This is an internal library, used to help generate the Storybook's `index.json`, the static index of all the contents of your storybook.

It currently produces:

| name       | example                                                         | description                                                                                                          |
| ---------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| imports    | `import * from './Button.stories'`                              | The list of ESM imports                                                                                              |
| of         | `<Meta of={buttonMeta}>`                                        | A title specified by an imported object, e.g. coming from a `.stories.ts` file                                       |
| title      | `<Meta title="x">`                                              | A manually specified title; this title is used for indexing the stories and displaying them in the Storybook sidebar |
| name       | `<Meta name="x">`                                               | A manually defined Docs name; this value overrides `docs.defaultName` in `main.js`                                   |
| tags       | `<Meta tags={["docs"]} />`                                      | A list of tags that are used to influence the docs story.                                                            |
| isTemplate | `<Meta isTemplate={true} />` <br/>OR<br/> `<Meta isTemplate />` | `true` value indicates this file is not to be indexed by `Storybook` as it is being used as a template by other docs |

## Getting Started

- This small library is used exclusively by `Storybook` for the sole purpose of extracting values from `.mdx` files that will be used to populate the `index.json` file (formerly `stories.json`).

- Starting by importing the `analyze` method into your code like so:

```tsx
import { analyze } from '@storybook/docs-mdx';
```

- Followed by reading the contents of the docs.(md|mdx|html) file:

```tsx
const content = fs.readFileSync(absolutePath, 'utf-8');
```

- Finally, calling the `analyze` method with the content as argument to retrieve the destructured properties:

```tsx
const result: {
  title?: ComponentTitle;
  of?: Path;
  name?: StoryName;
  isTemplate?: boolean;
  imports?: Path[];
  tags?: Tag[];
} = analyze(content);
```

## Contributing

We welcome contributions to Storybook!

- 📥 Pull requests and 🌟 Stars are always welcome.
- Read our [contributing guide](CONTRIBUTING.md) to get started,
  or find us on [Discord](https://discord.gg/storybook), we will take the time to guide you

## License

[MIT](https://github.com/storybookjs/docs-mdx/blob/main/LICENSE)
