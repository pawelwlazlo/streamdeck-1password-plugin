# Stream Deck 1Password Plugin

An [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugin that integrates with [1Password](https://1password.com/) so you can trigger vault actions from your deck.

## Action: 1Password item

Configure a key with a vault and an item from the property inspector, then:

| Gesture | Effect |
| --- | --- |
| Press | Copy the item's username to the clipboard |
| Double press (within 300 ms) | Copy the item's password to the clipboard (cleared after 30 s if still there) |
| Hold (≥ 500 ms) | Depending on the **Hold action** setting: open the item's website in the default browser and copy the password, or copy the current one-time password |

A green check confirms success; a warning triangle means the gesture failed (no token, no item selected, missing field, SDK error) — see the plugin logs for details.

## Prerequisites

- macOS 12+ with Stream Deck software 7.1+ (Windows is untested; the clipboard integration uses `pbcopy`)
- Node.js 20+ for building
- A 1Password **service account** with read access to the vaults you want to use. Service accounts cannot access personal (Private) vaults. Create one at *Developer → Service accounts* in your 1Password account and paste the token into the property inspector — it is stored in the plugin's global settings (a plaintext JSON file under the Stream Deck data directory, protected only by macOS file permissions), never in the key's settings. Use a service account scoped to the minimum vaults you need.

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
