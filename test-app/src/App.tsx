import GitHubButton from 'react-github-btn'
import { Button } from './components/Button'
import { Card } from './components/Card'
import { Badge } from './components/Badge'
import { Input } from './components/Input'
import { TutorialSection } from './TutorialSection'
import { useTutorialProgress } from './useTutorialProgress'

// Inline icons matching the panel's ModeToggle buttons, rendered at text size
function SelectIcon() {
  return (
    <span className="inline-flex align-middle mx-0.5 rounded bg-[#1a1a1a] p-0.5">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="#5fd4da">
        <path d="M14,0H2C.895,0,0,.895,0,2V14c0,1.105,.895,2,2,2H6c.552,0,1-.448,1-1h0c0-.552-.448-1-1-1H2V2H14V6c0,.552,.448,1,1,1h0c.552,0,1-.448,1-1V2c0-1.105-.895-2-2-2Z"/>
        <path d="M12.043,10.629l2.578-.644c.268-.068,.43-.339,.362-.607-.043-.172-.175-.308-.345-.358l-7-2c-.175-.051-.363-.002-.492,.126-.128,.129-.177,.317-.126,.492l2,7c.061,.214,.257,.362,.48,.362h.009c.226-.004,.421-.16,.476-.379l.644-2.578,3.664,3.664c.397,.384,1.03,.373,1.414-.025,.374-.388,.374-1.002,0-1.389l-3.664-3.664Z"/>
      </svg>
    </span>
  )
}

function InsertIcon() {
  return (
    <span className="inline-flex align-middle mx-0.5 rounded bg-[#1a1a1a] p-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5fd4da" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <rect x="4" y="2" width="16" height="8" rx="2"/>
        <path d="m17,14h1c1.105,0,2,.895,2,2"/>
        <path d="m4,16c0-1.105.895-2,2-2h1"/>
        <path d="m7,22h-1c-1.105,0-2-.895-2-2"/>
        <path d="m20,20c0,1.105-.895,2-2,2h-1"/>
        <line x1="13" y1="14" x2="11" y2="14"/>
        <line x1="13" y1="22" x2="11" y2="22"/>
      </svg>
    </span>
  )
}

function BugReportIcon() {
  return (
    <span className="inline-flex align-middle mx-0.5 rounded bg-[#1a1a1a] p-0.5">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="#5fd4da">
        <path d="M11.5,6C11.5,4.067,9.933,2.5,8,2.5S4.5,4.067,4.5,6v1h7V6Z"/>
        <rect x="3" y="8" width="10" height="6" rx="2"/>
        <path d="M1,5.5h2.2C3.07,5.01,3,4.51,3,4h0V3.5H1c-.552,0-1,.448-1,1S.448,5.5,1,5.5Z"/>
        <path d="M15,3.5h-2c0,.51-.07,1.01-.2,1.5H15c.552,0,1-.448,1-1s-.448-1-1-1Z"/>
        <path d="M1,11.5h2.05c.232,.89,.62,1.71,1.13,2.5H1c-.552,0-1-.448-1-1s.448-1,1-1h0Z"/>
        <path d="M15,10.5h-2.05c-.232,.89-.62,1.71-1.13,2.5h3.18c.552,0,1-.448,1-1s-.448-1-1-1Z"/>
        <path d="M1,7.5h2v2H1c-.552,0-1-.448-1-1s.448-1,1-1Z"/>
        <path d="M13,7.5h2c.552,0,1,.448,1,1s-.448,1-1,1h-2v-2Z"/>
        <rect x="7" y="9" width="2" height="4" rx=".5"/>
      </svg>
    </span>
  )
}

function MicIcon() {
  return (
    <span className="inline-flex align-middle mx-0.5 rounded bg-[#1a1a1a] p-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5fd4da">
        <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 4v7a1.5 1.5 0 0 0 3 0V5a1.5 1.5 0 0 0-3 0zM6 11a1 1 0 0 1 1 1 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 12a1 1 0 0 1 1-1z"/>
      </svg>
    </span>
  )
}

