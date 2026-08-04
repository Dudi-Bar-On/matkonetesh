---
name: playwright-docs-24
description: "Playwright (GUI-walk driver) — vendor doc 24/30 (docs)"
type: reference
---

##### Defaults

Using the default Playwright configuration with the latest Chromium is a good idea most of the time.
Since Playwright is ahead of Stable channels for the browsers, it gives peace of mind that the
upcoming Google Chrome or Microsoft Edge releases won't break your site. You catch breakage
early and have a lot of time to fix it before the official Chrome update.

##### Regression testing

Having said that, testing policies often require regression testing to be performed against
the current publicly available browsers. In this case, you can opt into one of the stable channels,
`"chrome"` or `"msedge"`.

##### Media codecs

Another reason for testing using official binaries is to test functionality related to media codecs.
Chromium does not have all the codecs that Google Chrome or Microsoft Edge are bundling due to
various licensing considerations and agreements. If your site relies on this kind of codecs (which is
rarely the case), you will also want to use the official channel.

##### Enterprise policy

Google Chrome and Microsoft Edge respect enterprise policies, which include limitations to the capabilities, network proxy, mandatory extensions that stand in the way of testing. So if you are part of the organization that uses such policies, it is easiest to use bundled Chromium for your local testing, you can still opt into stable channels on the bots that are typically free of such restrictions.

### Firefox

Playwright's Firefox version matches the recent [Firefox Stable](https://www.mozilla.org/en-US/firefox/new/) build. Playwright doesn't work with the branded version of Firefox since it relies on patches.

Note that availability of certain features, which depend heavily on the underlying platform, may vary between operating systems. For example, available media codecs vary substantially between Linux, macOS and Windows.

### WebKit

Playwright's WebKit is derived from the latest WebKit main branch sources, often before these updates are incorporated into Apple Safari and other WebKit-based browsers. This gives a lot of lead time to react on the potential browser update issues. Playwright doesn't work with the branded version of Safari since it relies on patches. Instead, you can test using the most recent WebKit build.

Note that availability of certain features, which depend heavily on the underlying platform, may vary between operating systems. For example, available media codecs vary substantially between Linux, macOS and Windows. While running WebKit on Linux CI is usually the most affordable option, for the closest-to-Safari experience you should run WebKit on mac, for example if you do video playback.
