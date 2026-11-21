# Synesthesia

A mobile-first live caption room for Bob, built by his son Brian. Friends join with a 4-character code. Bob sees who is speaking — including when voices overlap — and his Android phone vibrates a different pattern for each person.

## What you do

1. Bob taps **Start a room** and reads the code out loud.
2. Everyone else taps **Join a room**, enters their name and the code, then **Tap to speak**.
3. Bob's screen is a rolling 8-second clock. Each person has a row. Words line up with the time ruler, so overlap is visible.
4. Open **Settings → Test haptics** on Bob's phone (Android Chrome, screen on).

Captions use [Deepgram Nova-2](https://deepgram.com/) when a key is saved in Settings. The key stays in the browser and is sent only to Deepgram while the mic is on. With no key, the phone's built-in speech recognition is used. Either way, a line can be typed if the mic is blocked.

Clocks sync to one shared server time (an NTP-style reading when the public time service answers, otherwise the room server itself), so captions from different phones land on the same ruler.

Words travel two ways, and the app keeps whichever arrives:

- a short-lived room relay on the app server (nothing is stored as a transcript archive)
- a direct phone-to-phone link (WebRTC) so a published deploy still works across servers. Only the connection handshake is kept, not the conversation.

## Project layout

```text
src/routes/index.tsx            Welcome, boot animation, start / join
src/routes/room.$code.tsx       Live room
src/routes/api/relay.ts         Live caption relay
src/routes/api/time.ts          Shared clock
src/routes/api/rtc.ts           WebRTC handshake only
src/components/synesthesia/     Screens
src/lib/synesthesia/            Speech, haptics, clock, relay
public/                         Icon, install art, share card
```

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm run build` produces the production build.

## Push to GitHub

Prefer the GitHub CLI so a token never lands in the repo or in the remote URL.

```bash
git init
git add .
git status
git commit -m "Add Synesthesia live caption rooms"
gh auth login
gh repo create synesthesia --private --source=. --remote=origin --push
```

Personal access token, if you cannot use `gh`:

```bash
git remote add origin https://github.com/YOUR_USER/synesthesia.git
gh auth login --with-token < token.txt
git push -u origin HEAD
```

`token.txt` is a local file that is not committed (`.gitignore` excludes secrets). Do not put the token in the remote URL, and do not commit `.env`. There is no `.env` in this project — the Deepgram key is entered on the phone.