function SendIcon() {
  return (
    <span className="inline-flex items-center justify-center align-middle mx-0.5 rounded-full bg-[#00848B] p-1">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
        <path d="M15.7,7.3l-14-7C1.4,0.1,1.1,0.1,0.8,0.3C0.6,0.4,0.5,0.7,0.5,1l1.8,6H9v2H2.3L0.5,15c-0.1,0.3,0,0.6,0.2,0.7C0.8,15.9,1,16,1.1,16c0.1,0,0.3,0,0.4-0.1l14-7C15.8,8.7,16,8.4,16,8S15.8,7.3,15.7,7.3z"/>
      </svg>
    </span>
  )
}

function ThemeIcon() {
  return (
    <span className="inline-flex align-middle mx-0.5 rounded bg-[#1a1a1a] p-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5fd4da">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 11A9 8.5 0 1 0 21 11A9 8.5 0 1 0 3 11ZM6.5 16A2 2 0 1 0 10.5 16A2 2 0 1 0 6.5 16ZM6.4 7.5A1.6 1.6 0 1 0 9.6 7.5A1.6 1.6 0 1 0 6.4 7.5ZM10.4 4.5A1.6 1.6 0 1 0 13.6 4.5A1.6 1.6 0 1 0 10.4 4.5ZM14.4 7.5A1.6 1.6 0 1 0 17.6 7.5A1.6 1.6 0 1 0 14.4 7.5ZM15.9 11.5A1.6 1.6 0 1 0 19.1 11.5A1.6 1.6 0 1 0 15.9 11.5ZM14.4 15.5A1.6 1.6 0 1 0 17.6 15.5A1.6 1.6 0 1 0 14.4 15.5Z"
        />
      </svg>
    </span>
  )
}

function EditIcon() {
  return (
    <span className="inline-flex align-middle mx-0.5 rounded bg-[#1a1a1a] p-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5fd4da">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
      </svg>
    </span>
  )
}

