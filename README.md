# Lucy & Desi

A cozy website for two domestic shorthair cats in Napa, California.

## How it works

- Plain HTML, CSS, and JavaScript. No build step.
- All content lives in five JSON files at the root of the repo:
  `photos.json`, `posts.json`, `milestones.json`, `weights.json`, `site.json`.
- The pages read those files and render them. Edit the JSON and the site changes.
- The admin panel at `/admin` (Sveltia CMS) edits those files for you and commits
  them to GitHub. Netlify redeploys automatically after every save.
- Photos uploaded through the admin panel are saved in `/uploads`.

## Pages

| Page | File | Content source |
| --- | --- | --- |
| Home | `index.html` | all five files |
| Photos | `gallery.html` | `photos.json` |
| Blog | `blog.html`, `post.html` | `posts.json` |
| Milestones | `milestones.html` | `milestones.json` |
| Growth | `growth.html` | `weights.json` |
| Admin | `admin.html` + `config.yml` | — |

## Editing content

Go to `https://<your-site>/admin`, sign in with GitHub, pick a section, add or
delete entries, and click Save. The site updates within a minute or two.

## Phone

Open the site in your phone's browser and choose "Add to Home Screen". It
installs like an app.
