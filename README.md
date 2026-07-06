# Courtesy Car Log - GitHub Pages Setup

Upload these files to a GitHub repository:

- `index.html`
- `config.js`
- `green-motors-logo.png`

Then enable GitHub Pages for the repository.

## How It Works

- GitHub Pages opens the form on any device.
- Google Apps Script receives the saved form entry.
- Google Sheets stores the entry in `MasterData`.
- Google Sheets tab `Lists` controls the courtesy car and service advisor dropdowns.

## Important

The Apps Script Web App URL is already stored in `config.js`.

If the Apps Script deployment URL changes later, update this line in `config.js`:

```js
window.COURTESY_CAR_WEB_APP_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL';
```

If you update the form features, also replace your Apps Script `Code.gs` with the latest `google_apps_script_code.gs` file and redeploy the Web App.

## Search / Return Update

Use the **Search** button beside Transaction Number to load an existing entry. After it loads, change **Date / Time Returned** and click **Update Return Date/Time**. This edits the same row in `MasterData`.

## GitHub Pages Steps

1. Create a new GitHub repository.
2. Upload `index.html`, `config.js`, and `green-motors-logo.png`.
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/root`.
6. Save.
7. Open the GitHub Pages URL shown by GitHub.
