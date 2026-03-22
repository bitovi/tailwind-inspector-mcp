export { AdaptiveIframe } from './adaptive-iframe';
export { extractStyles, applyStylesToHost, injectChildStyles } from './style-cloner';

import { AdaptiveIframe } from './adaptive-iframe';

if (!customElements.get('adaptive-iframe')) {
  customElements.define('adaptive-iframe', AdaptiveIframe);
}
