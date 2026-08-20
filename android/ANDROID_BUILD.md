# Mantra Sangraha — Android app (Bubblewrap / TWA)

This turns the **live** web app into an Android app for the Play Store using a
**Trusted Web Activity (TWA)**. The app is a thin native shell that opens
`https://mantra-sangraha.onrender.com` full-screen with no browser bar — so it
runs the exact same code as the website. **Every feature is included by
construction**, and every future web deploy updates the Android app automatically.
There is no separate mobile codebase to keep in sync.

- Package ID (permanent): `com.hvtechno.mantrasangraha`
- Domain it wraps: `mantra-sangraha.onrender.com`

> The app is cryptographically bound to that domain. If you later move to a custom
> domain, you rebuild the app pointed at the new domain and re-verify — the
> package ID can stay the same.

---

## 0. Prerequisites (one time)

- **Node** — you already have it.
- **JDK 17** — needed to sign the app. Install Temurin/OpenJDK 17 if you don't
  have it (`java -version` to check). Bubblewrap can also download a JDK and the
  Android SDK for you on first run — accept when it offers.
- A physical Android phone (or emulator) for testing, with **USB debugging** on.

Install the Bubblewrap CLI globally:

```
npm install -g @bubblewrap/cli
```

---

## 1. Generate the Android project

From a NEW empty folder (NOT inside the Next.js repo — keep the Android project
separate), run:

```
bubblewrap init --manifest https://mantra-sangraha.onrender.com/manifest.webmanifest
```

Answer the prompts exactly like this:

| Prompt | Answer |
| --- | --- |
| Domain | `mantra-sangraha.onrender.com` |
| URL path | `/` |
| Application name | `Mantra Sangraha` |
| Short name | `Mantra Sangraha` |
| Application ID | `com.hvtechno.mantrasangraha` |
| Starting version code | `1` |
| Version name | `1.0.0` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / theme color | `#0a0518` |
| Splash screen color | `#0a0518` |
| Icon URL | `https://mantra-sangraha.onrender.com/icons/icon-512.png` |
| Maskable icon URL | `https://mantra-sangraha.onrender.com/icons/maskable-512.png` |
| Include notification delegation? | **Yes** (lets the app show web push later) |
| Signing key — create new? | **Yes** |
| Key store location | `./android.keystore` |
| Key alias | `android` |
| Key store password / key password | **Choose strong ones and SAVE THEM** |

> ⚠️ **Back up `android.keystore` and its passwords somewhere safe.** If you lose
> them you can never publish an update to the same app again. (Play App Signing —
> step 5 — protects the *distribution* key, but you still need this *upload* key.)
>
> A pre-filled `twa-manifest.json` is included in this folder for reference — the
> values above match it. If you prefer, drop it into the Android project folder
> after init and re-run `bubblewrap update` to apply.

---

## 2. Build the app

```
bubblewrap build
```

This produces (in the Android project folder):

- `app-release-signed.aab` — upload THIS to the Play Store.
- `app-release-signed.apk` — for testing on your own phone.

It also prints your **SHA-256 fingerprint** and a ready-made `assetlinks.json`
block. Keep that fingerprint — you need it in step 3. (You can reprint it any time
with `bubblewrap fingerprint list`, or `keytool -list -v -keystore android.keystore`.)

---

## 3. Verify domain ownership (removes the URL bar)

A TWA only hides the browser UI if your site vouches for the app via a Digital
Asset Links file. The repo already contains `public/.well-known/assetlinks.json`
with placeholders — fill in your real fingerprint(s):

1. Open `public/.well-known/assetlinks.json` in the Next.js repo.
2. Replace `REPLACE_WITH_UPLOAD_KEY_SHA256` with the SHA-256 from step 2.
3. Leave `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` for now — you'll fill it in step 5
   (or delete that line if you skip Play App Signing, which is not recommended).
4. Commit and **redeploy** the site.
5. Confirm it's live: open
   `https://mantra-sangraha.onrender.com/.well-known/assetlinks.json` in a browser —
   you should see your JSON.

---

## 4. Test on your phone (before publishing)

```
adb install app-release-signed.apk
```

Open the app. It should launch full-screen with **no address bar**. If you see a
URL bar at the top, the asset link isn't matching yet — check that the fingerprint
is correct and the `assetlinks.json` is actually deployed and reachable. (First
launch can take a few seconds to verify.)

Then do your feature pass — it's the real website, so everything should be there:
search & fetch, the foldable reader, karaoke, Bhava, audio recitations, offline
download, install prompt (harmless inside the app), the Suggest/feedback bell, all
7 languages.

---

## 5. Publish to Google Play

You don't have a developer account yet — register first (one-time ~$25):
https://play.google.com/console/signup

Then:

1. **Create app** → name "Mantra Sangraha", app (not game), free.
2. **Upload** `app-release-signed.aab` to a track (Internal testing first is
   easiest, then Production).
3. **Play App Signing** is on by default — after uploading, go to
   **Setup → App integrity → App signing key certificate** and copy the
   **SHA-256**. Put it in `assetlinks.json` as the second fingerprint
   (`REPLACE_WITH_PLAY_APP_SIGNING_SHA256`), commit, redeploy. (This matters
   because Google re-signs the installed app with its own key.)
4. **Data safety form** — you collect: anonymous feedback text the user types, and
   analytics (Google Analytics). Declare these; you do NOT collect names, emails
   (contact field is optional/user-provided), location, or device IDs tied to a
   person. No data is sold.
5. **Privacy policy URL** — Play requires one. (See "To do" below — I can add a
   `/privacy` page to the app.)
6. **Store listing** — short & full description, at least 2 phone screenshots, a
   512×512 icon (use `public/icons/icon-512.png`), a 1024×500 feature graphic.
7. **Content rating** questionnaire → submit.
8. Roll out to Internal testing, install from the Play link on a real device, then
   promote to Production.

---

## Notes / to-do before store submission

- **Privacy policy page** — required by Play. Ask me and I'll add a `/privacy`
  route to the Next.js app (covers: anonymous feedback, Google Analytics, no
  accounts, offline local storage) and you link it in the listing.
- **Keep the site deployed & the domain stable.** The app is only a window onto
  `mantra-sangraha.onrender.com`; if that URL goes down, the app shows nothing.
- **Custom domain later** = a new build bound to the new domain + new asset links
  (package ID unchanged). Do it before you have many installs to keep it simple.
- **Native push notifications** are possible later (we enabled notification
  delegation), but the in-app "Suggest" bell already works today.
