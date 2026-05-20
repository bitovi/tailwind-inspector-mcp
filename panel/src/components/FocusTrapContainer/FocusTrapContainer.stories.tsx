import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FocusTrapContainer } from './FocusTrapContainer';

const meta: Meta<typeof FocusTrapContainer> = {
  component: FocusTrapContainer,
  title: 'Panel/FocusTrapContainer',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ fontFamily: "'Inter', sans-serif", padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FocusTrapContainer>;

/* ─────────────────────────────────────────────────────────────
   Story 1: Simple trap with buttons
   ───────────────────────────────────────────────────────────── */
export const SimpleTrap: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
      return (
        <div className="p-3 bg-white rounded border border-bit-border">
          <button
            className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
            onClick={() => setIsOpen(true)}
          >
            Reopen Trap
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-[12px] text-bit-text-mid">
          Focus trap is active. Click outside or press Escape to close.
        </div>
        <FocusTrapContainer
          onClose={() => setIsOpen(false)}
          className="p-4 bg-white rounded border-2 border-bit-teal"
        >
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-bit-text">Dropdown Menu</h3>
            <button className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 text-[12px] text-bit-text cursor-pointer">
              Option 1
            </button>
            <button className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 text-[12px] text-bit-text cursor-pointer">
              Option 2
            </button>
            <button className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 text-[12px] text-bit-text cursor-pointer">
              Option 3
            </button>
            <button
              className="block w-full text-left px-2 py-1.5 rounded hover:bg-red-100 text-[12px] text-red-600 cursor-pointer font-medium"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </FocusTrapContainer>
      </div>
    );
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 2: Trap with form inputs
   ───────────────────────────────────────────────────────────── */
export const WithFormInputs: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [value, setValue] = useState('');

    if (!isOpen) {
      return (
        <button
          className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          Reopen Form Trap
        </button>
      );
    }

    return (
      <FocusTrapContainer
        onClose={() => setIsOpen(false)}
        className="p-4 bg-white rounded border-2 border-bit-orange w-64"
      >
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-bit-text">Edit Value</h3>

          <div>
            <label className="block text-[11px] font-medium text-bit-text mb-1">
              Enter new value:
            </label>
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] border border-bit-border rounded focus:outline-none focus:border-bit-teal"
              placeholder="Type something..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              className="flex-1 px-2 py-1.5 text-[11px] font-medium bg-bit-teal text-white rounded cursor-pointer hover:opacity-90"
              onClick={() => {
                console.log('Save:', value);
                setIsOpen(false);
              }}
            >
              Save
            </button>
            <button
              className="flex-1 px-2 py-1.5 text-[11px] font-medium border border-bit-border text-bit-text rounded cursor-pointer hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </FocusTrapContainer>
    );
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 3: Trap with scrollable content
   ───────────────────────────────────────────────────────────── */
export const WithScrollableContent: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
      return (
        <button
          className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          Reopen Scrollable
        </button>
      );
    }

    return (
      <FocusTrapContainer
        onClose={() => setIsOpen(false)}
        className="p-4 bg-white rounded border-2 border-bit-teal max-h-75 overflow-y-auto"
      >
        <div className="space-y-2">
          <h3 className="text-[13px] font-semibold text-bit-text sticky top-0 bg-white pb-2">
            Options
          </h3>

          {Array.from({ length: 20 }, (_, i) => (
            <button
              key={i}
              className="block w-full text-left px-2 py-1 rounded hover:bg-blue-100 text-[12px] text-bit-text cursor-pointer"
              tabIndex={0}
            >
              Option {i + 1}
            </button>
          ))}

          <button
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-red-100 text-[12px] text-red-600 cursor-pointer font-medium mt-3 border-t border-bit-border pt-2"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
        </div>
      </FocusTrapContainer>
    );
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 4: Nested focusable elements
   ───────────────────────────────────────────────────────────── */
