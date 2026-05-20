/* eslint-disable @typescript-eslint/no-empty-object-type */

/**
 * JSX intrinsic-element declarations for overlay Web Components.
 * Lets us write <vb-design-canvas … /> in React/TSX stories without TS errors.
 */
declare namespace JSX {
  interface IntrinsicElements {
    'vb-design-canvas': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        width?: string;
        height?: string;
        'min-height'?: string;
      },
      HTMLElement
    >;
    'vb-overlay-host': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    'vb-modal-container': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'panel-url'?: string;
        open?: boolean;
      },
      HTMLElement
    >;
    'vb-sidebar-container': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'panel-url'?: string;
        open?: boolean;
        width?: string;
      },
      HTMLElement
    >;
    'vb-popover-container': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'panel-url'?: string;
        open?: boolean;
      },
      HTMLElement
    >;
    'vb-bottom-toolbar': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'selected-tool'?: string;
        'instance-count'?: string;
        disabled?: boolean;
      },
      HTMLElement
    >;
  }
}
