# elfirdoussilab1.github.io

Personal website of Aymane El Firdoussi: https://elfirdoussilab1.github.io

A one-page Jekyll site served by GitHub Pages.

## Editing

| What | Where |
| --- | --- |
| About text, tagline, research interests, software | `_pages/about.md` |
| Name, location, email, profile links (LinkedIn, Scholar, GitHub) | `_config.yml` |
| Page structure | `_layouts/home.html` |
| Styles (blue-white theme) | `assets/css/home.css` |
| Block-diffusion animation of the About text | `assets/js/block-diffusion.js` |
| Photo and favicon | `images/` |
| PDFs (papers, CV, thesis) and lecture notes | `files/`, `resources/` |

Research interests are listed in order of preference.

## Local preview

With Docker Desktop running:

```bash
docker build -t mysite .
docker run --rm -p 4000:4000 -v "$PWD":/usr/src/app mysite
```

Then open http://localhost:4000. Saved changes rebuild automatically, except `_config.yml`, which needs a restart.
