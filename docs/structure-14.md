# Structure 14 — installation, connection and offline help

Installing LeeOS puts a shortcut and an app-style window around the same Hub address. It does not move the server or database into the browser. They still need to run on this computer.

## Install and open

1. Start a production build at your configured local address. Development mode does not register the offline worker.
2. Open the Hub in a browser supporting PWA installation. Use its install button or menu; some devices offer Add to Home Screen instead. The in-app preview may not expose installation controls.
3. Open **Install, connection and updates** near the bottom of the page. It reports the browser connection hint and whether offline help registered. A network hint does not prove server/database readiness.
4. Installed and ordinary windows use the same address. Owner keys still stay in memory and are cleared by reload/locking. Installation does not save a login.

Browser installation may require HTTPS or a trusted localhost context. Device-specific installation is not guaranteed by the manifest alone. Localhost on a phone refers to that phone, not this PC. Remote access still needs a separate hosting/authentication decision; do not expose the current owner API publicly.

## When disconnected

Only the static offline help page is cached. The worker never caches owner API replies, keys, prompts, workspace pages or saved results. It does not queue work. API requests, including API navigations, remain normal network requests and never receive a pretend successful offline page.

A same-origin page navigation tries the network first. If transport fails, it displays the cached help page. If that fallback is absent, it returns a plain unavailable response. HTTP errors such as 503 are preserved rather than hidden. External pages and assets are not intercepted.

An action accepted before disconnection might already have completed. Reconnect and use Structure 13's saved-run inspection before repeating it. Losing contact does not stop server work. A first visit without a successful worker installation cannot show an offline fallback. This is offline help, not a fully offline application.

## Updates

The browser checks the worker without reusing its HTTP cache. A waiting update appears in the connection panel. LeeOS does not force activation, take over open pages or reload them. Finish work, preserve needed run IDs, lock the Hub, close all LeeOS tabs and installed windows, then reopen. Unsaved prompts and drafts are lost when closed or reloaded.

Once the new worker activates, it removes only older LeeOS shell caches; unrelated browser caches are untouched. The fallback cache version changes with this build. No API migration or new dependency is required.

To uninstall, use the browser or operating system's app controls. Uninstalling a shortcut does not delete PostgreSQL records. Browser site-data removal clears the offline fallback and requires another successful online visit; it is separate from deleting saved work.

See [validation](validation-structure-14.md). The next proposed structure is general scheduling and event management in the Hub, using the existing non-executing coordination APIs. That work waits for Lee.
