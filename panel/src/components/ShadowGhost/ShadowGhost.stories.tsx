import type { Meta, StoryObj } from '@storybook/react';
import { ShadowGhost } from './ShadowGhost';

const meta: Meta<typeof ShadowGhost> = {
  title: 'Panel/ShadowGhost',
  component: ShadowGhost,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 24, background: '#f5f5f5', borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ShadowGhost>;

/**
 * Simple button element with basic Tailwind styles.
 */
export const SimpleButton: Story = {
  args: {
    ghostHtml: '<button class="px-4 py-2 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600">Click me</button>',
    ghostCss: `
      button {
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        background-color: #3b82f6;
        color: white;
        font-weight: 600;
        border: none;
        cursor: pointer;
      }
      button:hover {
        background-color: #2563eb;
      }
    `,
  },
};

/**
 * Card layout with heading and content.
 */
export const CardLayout: Story = {
  args: {
    ghostHtml: `
      <div class="card">
        <h2 class="heading">Component Preview</h2>
        <p class="content">This is a preview of how your component looks with the applied Tailwind classes.</p>
      </div>
    `,
    ghostCss: `
      .card {
        padding: 1.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background-color: white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }
      .heading {
        font-size: 1.125rem;
        font-weight: 700;
        margin-bottom: 0.75rem;
        color: #111827;
      }
      .content {
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.5;
      }
    `,
  },
};

/**
 * Flex layout with multiple items.
 */
export const FlexLayout: Story = {
  args: {
    ghostHtml: `
      <div class="flex-container">
        <div class="flex-item">Item 1</div>
        <div class="flex-item">Item 2</div>
        <div class="flex-item">Item 3</div>
      </div>
    `,
    ghostCss: `
      .flex-container {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .flex-item {
        flex: 1;
        min-width: 200px;
        padding: 1rem;
        background-color: #e0e7ff;
        border-radius: 0.375rem;
        text-align: center;
        font-weight: 500;
        color: #4338ca;
      }
    `,
  },
};

/**
 * Grid layout with multiple cells.
 */
export const GridLayout: Story = {
  args: {
    ghostHtml: `
      <div class="grid-container">
        <div class="grid-cell">1</div>
        <div class="grid-cell">2</div>
        <div class="grid-cell">3</div>
        <div class="grid-cell">4</div>
      </div>
    `,
    ghostCss: `
      .grid-container {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
      .grid-cell {
        padding: 2rem;
        background-color: #f3e8ff;
        border-radius: 0.375rem;
        text-align: center;
        font-weight: 600;
        color: #7c3aed;
      }
    `,
  },
};

/**
 * Typography example with multiple heading levels.
 */
export const Typography: Story = {
  args: {
    ghostHtml: `
      <div class="text-container">
        <h1 class="h1">Heading 1</h1>
        <h2 class="h2">Heading 2</h2>
        <p class="body">Body text goes here. This demonstrates how text styling is applied to ghost elements.</p>
      </div>
    `,
    ghostCss: `
      .text-container {
        padding: 1.5rem;
      }
      .h1 {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 1rem;
        color: #000;
      }
      .h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        color: #374151;
      }
      .body {
        font-size: 1rem;
        line-height: 1.5;
        color: #6b7280;
      }
    `,
  },
};

/**
 * Interactive elements: links and hover states.
 */
export const InteractiveElements: Story = {
  args: {
    ghostHtml: `
      <nav class="nav">
        <a href="#" class="nav-link">Home</a>
        <a href="#" class="nav-link">About</a>
        <a href="#" class="nav-link">Contact</a>
      </nav>
    `,
    ghostCss: `
      .nav {
        display: flex;
        gap: 1.5rem;
        padding: 1rem;
        background-color: #f9fafb;
        border-radius: 0.375rem;
      }
      .nav-link {
        color: #3b82f6;
        text-decoration: none;
        font-weight: 500;
        padding: 0.5rem;
        border-radius: 0.25rem;
        transition: background-color 0.2s;
      }
      .nav-link:hover {
        background-color: #dbeafe;
      }
    `,
  },
};

/**
 * With custom inline styles applied to the host wrapper.
 */
export const WithCustomStyles: Story = {
  args: {
    ghostHtml: '<div class="box">Custom Style Box</div>',
    ghostCss: `
      .box {
        padding: 1rem;
        background-color: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 0.375rem;
        text-align: center;
        font-weight: 600;
        color: #92400e;
      }
    `,
    style: {
      border: '2px solid #10b981',
      borderRadius: 8,
      padding: 12,
    },
  },
};

/**
 * With custom className applied to the host wrapper.
 */
export const WithCustomClassName: Story = {
  args: {
    ghostHtml: '<div class="content">Content with shadow DOM isolation</div>',
    ghostCss: `
      .content {
        padding: 1.5rem;
        background-color: #ecfdf5;
        border-radius: 0.375rem;
        color: #065f46;
        font-size: 0.875rem;
      }
    `,
    className: 'custom-ghost-wrapper',
  },
};

/**
 * Complex nested structure.
 */
export const NestedStructure: Story = {
  args: {
    ghostHtml: `
      <div class="container">
        <header class="header">
          <h1>Title</h1>
        </header>
        <main class="main">
          <section class="section">
            <h2>Section 1</h2>
            <p>Content here</p>
          </section>
          <section class="section">
            <h2>Section 2</h2>
            <p>More content</p>
          </section>
        </main>
      </div>
    `,
    ghostCss: `
      .container {
        max-width: 600px;
        padding: 1.5rem;
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header {
        margin-bottom: 1.5rem;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 1rem;
      }
      .header h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin: 0;
      }
      .main {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .section {
        padding: 1rem;
        background-color: #f9fafb;
        border-radius: 0.375rem;
      }
      .section h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
      }
      .section p {
        margin: 0;
        color: #6b7280;
      }
    `,
  },
};

/**
 * Minimal example with no CSS.
 */
export const MinimalNoCss: Story = {
  args: {
    ghostHtml: '<div>Unstyled content</div>',
    ghostCss: '',
  },
};

/**
 * Empty ghost (no content).
 */
export const Empty: Story = {
  args: {
    ghostHtml: '',
    ghostCss: '',
  },
};
