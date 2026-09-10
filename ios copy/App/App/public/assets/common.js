(function () {

    function nativePreferences() {
        return window.Capacitor?.Plugins?.Preferences || null;
    }

    window.Store = {

        get isNative() {
            return !!nativePreferences();
        },

        async get({ key }) {
            const Preferences = nativePreferences();

            if (Preferences) {
                return Preferences.get({ key });
            }

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
