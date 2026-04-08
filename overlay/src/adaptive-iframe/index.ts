export { AdaptiveIframe } from './adaptive-iframe';

import { AdaptiveIframe } from './adaptive-iframe';

if (!customElements.get('adaptive-iframe')) {
  customElements.define('adaptive-iframe', AdaptiveIframe);
}
