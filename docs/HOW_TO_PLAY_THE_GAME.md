# How to Play the Game (Absolute Beginner Guide)

This guide assumes you have **never** used a terminal, Node.js, or GitHub.
Everything is explained. Take it one numbered step at a time.

A few words explained once:

- **Terminal / command line** — a small window where you type commands instead
  of clicking. On Windows it's called **PowerShell**.
- **Folder** — the folder that holds the game's files.
- **Build** — turning the game's source code into a program you can open.
- **Executable (.exe)** — the file you double-click to open the game on Windows.

---

## Option A — Play the already-built game (easiest)

Use this if someone gave you a built copy (a folder with an `.exe` inside), or
after you build it yourself with Option B.

1. Open the folder that contains the game.
   - If you built it yourself, it is: `release\win-unpacked\`
   - (Or, if you made the Steam folder: `release\steam\windows\`)
2. Find the file named **`ZooWorkers.exe`**.
3. **Double-click** it.
4. Windows may show a blue box that says _"Windows protected your PC."_ This is
   normal for new apps that aren't signed yet. Click **More info**, then
   **Run anyway**. (Only do this for a copy you trust.)
5. The game opens in a small cozy window. 🐿️

### Playing in the little window

- **Collect nuts:** click the glowing crate near Pip's desk.
- **Pet Pip / talk to staff:** click any animal.
- **Open menus:** use the tabs at the top (Upgrades, Team, Company, etc.).
- **Move the window:** click-and-drag the **top bar** (the part with the company
  name) to anywhere on your screen — including a corner.
- **Dock to a corner:** open **Settings → Desktop Window → Screen corner** and
  pick one.
- **Always on top (stays visible while you work):** Settings → Desktop Window →
  **Always on top**.
- **Expand to manage:** just click any tab; the window shows the full menus.
- **Hide to the tray:** Settings → Desktop Window → **Hide to tray**, or use the
  little tray icon near the Windows clock. Click the tray icon to bring it back.
- **Mute quickly:** click the **speaker icon** in the top bar. Full controls are
  in **Settings → Audio** (separate volume + mute for Music, Ambience,
  Interface, and Sound Effects).
- **Close completely:** right-click the tray icon → **Quit**, or close the window.

### Where is my save?

Your progress saves automatically on your own computer. On Windows it lives in:

```
C:\Users\<YourName>\AppData\Roaming\zooworkers\
```

To **back it up**: open the game → **Settings → Save & Data → Export** to save a
`.json` file somewhere safe. To restore it later, use **Import**.

---

## Option B — Build the game from the source code

Do this if you downloaded the project (the code) and want to make the `.exe`
yourself.

### Step 1 — Install Node.js (only once, ever)

1. Go to **https://nodejs.org**
2. Click the big button that says **LTS**.
3. Open the downloaded file and click **Next / Install** until it finishes.

To check it worked: open **PowerShell** (press the Windows key, type
`powershell`, press Enter) and type:

```
node --version
```

If you see something like `v20.x.x`, you're good.

### Step 2 — Open the project folder in a terminal

1. Unzip the project if it's a `.zip` (right-click → **Extract All**).
2. Open **PowerShell**.
3. Type `cd ` (the letters c, d, and a space), then **drag the project folder**
   onto the PowerShell window and press **Enter**. The line looks like:
   ```
   cd C:\Users\You\Downloads\zooworkers
   ```

> If PowerShell says scripts are disabled when you run npm, run this once, press
> `S` then Enter, and try again:
>
> ```
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### Step 3 — Install the game's parts (only once per download)

```
npm install
```

Wait for it to finish (1–2 minutes). Yellow "warn" lines are normal — ignore
them.

### Step 4 — Try it in your browser first (fastest)

```
npm run dev
```

It prints a web address like `http://localhost:5173/`. Open your browser, type
`localhost:5173`, press Enter — the game runs. Press **Ctrl + C** in PowerShell
to stop it.

### Step 5 — Build the Windows app

```
npm run build:windows
```

When it finishes, your installer and app appear in the **`release`** folder:

- Installer: `release\ZooWorkers-1.0.0-x64.exe`
- Ready-to-run app folder: `release\win-unpacked\` → double-click
  **`ZooWorkers.exe`** inside it.

A **portable** single-file version (no install needed):

```
npm run build:portable
```

→ `release\ZooWorkers-1.0.0-portable.exe`

### Common problems

- **"npm is not recognized"** → Node.js isn't installed or PowerShell needs to be
  reopened. Redo Step 1 and open a fresh PowerShell.
- **"scripts is disabled"** → run the `Set-ExecutionPolicy` line above.
- **The build fails mentioning `electron`** → make sure you're online the first
  time (it downloads Electron), then run the command again.
- **A blank/white window** → make sure you double-clicked the `.exe` inside
  `release\win-unpacked\`, not a leftover file; rebuild with `npm run build:windows`.

---

Need to test everything before sharing or selling it? See
[`HOW_TO_TEST_BEFORE_STEAM.md`](HOW_TO_TEST_BEFORE_STEAM.md).
Ready to sell on Steam? See [`HOW_TO_PUBLISH_ON_STEAM.md`](HOW_TO_PUBLISH_ON_STEAM.md).
