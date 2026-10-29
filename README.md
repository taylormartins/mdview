# md-viewer

Offline Markdown viewer. Renders a `.md` file into a local HTML page and opens it in your default browser. Nothing is uploaded.
- The libraries (marked 12.0.2, DOMPurify 3.1.6) are vendored in `vendor/`.
- The page's Content-Security-Policy is `default-src 'none'`, so it can't make any network request.

## Use
- **Double-click** a `.md` file, if MdView is the default (right-click → Open with → Choose another app → "Markdown (MdView)" → Always).
- **Right-click** a `.md` file → **View Markdown** (on Windows 11 it's under "Show more options").
- From a terminal: `C:\Code\md-viewer\mdview.cmd file.md`

## Features
- GitHub-style rendering, with automatic light and dark themes.
- Tables and relative images.
- A **Copy** button on every code block.

Rendered pages go to `%TEMP%\mdview\`. Reopen the file to see your edits.

## Files
- `mdview.mjs` renders and opens the page.
- `style.css` holds the page styles.
- `mdview.vbs` is the hidden launcher used by the registry entries.

## Uninstall the registry entries
These are per-user only:

    reg delete HKCU\Software\Classes\MdView.Markdown /f
    reg delete HKCU\Software\Classes\SystemFileAssociations\.md\shell\MdView /f
    reg delete HKCU\Software\Classes\.md\OpenWithProgids /v MdView.Markdown /f
