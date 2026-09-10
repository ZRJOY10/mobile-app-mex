/*
 * COMMON JAVASCRIPT
 * Shared bootstrap loaded by every page BEFORE its own script.
 *
 * Purpose: the app stores its session ("data") through the Capacitor
 * Preferences plugin, but the `Capacitor` global only exists inside the
 * native WKWebView. Served in a plain browser it is undefined, which used to
 * throw on the first line of the page scripts and kill the whole file.
 *
 * window.Store mirrors the Capacitor Preferences API, so call sites are
 * identical on device and in a browser:
 *
 *     const { value } = await Store.get({ key: "data" });
 *     await Store.set({ key: "data", value: JSON.stringify(obj) });
 */
(function () {

    function nativePreferences() {
        return window.Capacitor?.Plugins?.Preferences || null;
    }


    window.Store = {

        // true on device, false when served over plain HTTP for testing
        get isNative() {
            return !!nativePreferences();
        },


        async get({ key }) {
            const Preferences = nativePreferences();

            if (Preferences) {
                return Preferences.get({ key });
            }

            // Browser fallback: Preferences returns null (not undefined)
            // for a missing key, so match that exactly.
            return { value: localStorage.getItem(key) };
        },


        async set({ key, value }) {
            const Preferences = nativePreferences();

            if (Preferences) {
                return Preferences.set({ key, value });
            }

            localStorage.setItem(key, value);
        },


        async remove({ key }) {
            const Preferences = nativePreferences();

            if (Preferences) {
                return Preferences.remove({ key });
            }

            localStorage.removeItem(key);
        },


        async keys() {
            const Preferences = nativePreferences();

            if (Preferences) {
                return Preferences.keys();
            }

            return { keys: Object.keys(localStorage) };
        },


        async clear() {
            const Preferences = nativePreferences();

            if (Preferences) {
                return Preferences.clear();
            }

            localStorage.clear();
        }

    };


    console.log(
        "COMMON JS LOADED - storage backend:",
        window.Store.isNative ? "Capacitor Preferences" : "localStorage (browser)"
    );

})();
