# PRATAMA NEWS

Responsive market-news site for US stocks, Indonesian stocks, crypto, gold, and USD/forex. It includes a one-click dark-theme control, live Bing News RSS results, thumbnails when the feed provides them, and keyword-based sentiment/impact notes.

## Run locally

1. Install Node.js if needed.
2. Double-click `start.bat`.
3. Open the exact `http://127.0.0.1:<port>` address printed by the server. Leave the server window open while using the site.

## Publish to GitHub Pages for phone access

GitHub Pages publishes the static page, while the live news API needs a separate server. This project includes `worker.js` for that API and a GitHub Actions workflow for the site.

1. Create a GitHub repository named `pratama-news` and add the contents of this folder to its `main` branch. Keep the `.github/workflows/pages.yml` path intact.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the publishing source. The included workflow deploys the site after a push to `main`.
3. In Cloudflare, create and deploy a Worker using `worker.js`. It serves the `/api/news` endpoint and reads Bing News RSS.
4. Copy the Worker origin, such as `https://pratama-news-api.example.workers.dev`, into `config.js`:

   ```js
   window.PRATAMA_API_BASE = 'https://YOUR-WORKER-URL';
   ```

5. Commit that change to GitHub. After the Pages workflow finishes, the site will be available at `https://YOUR-GITHUB-USERNAME.github.io/pratama-news/` and can be opened on a phone.

GitHub Pages serves static files, so the site does not have a public URL until it is pushed to a repository and Pages is enabled. See [GitHub's Pages deployment guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Notes

- The dark/light choice is saved in the browser on each device.
- News coverage depends on the Bing News index; it is not an exhaustive feed of every company release.
- Sentiment and market impacts are keyword-based estimates, not verified conclusions or investment recommendations.
