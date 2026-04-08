import { addons } from '@storybook/preview-api';

// Ghost iframes are created by StoryExtractor for component extraction.
// They must not inject the overlay or trigger story-rendered events.
const isGhostIframe = new URLSearchParams(window.location.search).get('vybit-ghost') === '1';

let injected = false;

export const decorators = [
  (StoryFn: any, context: any) => {
    if (!isGhostIframe && !injected) {
      const serverUrl =
        context.parameters?.vybit?.serverUrl ?? 'http://localhost:3333';
      const script = document.createElement('script');
      script.src = `${serverUrl}/overlay.js`;
      script.onerror = (err) => console.error('[vybit-addon] overlay.js FAILED to load', err);
      document.head.appendChild(script);
      injected = true;
    }

    return StoryFn();
  },
];

if (!isGhostIframe) {
  const channel = addons.getChannel();
  let lastStoryId: string | undefined;

  channel.on('storyRendered', (storyId?: string) => {
    // Only reset selection on actual story navigation, not HMR updates
    if (storyId && storyId === lastStoryId) return;
    lastStoryId = storyId;
    window.postMessage({ type: 'STORYBOOK_STORY_RENDERED' }, '*');
  });
}