export const WithNestedFocusables: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
      return (
        <button
          className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          Reopen Nested
        </button>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-[11px] text-bit-text-mid">
          Tab through all focusable elements. Trap will close when focus moves outside.
        </div>

        <FocusTrapContainer
          onClose={() => setIsOpen(false)}
          className="p-4 bg-white rounded border-2 border-bit-teal space-y-3"
        >
          <h3 className="text-[13px] font-semibold text-bit-text">Color Picker</h3>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-[12px] text-bit-text">
              <input type="radio" name="color" value="red" defaultChecked />
              Red
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[12px] text-bit-text">
              <input type="radio" name="color" value="blue" />
              Blue
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[12px] text-bit-text">
              <input type="radio" name="color" value="green" />
              Green
            </label>
          </div>

          <div className="space-y-2 border-t border-bit-border pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-[12px] text-bit-text">
              <input type="checkbox" /> Apply to all
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              className="flex-1 px-2 py-1.5 text-[11px] font-medium bg-bit-teal text-white rounded cursor-pointer hover:opacity-90"
              onClick={() => setIsOpen(false)}
            >
              Apply
            </button>
            <button
              className="flex-1 px-2 py-1.5 text-[11px] font-medium border border-bit-border text-bit-text rounded cursor-pointer hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
          </div>
        </FocusTrapContainer>
      </div>
    );
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 5: No focusable elements (edge case)
   ───────────────────────────────────────────────────────────── */
export const NoFocusableElements: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
      return (
        <button
          className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          Reopen Empty
        </button>
      );
    }

    return (
      <FocusTrapContainer
        onClose={() => setIsOpen(false)}
        className="p-4 bg-white rounded border-2 border-yellow-500"
      >
        <div className="space-y-2 text-[12px] text-bit-text">
          <p className="font-medium">No interactive elements</p>
          <p className="text-bit-text-mid">Click outside or press Escape to close.</p>
        </div>
      </FocusTrapContainer>
    );
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 6: Escape key behavior
   ───────────────────────────────────────────────────────────── */
export const EscapeBehavior: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [escapeCount, setEscapeCount] = useState(0);

    if (!isOpen) {
      return (
        <div className="space-y-3">
          <div className="text-[12px] text-bit-text">
            Escape key was pressed <span className="font-mono font-bold">{escapeCount}</span> times
          </div>
          <button
            className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
            onClick={() => {
              setIsOpen(true);
              setEscapeCount(0);
            }}
          >
            Test Again
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-[11px] text-bit-text-mid">
          Press Escape to close. Count will increment each time.
        </div>

        <FocusTrapContainer
          onClose={() => {
            setEscapeCount(escapeCount + 1);
            setIsOpen(false);
          }}
          className="p-4 bg-white rounded border-2 border-bit-teal"
        >
          <div className="space-y-3">
            <p className="text-[12px] text-bit-text">
              This container traps focus. Press <kbd className="font-mono bg-gray-100 px-1 rounded">Esc</kbd> to close.
            </p>
            <button className="px-3 py-1.5 text-[11px] font-medium border border-bit-border rounded cursor-pointer hover:bg-gray-50">
              Button 1
            </button>
            <button className="px-3 py-1.5 text-[11px] font-medium border border-bit-border rounded cursor-pointer hover:bg-gray-50">
              Button 2
            </button>
          </div>
        </FocusTrapContainer>
      </div>
    );
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 7: Click-outside behavior
   ───────────────────────────────────────────────────────────── */
export const ClickOutsideBehavior: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [clickCount, setClickCount] = useState(0);

    if (!isOpen) {
      return (
        <div className="space-y-3">
          <div className="text-[12px] text-bit-text">
            Closed <span className="font-mono font-bold">{clickCount}</span> times by clicking outside
          </div>
          <button
            className="px-3 py-1.5 text-[12px] font-medium bg-bit-teal text-white rounded cursor-pointer"
            onClick={() => {
              setIsOpen(true);
              setClickCount(0);
            }}
          >
            Test Again
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-[11px] text-bit-text-mid">
          Click outside the container to close it. Clicking inside won't close it.
        </p>

        <div className="flex gap-4">
          <FocusTrapContainer
            onClose={() => {
              setClickCount(clickCount + 1);
              setIsOpen(false);
            }}
            className="p-4 bg-white rounded border-2 border-bit-teal flex-1"
          >
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-bit-text">Inside container</p>
              <button className="px-2 py-1 text-[11px] border border-bit-border rounded cursor-pointer hover:bg-gray-50">
                Click me
              </button>
            </div>
          </FocusTrapContainer>

          <div className="flex-1 p-4 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
            <p className="text-[12px] text-bit-text-mid">Click here to close</p>
          </div>
        </div>
      </div>
    );
  },
};
