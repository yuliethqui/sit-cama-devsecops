import { addIcons } from 'ionicons';
import { bedOutline, personAddOutline, searchOutline, shieldCheckmarkOutline } from 'ionicons/icons';

// Standalone page specs do not construct ShellComponent, which registers these in
// the running app. Register SVGs here so jsdom never fetches relative icon URLs.
addIcons({ bedOutline, personAddOutline, searchOutline, shieldCheckmarkOutline });

// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