function App() {
  const { completedSteps, completeStep, resetProgress } = useTutorialProgress()
  const totalSteps = 14
  const completedCount = [...completedSteps].filter(s => s <= totalSteps).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">VyBit Interactive Tutorial</h1>
            <span style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>
              <GitHubButton
                href="https://github.com/bitovi/vybit"
                data-icon="octicon-star"
                data-show-count="true"
                aria-label="Star bitovi/vybit on GitHub"
              >
                Star
              </GitHubButton>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              {completedCount} of {totalSteps} completed
            </p>
            <button
              onClick={resetProgress}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              ↺ Start Over
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Section 1: Welcome ── */}
        <TutorialSection
          step={1}
          title="Welcome to VyBit"
          completed={completedSteps.has(1)}
          onMarkComplete={() => completeStep(1)}
          instructions={
            <>
              <p>
                <a href="https://github.com/bitovi/vybit" className="text-blue-500 hover:underline">VyBit</a> is a visual editing tool that works alongside your running app. You select elements, describe changes in plain language or tweak styles visually, and VyBit sends precise instructions to an AI coding agent that implements the changes in your source code.
              </p>
              <p className="mt-3">
                This tutorial will walk you through the most common features. Each section has a small exercise — try them in any order. 
                Completed sections get a checkmark so you can track your progress.
              </p>


              <p className="mt-3 flex gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-md px-3 py-2 text-sm">
                <span>⚠️</span>
                <span>No agent is running and receiving the changes you suggest. In the real workflow, committed changes would be picked up by an AI agent. You can see the exact MCP tool output in your browser's developer console.</span>
              </p>
            </>
          }
        />

        {/* ── Section 2: Open the Panel ── */}
        <TutorialSection
          step={2}
          title="Open the Panel"
          completed={completedSteps.has(2)}
          onMarkComplete={() => completeStep(2)}
          instructions={
            <>
              <p>
                See the round button in the bottom-right corner of the page? That's the <strong>VyBit toggle button</strong>. Click it to open the inspector panel. The panel will slide in as a sidebar on the right side of the page.
              </p>
              <p className="mt-3">Once open, you'll see three buttons at the top of the panel:</p>
              <p className="mt-3">
                <EditIcon /> <strong>Edit</strong> — The main working mode. Select elements, inspect their styles, send change messages, edit text, and tweak Tailwind classes from here.
              </p>
              <p className="mt-3">
                <BugReportIcon /> <strong>Bug Report</strong> — Record and describe issues. Pick an element, describe what's wrong, and VyBit captures a timeline snapshot for context.
              </p>
              <p className="mt-3">
                <ThemeIcon /> <strong>Theme</strong> — Browse and adjust your project's Tailwind design tokens — colors, spacing, font sizes — and preview changes live across the whole page.
              </p>
              <p className="mt-3">At the <strong>bottom of the page</strong>, you'll also see two toolbar buttons:</p>
              <p className="mt-3">
                <SelectIcon /> <strong>Select</strong> — Activates the pointer so you can click elements in your app to inspect and edit them.
              </p>
              <p className="mt-3">
                <InsertIcon /> <strong>Insert</strong> — Activates insertion mode so you can click a gap between elements to set an insertion point for new content.
              </p>
              <p className="mt-3">You'll use all of these in the exercises below.</p>
            </>
          }
        />

        {/* ── Section 3: Your First Change ── */}
        <TutorialSection
          step={3}
          title="Your First Change"
          completed={completedSteps.has(3)}
          onMarkComplete={() => completeStep(3)}
          instructions={
            <>
              <p>Let's make your first change. <strong>Click the issue card below</strong> to select it, then tell VyBit what to do.</p>
              <ol>
                <li>Use the <strong>Select</strong> button (<SelectIcon />) at the bottom of the page to enter Select mode</li>
                <li>Click the card below — it will highlight with a teal border and a small toolbar will appear</li>
                <li>Click <strong>Describe change</strong> in the toolbar — a message form appears</li>
                <li>Type something like: <em>"Make the bug tag flash red"</em></li>
                <li>Click the <strong>Queue</strong> button to send the message</li>
                <li>At the bottom of the panel, click the <strong>draft count</strong> (e.g., "1 draft") to open the queue</li>
                <li>Click <strong>Commit</strong></li>
              </ol>
              <p className="mt-3">Open your browser's developer console (F12) to see the MCP tool call — that's exactly what an AI agent would receive.</p>
            </>
          }
        >
          <Card
            title="Fix Login Page Timeout"
            description="Users see a blank screen after 30s on the login page."
            tag="Bug"
          />
        </TutorialSection>

        {/* ── Section 4: Send a Voice Message ── */}
        <TutorialSection
          step={4}
          title="Send a Voice Message"
          completed={completedSteps.has(4)}
          onMarkComplete={() => completeStep(4)}
          instructions={
            <>
              <p>Sometimes it's easier to talk than type. VyBit has a microphone button for voice messages.</p>
              <ol>
                <li>Use the <strong>Select</strong> button (<SelectIcon />) at the bottom of the page to enter Select mode</li>
                <li>Click the <strong>Assign</strong> button below to select it</li>
                <li>In the floating toolbar, click the <strong>microphone</strong> (<MicIcon />) button next to the message input</li>
                <li>Speak your change — something like <em>"When assigning, show a spinner in the assign button and disable the button"</em></li>
                <li>Click the mic again to stop recording, then click the <strong>Queue</strong> button to send</li>
              </ol>
            </>
          }
        >
          <div className="flex gap-2">
            <Button variant="primary">Assign</Button>
            <Button variant="secondary">Close Issue</Button>
          </div>
        </TutorialSection>

        {/* ── Section 5: Edit Text In Place ── */}
        <TutorialSection
          step={5}
          title="Edit Text In Place"
          completed={completedSteps.has(5)}
          onMarkComplete={() => completeStep(5)}
          instructions={
            <>
              <p>You can edit text directly on the page using the overlay toolbar.</p>
              <ol>
                <li>Make sure you're in <strong>Select</strong> mode — use the <SelectIcon /> button at the bottom of the page if needed</li>
                <li>Click the empty state card below to select it — it will highlight with a teal border</li>
                <li>Click the <strong>Edit text</strong> button in the toolbar that appears below the selection</li>
                <li>The text becomes editable — try changing it to something friendlier, like <em>"Nothing here yet — Create your first issue!"</em></li>
                <li>Click away or press Escape to finish editing</li>
                <li>Click the <strong>Queue</strong> button in the toolbar to stage the text change as a draft</li>
              </ol>
            </>
          }
        >
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-3xl mb-3">📋</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Data Available</h3>
            <p className="text-sm text-gray-500">There are currently no items to display in this view at this time.</p>
          </div>
        </TutorialSection>

        {/* ── Section 6: Describe What to Add ── */}
        <TutorialSection
          step={6}
          title="Describe What to Add"
          completed={completedSteps.has(6)}
          onMarkComplete={() => completeStep(6)}
          instructions={
            <>
              <p>Now let's <strong>add a new field</strong> to this form.</p>
              <ol>
                <li>Use the <strong>Insert</strong> button (<InsertIcon />) at the bottom of the page to enter Insert mode</li>
                <li>Hover over the form below — you'll see insertion indicators between the fields</li>
                <li>Click the gap between <strong>Email</strong> and <strong>Role</strong> to set an <strong>insert point</strong></li>
                <li>Click <strong>Describe change</strong> in the toolbar — a message form appears</li>
                <li>Type something like: <em>"Add a phone number field"</em></li>
                <li>Click the <strong>Queue</strong> button to send</li>
              </ol>
            </>
          }
        >
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Add Team Member</h3>
            <div className="flex flex-col gap-4">
              <Input label="Full Name" placeholder="Jane Smith" />
              <Input label="Email" placeholder="jane@acme.com" type="email" />
              <Input label="Role" placeholder="Designer" />
            </div>
          </div>
        </TutorialSection>

        {/* ── Section 7: Sketch What to Add ── */}
        <TutorialSection
          step={7}
          title="Sketch What to Add"
          completed={completedSteps.has(7)}
          onMarkComplete={() => completeStep(7)}
          instructions={
            <>
              <p>Don't want to describe in words? Draw it instead. The signups below are just numbers — let's sketch a chart to visualize the trend.</p>
              <ol>
                <li>Use the <strong>Insert</strong> button (<InsertIcon />) at the bottom of the page and click between <strong>"Monthly Signups"</strong> and <strong>"January"</strong> to set an insertion point</li>
                <li>In the panel's <strong>Components</strong> tab, click <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#374151',color:'#f9fafb',fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}><span style={{color:'#5fd4da',fontSize:'13px',lineHeight:1}}>＋</span> Draw / Screenshot Canvas</span></li>
                <li>On the canvas, sketch a bar chart — draw a few bars of different heights with labels underneath</li>
                <li>Click <strong style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#00848B',color:'#fff',fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}>✓ Add to Drafts</strong> to queue the drawing</li>
              </ol>
            </>
          }
        >
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Signups</h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">January</span>
                <span className="text-gray-900 font-medium">120</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">February</span>
                <span className="text-gray-900 font-medium">185</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">March</span>
                <span className="text-gray-900 font-medium">310</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">April</span>
                <span className="text-gray-900 font-medium">275</span>
              </div>
            </div>
          </div>
        </TutorialSection>

        {/* ── Section 8: Move Elements ── */}
        <TutorialSection
          step={8}
          title="Move Elements"
          completed={completedSteps.has(8)}
          onMarkComplete={() => completeStep(8)}
          instructions={
            <>
              <p>Elements you've placed — or any existing element — can be dragged to a new position. The same teal drop-zone indicators that guided you during placement will show you exactly where it will land.</p>
              <p className="mt-3">The priority queue below has a <strong>Critical</strong> issue at the bottom when it should be first. Let's fix that.</p>
              <ol>
                <li>Use the <strong>Select</strong> button (<SelectIcon />) at the bottom of the page</li>
                <li>Click the <strong>Critical — Fix payment gateway timeout</strong> row to select it</li>
                <li>Drag it to the top of the list — drop-zone indicators will show you where it will land</li>
                <li>Release to move it — the change is staged as a draft</li>
              </ol>
              <p className="mt-3 text-sm text-gray-500">Tip: Press <strong>Escape</strong> while dragging to cancel and return the element to its original position.</p>
            </>
          }
        >
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Issue Priority Queue</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <Badge color="yellow">Medium</Badge>
                <span className="text-sm text-gray-700">Improve dashboard load time</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <Badge color="blue">Low</Badge>
                <span className="text-sm text-gray-700">Update onboarding copy</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <Badge color="red">Critical</Badge>
                <span className="text-sm text-gray-700">Fix payment gateway timeout</span>
              </div>
            </div>
          </div>
        </TutorialSection>

        {/* ── Section 9: Delete Elements ── */}
        <TutorialSection
          step={9}
          title="Delete Elements"
          completed={completedSteps.has(9)}
          onMarkComplete={() => completeStep(9)}
          instructions={
            <>
              <p>Removing an element is a single keypress. VyBit hides it on the page and queues a delete change for your agent — nothing is permanently removed until the agent writes the code.</p>
              <p className="mt-3">The resolved issue card below is stale and should be cleaned up.</p>
              <ol>
                <li>Use the <strong>Select</strong> button (<SelectIcon />) at the bottom of the page</li>
                <li>Click the <strong>Resolved</strong> card below to select it</li>
                <li>Press <strong>Delete</strong> or <strong>Backspace</strong> — the card disappears and a delete change is staged in your drafts</li>
              </ol>
            </>
          }
        >
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-500 line-through">Migrate to new auth provider</span>
              <Badge color="green">Resolved</Badge>
            </div>
            <p className="text-xs text-gray-400">Closed 14 days ago · No longer relevant</p>
          </div>
        </TutorialSection>

        {/* ── Section 10: Copy and Paste ── */}
        <TutorialSection
          step={10}
          title="Copy and Paste"
          completed={completedSteps.has(10)}
          onMarkComplete={() => completeStep(10)}
          instructions={
            <>
              <p>VyBit lets you copy any element and paste it anywhere on the page. <strong>Cmd+D</strong> gives you an instant duplicate right after the original — no placement flow needed.</p>
              <p className="mt-3">The team roster below has two members. Let's add a third slot.</p>
              <ol>
                <li>Use the <strong>Select</strong> button (<SelectIcon />) at the bottom of the page</li>
                <li>Click one of the team member cards to select it</li>
                <li>Press <strong>Cmd+D</strong> to instantly duplicate it right after itself</li>
                <li>Or: press <strong>Cmd+C</strong> to copy, then <strong>Cmd+V</strong> — the drop-zone placement flow activates so you can drop the copy anywhere on the page</li>
                <li>Your agent will fill in the new member's details</li>
              </ol>
            </>
          }
        >
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Team</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">AL</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Alice Lim</p>
                  <p className="text-xs text-gray-500">Engineering Lead</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">MR</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Marco Reyes</p>
                  <p className="text-xs text-gray-500">Product Designer</p>
                </div>
              </div>
            </div>
          </div>
        </TutorialSection>

        {/* ── Section 11: Place a Component ── */}
        <TutorialSection
          step={11}
          title="Place a Component"
          completed={completedSteps.has(11)}
          onMarkComplete={() => completeStep(11)}
          instructions={
            <>
              <p>VyBit can browse your component library and place components directly onto the page.</p>
              <ol>
                <li>Use the <strong>Insert</strong> button (<InsertIcon />) at the bottom of the page if not already active</li>
                <li>In the panel, you'll see the <strong>Components</strong> tab with your available components</li>
                <li><strong>Drag</strong> the thumbnail of a component (e.g., <strong>Badge</strong>) from the panel out onto the page — a semi-transparent ghost preview will follow your cursor</li>
                <li>Drop-zone indicators (teal lines) appear as you hover over different positions — release to place the component</li>
                <li>Alternatively, you can click a component's <strong>Place</strong> button and then click on the page to drop it</li>
              </ol>
            </>
          }
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <Badge color="green">Open</Badge>
            <Badge color="blue">Frontend</Badge>
            <Badge color="red">Priority: High</Badge>
          </div>
        </TutorialSection>

        {/* ── Section 12: Build with Nested Components ── */}
        <TutorialSection
          step={12}
          title="Build with Nested Components"
          completed={completedSteps.has(12)}
          onMarkComplete={() => completeStep(12)}
          instructions={
            <>
              <p>Some components accept other components as props. For example, the <strong>Button</strong> has <strong>leftIcon</strong> and <strong>rightIcon</strong> slots that accept an Icon component. You can fill these slots by dragging — just drop a component thumbnail directly onto the slot field in the panel.</p>
              <ol>
                <li>Use the <strong>Insert</strong> button (<InsertIcon />) at the bottom of the page if not already active</li>
                <li>In the panel's <strong>Components</strong> tab, find <strong>Button</strong> and click its <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#374151',color:'#f9fafb',fontSize:'11px',fontWeight:600,padding:'1px 7px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}>Customize</span> button</li>
                <li>In the props drawer, switch the <strong>variant</strong> to <code style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'3px',padding:'0 4px',fontSize:'12px'}}>warning</code></li>
                <li>Find the <strong>leftIcon</strong> slot field — <strong>drag</strong> the <svg style={{display:'inline',verticalAlign:'middle',marginLeft:'2px',marginRight:'2px'}} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><strong>Icon</strong> component thumbnail and drop it directly onto the <strong>leftIcon</strong> slot — the slot will glow teal to show it's a valid drop target</li>
                <li>You'll see a star appear in the Button preview</li>
                <li>Drag the Button thumbnail onto the page to place the composed button</li>
              </ol>
            </>
          }
        >
          <div className="flex gap-2">
            <Button variant="primary">Assign</Button>
            <Button variant="secondary">Close Issue</Button>
          </div>
        </TutorialSection>

        {/* ── Section 13: Fine-Tune the Design ── */}
        <TutorialSection
          step={13}
          title="Fine-Tune the Design"
          completed={completedSteps.has(13)}
          onMarkComplete={() => completeStep(13)}
          playgroundClassName="bg-indigo-600 text-white rounded-2xl p-12 text-center shadow-xl ring-4 ring-indigo-300"
          instructions={
            <>
              <p>VyBit isn't just for big changes — you can precisely adjust Tailwind classes too. Scrub spacing values, pick colors from a palette, adjust shadows, and see changes live as you drag.</p>
              <ol>
                <li>Use the <strong>Select</strong> button (<SelectIcon />) at the bottom of the page</li>
                <li>Click the purple banner below (not the text inside it) — it will show its Tailwind properties in the panel</li>
                <li>
                  Try any of these in the panel's <strong>Design</strong> tab:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    <li>Drag the <strong>padding</strong> scrubber left or right</li>
                    <li>Click a <strong>color</strong> chip to open the color grid — pick a new background color</li>
                    <li>Adjust the <strong>shadow</strong> to make it bigger or smaller</li>
                    <li>Change the <strong>ring</strong> width or color to add an outline</li>
                    <li>Tweak the <strong>border radius</strong> to sharpen or round the corners</li>
                  </ul>
                </li>
                <li>Every change previews live on the page — experiment freely</li>
              </ol>
            </>
          }
        >
          <h3 className="text-2xl font-bold mb-2">Welcome to Acme Project Tracker</h3>
          <p className="text-indigo-200">Your hub for issues, roadmaps, and team collaboration.</p>
        </TutorialSection>

        {/* ── Section 14: Report a Bug ── */}
        <TutorialSection
          step={14}
          title="Report a Bug"
          completed={completedSteps.has(14)}
          onMarkComplete={() => completeStep(14)}
          instructions={
            <>
              <p>Found something broken? VyBit's Bug Report mode captures element context, console errors, network failures, and a visual timeline so the AI agent knows exactly what to fix.</p>
              <ol>
                <li>First, click <strong>"Refresh Invoice"</strong> below — it will trigger a failed API call and a console error</li>
                <li>In the panel header, switch to <strong>Bug Report</strong> mode (<BugReportIcon />)</li>
                <li>The timeline will show the errors that just happened — you'll see network and console error badges</li>
                <li>Click the element below that looks "wrong"</li>
                <li>Describe the bug — e.g., <em>"This price should not be negative and the refresh button is broken"</em></li>
                <li>Submit the bug report</li>
              </ol>
            </>
          }
        >
          <div className="overflow-hidden rounded-lg">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing — Invoice #1042</h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Pro Plan (monthly)</span>
                <span className="text-gray-900 font-medium">$49.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Extra seats (3)</span>
                <span className="text-gray-900 font-medium">$30.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600 font-semibold">Overage charges</span>
                <span className="text-red-600 font-bold">$-14,000.00</span>
              </div>
              <hr className="my-2 border-gray-200" />
              <div className="flex justify-between">
                <span className="text-gray-900 font-semibold">Total</span>
                <span className="text-red-600 font-bold text-base">-$13,921.00</span>
              </div>
            </div>
            <button
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
              onClick={() => {
                console.error('[Billing] Failed to refresh invoice: INVOICE_CALC_ERROR — negative overage value is invalid');
                fetch('/api/billing/invoice/1042/refresh', { method: 'POST' }).catch(() => {});
              }}
            >
              Refresh Invoice
            </button>
          </div>
          </div>
        </TutorialSection>

        {/* ── Completion Banner (always visible) ── */}
        <section className={`rounded-lg shadow-sm border px-6 py-8 text-center ${
          completedCount === totalSteps
            ? 'bg-linear-to-br from-green-50 to-teal-50 border-green-200'
            : 'bg-white border-gray-200'
        }`}>
          {completedCount === totalSteps ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">You did it!</h2>
              <div className="text-sm text-gray-600 leading-relaxed max-w-lg mx-auto">
                <p>You've explored every major VyBit feature:</p>
                <ul className="text-left inline-block mt-3 space-y-1">
                  <li>✓ Selecting elements and sending change messages</li>
                  <li>✓ Voice messages</li>
                  <li>✓ Inline text editing</li>
                  <li>✓ Describing new content to insert</li>
                  <li>✓ Sketching layouts</li>
                  <li>✓ Moving and rearranging elements</li>
                  <li>✓ Deleting elements</li>
                  <li>✓ Copying and pasting elements</li>
                  <li>✓ Placing design system components</li>
                  <li>✓ Composing nested components</li>
                  <li>✓ Fine-tuning Tailwind styles</li>
                  <li>✓ Reporting bugs</li>
                </ul>
                <p className="mt-4">
                  In a real project, every committed change triggers the MCP <code className="bg-gray-100 text-gray-800 px-1 rounded">implement_next_change</code> tool. Your AI agent (Copilot, Cursor, Claude, etc.) receives the change description, context, and instructions — then writes the code.
                </p>
                <p className="mt-4 font-medium text-gray-900">
                  Ready to try it for real?{' '}
                  <a
                    href="https://github.com/bitovi/vybit"
                    className="text-teal-600 underline hover:text-teal-800"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Install VyBit
                  </a>{' '}
                  and connect it to your project.
                </p>
              </div>
              <button
                onClick={resetProgress}
                className="mt-6 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-4 py-2 hover:bg-white transition-colors"
              >
                ↺ Start Over
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Keep going!</h2>
              <p className="text-sm text-gray-500">
                You've completed {completedCount} of {totalSteps} steps. Finish the remaining exercises above to unlock the full summary.
              </p>
            </>
          )}
        </section>

        {/* ── Bonus Section Intro ── */}
        <div className="mt-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Bonus: Advanced Features</h2>
          <p className="text-sm text-gray-500">
            The core tutorial is complete — nice work! These bonus exercises cover less common but powerful features you might want to explore at your own pace.
          </p>
        </div>

        {/* ── Bonus Step 15: Explore Your Theme ── */}
        <TutorialSection
          step={15}
          title="Explore Your Theme"
          completed={completedSteps.has(15)}
          onMarkComplete={() => completeStep(15)}
          instructions={
            <>
              <p>
                VyBit can edit your project's Tailwind theme — not just individual elements. Click the <strong>Theme</strong> button (<ThemeIcon />) in the panel to open the Theme editor. From there you can adjust global design tokens: colors, font sizes, font weights, spacing, border radius, and font families. Changes preview live across the entire page.
              </p>
              <ol>
                <li>Open the panel and click the <strong>Theme</strong> button (<ThemeIcon />) — it's the palette icon in the mode toggle bar</li>
                <li>Expand a section (e.g., <strong>Colors</strong>) and click a swatch to change it — you'll see every element using that token update live</li>
                <li>Try adjusting the <strong>spacing</strong> base value — watch all spacing-based padding and margins scale together</li>
                <li>Each change is automatically queued as a draft — the agent will update your CSS <code className="bg-gray-100 text-gray-800 px-1 rounded text-xs">@theme</code> block</li>
              </ol>
              <p className="mt-3">
                The showcase elements below use a variety of theme tokens. Try changing theme values and watch them update in real time.
              </p>
            </>
          }
        >
          <div className="flex flex-col gap-2">
              <div className="bg-green-600 text-white text-sm font-mono p-1 rounded">
                <div className="flex"><span className="flex-1">green-600</span><span className="flex-1">text-sm</span><span className="flex-1">font-mono</span><span className="flex-1">p-1</span></div>
              </div>
              <div className="bg-green-500 text-white text-base font-sans p-2 rounded">
                <div className="flex"><span className="flex-1">green-500</span><span className="flex-1">text-base</span><span className="flex-1">font-sans</span><span className="flex-1">p-2</span></div>
              </div>
              <div className="bg-blue-400 text-white text-lg font-bold p-3 rounded">
                <div className="flex"><span className="flex-1">blue-400</span><span className="flex-1">text-lg</span><span className="flex-1">font-bold</span><span className="flex-1">p-3</span></div>
              </div>
              <div className="bg-purple-600 text-white text-xl font-medium p-4 rounded">
                <div className="flex"><span className="flex-1">purple-600</span><span className="flex-1">text-xl</span><span className="flex-1">font-medium</span><span className="flex-1">p-4</span></div>
              </div>
              <div className="bg-red-500 text-white text-xs font-semibold p-1.5 rounded">
                <div className="flex"><span className="flex-1">red-500</span><span className="flex-1">text-xs</span><span className="flex-1">font-semibold</span><span className="flex-1">p-1.5</span></div>
              </div>
              <div className="bg-amber-500 text-white text-sm font-bold p-2.5 rounded">
                <div className="flex"><span className="flex-1">amber-500</span><span className="flex-1">text-sm</span><span className="flex-1">font-bold</span><span className="flex-1">p-2.5</span></div>
              </div>
              <div className="bg-teal-600 text-white text-base font-mono p-3.5 rounded">
                <div className="flex"><span className="flex-1">teal-600</span><span className="flex-1">text-base</span><span className="flex-1">font-mono</span><span className="flex-1">p-3.5</span></div>
              </div>
              <div className="bg-indigo-500 text-white text-lg font-light p-5 rounded">
                <div className="flex"><span className="flex-1">indigo-500</span><span className="flex-1">text-lg</span><span className="flex-1">font-light</span><span className="flex-1">p-5</span></div>
              </div>
          </div>
        </TutorialSection>

        {/* ── Bonus Step 16: Wireframe with HTML Elements ── */}
        <TutorialSection
          step={16}
          title="Wireframe with HTML Elements"
          completed={completedSteps.has(16)}
          onMarkComplete={() => completeStep(16)}
          instructions={
            <>
              <p>
                The <strong>Elements</strong> tab in the panel gives you plain HTML building blocks — flex rows, flex columns, and a button — that you can drag directly onto the page to rough out a layout. These aren't design-system components; they're bare HTML so the agent can adapt them to match your app's style when implementing.
              </p>
              <ol>
                <li>Use the <strong>Insert</strong> button (<InsertIcon />) at the bottom of the page</li>
                <li>In the panel, click the <strong>Elements</strong> tab</li>
                <li><strong>Drag</strong> one of the elements (e.g., <code className="bg-gray-100 text-gray-800 px-1 rounded text-xs">div.flex-row</code>) onto the page — drop it wherever you want a new layout slot</li>
                <li>The agent will see the raw HTML and infer the appropriate styles from your existing page when it implements the change</li>
              </ol>
              <p className="mt-3 text-sm text-gray-500">
                Elements available: <code className="bg-gray-100 text-gray-800 px-1 rounded text-xs">div.flex-row</code>, <code className="bg-gray-100 text-gray-800 px-1 rounded text-xs">div.flex-row &gt; .flex-auto</code>, <code className="bg-gray-100 text-gray-800 px-1 rounded text-xs">div.flex-col</code>, <code className="bg-gray-100 text-gray-800 px-1 rounded text-xs">button.inline</code>
              </p>
              <p className="mt-3 text-sm text-gray-500">
                Tip: Use these to sketch layout structure quickly, then describe what each slot should contain in a follow-up change message.
              </p>
            </>
          }
        >
          <div className="bg-white rounded-lg shadow p-6 flex flex-col gap-4">
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-4 text-center text-sm text-gray-400">
              Drop a <code className="text-xs bg-gray-200 px-1 rounded">div.flex-row</code> here to add a row layout
            </div>
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-4 text-center text-sm text-gray-400">
              Drop a <code className="text-xs bg-gray-200 px-1 rounded">div.flex-col</code> here to add a column layout
            </div>
          </div>
        </TutorialSection>
      </main>
    </div>
  )
}

export default App
