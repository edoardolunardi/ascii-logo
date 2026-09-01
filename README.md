# ASCII Logo

_The Codrops mark as a draggable 3D solid, printed in ASCII characters on the GPU._

![Image Title](https://tympanus.net/codrops/wp-content/uploads/2026/09/split-article-cover-scaled.png)

[Article on Codrops](https://tympanus.net/codrops/?p=TODO)

[Demo](https://tympanus.net/Tutorials/ASCIILogo/)

## Features

- **Real geometry** - a swept solid with domed faces, not an extruded disc faked in shading
- **Glyph search on the GPU** - every character cell picks its own glyph from 95 candidates each frame
- **Drag to orbit** - pointer drag with damping, easing back into an idle float on release
- **Light and dark** - one switch flips the page, the ink, and the direction the tone runs
- **No framework** - a single `<ascii-logo>` custom element

## Getting Started

```bash
nvm use
npm install
npm run dev
```

## Tech Stack

- three.js
- WebGL2 and GLSL
- Custom elements
- Vanilla HTML, CSS and JavaScript
- Vite

## Credits

- Type set in [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

## Misc

Follow Edoardo: [Instagram](https://www.instagram.com/edo.tsx/), [GitHub](https://github.com/edoardolunardi), [LinkedIn](https://www.linkedin.com/in/edoardolunardi/), [X](https://x.com/edo_lunardi)

Follow Codrops: [X](http://www.x.com/codrops), [Facebook](https://www.facebook.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [LinkedIn](https://www.linkedin.com/company/codrops/), [GitHub](https://github.com/codrops)

## License

[MIT](LICENSE)
