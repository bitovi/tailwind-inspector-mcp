export interface ArgType {
  control: string;
  options?: string[];
  description?: string;
  defaultValue?: unknown;
  type?: { name: string; required?: boolean };
}

/** A value stored in a ReactNode-eligible prop field */
export type ReactNodeArgValue =
  | { type: 'text'; value: string }
  | {
      type: 'component';
      componentName: string;
      storyId: string;
      componentPath?: string;
      args?: Record<string, unknown>;
      ghostHtml?: string;
      ghostCss?: string;
    };

/** Data stashed in DrawTab when a component is armed, threaded to receptive fields */
export interface ArmedComponentData {
  componentName: string;
  storyId: string;
  componentPath?: string;
  args?: Record<string, unknown>;
  ghostHtml: string;
  ghostCss: string;
}

export interface StoryEntry {
  id: string;
  title: string;  // e.g. "Components/Button"
  name: string;   // e.g. "Primary"
  type?: 'story' | 'docs';  // Storybook index entry type; absent in older SB versions
  tags?: string[];  // e.g. ["autodocs", "design-system"] from Storybook index
  args?: Record<string, unknown>;
  argTypes?: Record<string, ArgType>;
  componentPath?: string; // e.g. "./src/components/Button.tsx" from Storybook index
}

export interface ComponentGroup {
  name: string;       // e.g. "Button" (last segment of title)
  fullTitle: string;  // e.g. "Obra/AlertDialog" (full Storybook title)
  tags: string[];     // union of all story tags in this group
  stories: StoryEntry[];
  argTypes: Record<string, ArgType>;
  componentPath?: string; // resolved from first story's componentPath
}
