# Urlaubsplaner 2026 - Deployment & Handover

## 1. Deployment Status
The application is successfully deployed and accessible worldwide.
- **URL**: `https://lateina.github.io/urlaubsplaner/`
- **Source Code**: `/Users/stefan/Library/CloudStorage/Dropbox/Urlaubsplaner/index.html`

## 2. Architecture Overview
This is a **Serverless Single-Page Application**. It relies on external services for data, but the application code itself is static.

### Components
| Component | Function | Persistence |
|-----------|----------|-------------|
| **GitHub Pages** | Hosts the HTML/JS code (the website) | **Permanent**. Runs 24/7 until deleted. |
| **JSONBin.io** | Stores the actual data (Database) | **Permanent**. Managed by the API Key. |
| **Local Storage** | Remembers login & API Key on your device | **Local**. Cleared if you delete browser data. |
| **Antigravity (AI)**| Helps write code | **Temporary**. Not needed for operation. |

## 3. How to Update
Your application runs independently. You only need to touch the code if you want to add features or fix bugs.

### Updating the Code (e.g. adding employees)
1.  Edit `urlaubsplaner_2026.html` (or `index.html`) on your computer.
2.  Commit and Push the changes to GitHub using Git.
    *   Command: `git add . && git commit -m "Update" && git push`
3.  GitHub Pages will automatically update the website within 1-2 minutes.

## 4. Troubleshooting
*   **"Offline" / 401 Error**: Check your Internet connection and re-enter the Master Key. Ensure no spaces are around the key.
*   **Data not showing**: Ensure you are logged in. Try a "Hard Reload" (Ctrl+Shift+R or Cmd+Shift+R).
*   **Safari Layout**: If rows look wrong, reload the page. The CSS has been optimized for Safari but caching can sometimes hold old versions.
