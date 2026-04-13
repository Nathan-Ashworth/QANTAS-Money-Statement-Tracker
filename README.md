# QANTAS Money Statement Tracker

Private-use web app for reviewing QANTAS Money credit card CSV exports locally in the browser.

## What this package is for

This release is prepared for:
- upload to a GitHub repository
- local development with Node.js
- static hosting on GitHub Pages

## Privacy model

This app is designed to process uploaded CSV files **locally in your browser**.

- CSV files are **not uploaded by the app**.
- Imported data is stored in **browser local storage on your device**.
- Do **not** commit real CSV files, statements, or personal exports to Git.
- This project currently has **no backend, no database, no analytics SDK, and no remote API upload path**.

## Included GitHub Pages support

This package includes:
- a Vite config set to `base: './'` for static hosting
- a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`
- a `.gitignore` to keep local files and CSV exports out of Git

## Local run

### 1. Install Node.js
Install the current **LTS** version of Node.js.

### 2. Install dependencies
```bash
npm install
```

### 3. Start the app
```bash
npm run dev
```

### 4. Open it
Vite will show a local address such as:
```text
http://localhost:5173
```

## Local production build test

```bash
npm run build
npm run preview
```

## Upload to GitHub

### Option A: GitHub website upload
1. Create a new GitHub repository.
2. Click **Add file** > **Upload files**.
3. Upload the contents of this folder.
4. Commit to the `main` branch.

### Option B: Git commands
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## Enable GitHub Pages

After the repo is on GitHub:

1. Open the repository on GitHub.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` if you have not already.
5. Wait for the workflow to finish under the **Actions** tab.
6. GitHub will publish the site and show the Pages URL in **Settings** > **Pages**.

## Update workflow later

For future updates:
1. Replace or edit the source files.
2. Commit the changes.
3. Push to `main`.
4. GitHub Pages will redeploy automatically.

## Before pushing to GitHub

1. Confirm there are **no real CSV files** in the repo.
2. Confirm `.gitignore` is present.
3. Confirm you are comfortable with the QANTAS logo being included for **personal use**.
4. Remember that uploaded data will remain in the browser's local storage until you clear it.

## Notes

- Statement logic is account-specific and depends on the configured statement close day.
- Interest figures shown in the UI are estimates unless explicitly matched to actual charged interest rows.
- Browser local storage is device/browser specific. Clearing browser storage will remove saved imported history.
