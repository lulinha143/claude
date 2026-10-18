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

- **Collect nuts:** click the crate near Pip's desk. The team packs half of
  what it makes into it; it is full after about ten minutes, then it glows.
- **Keep a rhythm:** tap a room's machine steadily and the ring around it fills;
  at the top the whole room **rushes** (everyone there works double for 30 s).
- **Take what they found:** when a teammate holds something out beside their
  mood sticker, click it.
- **Buy the next thing:** the paper tag in the corner of the office is your next
  goal; when it turns green, one click buys it.
- **Pet Pip / talk to staff:** click any animal (click again while they are
  talking to sit down with them).
- **Visit a teammate:** when a little speech balloon appears on someone's mood
  sticker (dots: they want to tell you something; a heart: your friendship grew;
  a sparkle: a hint), click it — or use **Visit** on their Team card. A visit has
  three tabs: **Talk** (their story, in three parts that open as you become
  familiar, trusted and close), **Gifts** (try presents to find their favourite)
  and **Scrapbook** (everything you have shared). An answer that costs nuts shows
  its price before you pick it, and when a conversation ends the notepad says
  where their story stands and whether something was set in motion.
- **Keepsakes:** every teammate has a personal object (in a visit, ask about it
  from **Other things on your mind**, the dots beside the topic). Once it is on
  their desk, click it, in the office or in the visit, to read its card in their
  Scrapbook.
- **Play the rooms:** every room's machine has something of its own to do, shown
  as a small tag on it: brew a pot in the Break Room and pour it, tap a jammed
  chute three times to clear it, catch what moves on the security cameras, hand
  over a parcel, pick the show in the broadcast booth. Hover the tag to see what
  it does and who is helping.
- **Look closer:** when a magnifier appears on a corkboard, a shelf or in a
  corner, click it — something odd has turned up. Everything you notice is kept
  in **Archive → Secrets**, and some of it is the Nut Encyclopedia's missing nuts.
  Click a find there to read it again: where and when it turned up, what made it
  possible and where it led. Open leads are listed at the top.
- **See what's happening:** when a teammate holds up a little **!** ticket (and
  the room's name has a **!** too), something has started happening there. It
  waits for you: click the ticket, or click the teammate twice, to look into it
  and decide. Under each answer is what it will do (costs, rewards, who it
  changes); point at an answer and the people it is about show how they would
  take it. What you choose can show up again later, in the office.
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
