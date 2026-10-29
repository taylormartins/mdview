# Third-party software bundled in `vendor/`

| Library | Version | Licence | Licence file |
|---|---|---|---|
| marked | 12.0.2 | MIT | `vendor/marked.LICENSE.md` |
| DOMPurify | 3.1.6 | Apache-2.0 or MPL-2.0 | `vendor/purify.LICENSE` |
| highlight.js (common build + extra grammars in `extras.min.js`) | 11.11.1 | BSD-3-Clause | `vendor/hljs/LICENSE` |
| KaTeX | 0.16.22 | MIT | `vendor/katex/LICENSE` |
| Mermaid | 11.12.0 | MIT | `vendor/mermaid/LICENSE` |
| Silkscreen (font) | - | SIL OFL 1.1 | `vendor/fonts/OFL-Silkscreen.txt` |

Libraries are used unmodified. To update one, replace its file from the matching npm package and re-run `npm test`.
