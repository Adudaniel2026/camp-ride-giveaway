# CAMP RIDE GIVEAWAY – UMAT

A starter **web-based USSD-style registration simulator**. It is not yet a real mobile-network USSD shortcode.

## Requirements
- Node.js 20 or newer
- Windows, macOS, or Linux

## Run locally on Windows
1. Extract the ZIP file.
2. Open the extracted folder in Visual Studio Code.
3. Open Terminal > New Terminal.
4. Run `npm.cmd install` in PowerShell (or `npm install` in Command Prompt).
5. Copy `.env.example` to a new file named `.env`.
6. Edit `.env` and set a new, unique `ADMIN_PASSWORD` (at least 12 characters) and a long random `SESSION_SECRET`.
7. Run `npm.cmd start`.
8. Open `http://localhost:3000` in your browser.

Generate a random session secret with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Never share your real admin password or session secret. Do not commit `.env` to source control.

## Admin
Open the Administrator section on the page and sign in using the password set in `.env`. You can view registrations and export a CSV file.

## Before public launch
- Obtain permission from the university/event organiser.
- Publish a clear privacy notice and collect only necessary information.
- Use HTTPS, a persistent database, and a production-grade persistent session store.
- The default Express MemoryStore is for local testing only. SQLite data must be stored on persistent disk.
- Add appropriate access controls, backups, retention/deletion procedures, and test the deployment.
- A real `*XXX#` USSD shortcode requires a Ghanaian USSD provider/network aggregator and its approval/configuration. Free website hosting does not itself provide a shortcode.

This is a starter project and should be tested and reviewed before collecting real student data.
