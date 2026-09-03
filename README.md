# Stream Deck 1Password Plugin

An [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugin that integrates with [1Password](https://1password.com/) so you can trigger vault actions from your deck.

## Action: 1Password item

Configure a key with a vault and an item from the property inspector, then:

| Gesture | Effect |
| --- | --- |
| Press | Copy the item's username to the clipboard |
| Double press (within 300 ms) | Copy the item's password to the clipboard (cleared after 30 s if still there) |
| Hold (≥ 500 ms) | Depending on the **Hold action** setting: open the item's website in the default browser and copy the password, or copy the current one-time password |

A green check confirms success; a warning triangle means the gesture failed (no account configured, authorization declined, no item selected, missing field, SDK error) — see the plugin logs for details.

## Prerequisites

- macOS 12+ with Stream Deck software 7.1+ (Windows is untested; the clipboard integration uses `pbcopy`)
- Node.js 20+ for building
- The **latest 1Password desktop app** (1Password 8), signed in to your account. The plugin authenticates through the app with the 1Password SDK, so there are no tokens to create or paste, and every vault you can see in the app is available — including your Private vault.

## 1Password setup

1. In the 1Password app, select your account at the top of the sidebar, then open **Settings → Developer** and turn on **Integrate with other apps**.
2. Optionally turn on Touch ID (macOS) or Windows Hello under **Settings → Security** so authorization prompts can be approved biometrically.
3. In the property inspector, enter your **1Password account**: the email address you sign in with, or the account name exactly as shown at the top of the app's sidebar. It is stored in the plugin's global settings and shared by all keys.

The first request from the plugin opens an authorization prompt in the 1Password app; approve it to let the plugin read your vaults. The session expires after 10 minutes of inactivity or when you lock 1Password, in which case the next key press prompts again.

## Development

```bash
npm install
npm run build      # bundles to io.nerd4rent.streamdeck-1password-plugin.sdPlugin/bin/plugin.js
npm test           # gesture detector unit tests
npm run watch      # rebuild and restart the plugin on every change
```

Link the plugin folder into the Stream Deck app once:

```bash
npx streamdeck link io.nerd4rent.streamdeck-1password-plugin.sdPlugin
```

`@1password/sdk` is kept external from the bundle and copied into `bin/node_modules` at build time, because its core loads a WebAssembly file relative to its own location.

## References

| Resource | Link |
| --- | --- |
| Stream Deck SDK (getting started) | https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/ |
| 1Password JS SDK | https://github.com/1Password/onepassword-sdk-js |

See also [`REFERENCES.md`](./REFERENCES.md).

## License

TBD
