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

function App() {
  const { completedSteps, completeStep, resetProgress } = useTutorialProgress()
  const totalSteps = 11
  const completedCount = completedSteps.size

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

              <p className="mt-3">If you get stuck, refer to the video below for a walkthrough of this tutorial.</p>
              <div className="mt-4 rounded-lg overflow-hidden shadow-sm border border-gray-200">
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                  <iframe
                    src="https://www.youtube.com/embed/_pd7UbohrPw"
                    title="VyBit Tutorial Walkthrough"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
              </div>
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
              <p className="mt-3">Once open, you'll see three mode buttons at the top of the panel:</p>
              <p className="mt-3">
                <SelectIcon /> <strong>Select</strong> — Click elements in your app to inspect and change them. This is where you'll spend most of your time. Select an element, then describe what you want changed, tweak spacing, adjust colors, or edit text directly.
              </p>
              <p className="mt-3">
                <InsertIcon /> <strong>Insert</strong> — Add new content to the page. Click a spot where you want something new, then describe it, sketch it, or pick a component from your design system.
              </p>
              <p className="mt-3">
                <BugReportIcon /> <strong>Bug Report</strong> — Record and describe issues. Pick an element, describe what's wrong, and VyBit captures a timeline snapshot for context.
              </p>
              <p className="mt-3">You'll try all three in the exercises below.</p>
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
                <li>In the panel, click the <strong>Select</strong> button (<SelectIcon />) to enter Select mode</li>
                <li>Click the card below — it will highlight with a teal border and a floating toolbar will appear above it</li>
                <li>In the floating toolbar's message area, type something like: <em>"Make the bug tag flash red"</em></li>
                <li>Click the <strong>submit</strong> button (<SendIcon />) to queue the message</li>
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
                <li>Click the <strong>Select</strong> button (<SelectIcon />) in the panel to enter Select mode</li>
                <li>Click the <strong>Assign</strong> button below to select it</li>
                <li>In the floating toolbar, click the <strong>microphone</strong> (<MicIcon />) button next to the message input</li>
                <li>Speak your change — something like <em>"When assigning, show a spinner in the assign button and disable the button"</em></li>
                <li>Click the mic again to stop recording, then click the <strong>submit</strong> button (<SendIcon />)</li>
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
                <li>Make sure you're in <strong>Select</strong> mode — click the <SelectIcon /> button in the panel if needed</li>
                <li>Click the empty state card below to select it — it will highlight with a teal border</li>
                <li>In the floating toolbar that appears above it, click the <strong>Text</strong> button</li>
                <li>The text becomes editable — try changing it to something friendlier, like <em>"Nothing here yet — Create your first issue!"</em></li>
                <li>Click away or press Escape to finish editing</li>
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
                <li>In the panel header, click the <strong>Insert</strong> (<InsertIcon />) mode button</li>
                <li>Hover over the form below — you'll see insertion indicators between the fields</li>
                <li>Click the gap between <strong>Email</strong> and <strong>Role</strong> to set an <strong>insert point</strong></li>
                <li>In the floating toolbar's message area, describe the field to add — something like: <em>"Add a phone number field"</em></li>
                <li>Click the <strong>submit</strong> button (<SendIcon />)</li>
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
                <li>Switch to <strong>Insert</strong> mode (<InsertIcon />) and click between <strong>"Monthly Signups"</strong> and <strong>"January"</strong> to set an insertion point</li>
                <li>In the panel's <strong>Place</strong> tab, click <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#374151',color:'#f9fafb',fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}><span style={{color:'#5fd4da',fontSize:'13px',lineHeight:1}}>＋</span> Draw / Screenshot Canvas</span></li>
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

        {/* ── Section 8: Place a Component ── */}
        <TutorialSection
          step={8}
          title="Place a Component"
          completed={completedSteps.has(8)}
          onMarkComplete={() => completeStep(8)}
          instructions={
            <>
              <p>VyBit can browse your component library and place components directly onto the page.</p>
              <ol>
                <li>Switch to <strong>Insert</strong> mode (<InsertIcon />) if not already active</li>
                <li>In the panel, you'll see the <strong>Components</strong> tab with your available components</li>
                <li>Find a component (e.g., <strong>Badge</strong>) and click its <strong>Place</strong> button</li>
                <li>Hover over the page — you'll see a ghost preview of the component following your cursor</li>
                <li>Click to drop it next to the existing status badges</li>
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

        {/* ── Section 9: Build with Nested Components ── */}
        <TutorialSection
          step={9}
          title="Build with Nested Components"
          completed={completedSteps.has(9)}
          onMarkComplete={() => completeStep(9)}
          instructions={
            <>
              <p>Some components accept other components as props. For example, the <strong>Button</strong> has <strong>leftIcon</strong> and <strong>rightIcon</strong> slots that accept an Icon component. VyBit lets you fill these slots directly in the component drawer.</p>
              <ol>
                <li>In <strong>Insert</strong> mode (<InsertIcon />), find the <strong>Button</strong> component in the panel's Components tab and click its <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#374151',color:'#f9fafb',fontSize:'11px',fontWeight:600,padding:'1px 7px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}>Customize</span> button</li>
                <li>In the props drawer, switch the <strong>variant</strong> to <code style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'3px',padding:'0 4px',fontSize:'12px'}}>warning</code></li>
                <li>Find the <strong>leftIcon</strong> row — click the <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'18px',height:'18px',background:'#374151',color:'#f9fafb',fontSize:'13px',fontWeight:700,borderRadius:'3px',fontFamily:'sans-serif',lineHeight:1}}>⊞</span> button to open the component picker for that prop</li>
                <li>Find the <svg style={{display:'inline',verticalAlign:'middle',marginLeft:'2px',marginRight:'2px'}} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><strong>Icon</strong> component and click its <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#F5532D',color:'#fff',fontSize:'11px',fontWeight:600,padding:'1px 7px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}>Set Prop</span> button — you'll see a star appear in the Button preview</li>
                <li>Back in the Button drawer, click its <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'#374151',color:'#f9fafb',fontSize:'11px',fontWeight:600,padding:'1px 7px',borderRadius:'4px',fontFamily:'sans-serif',letterSpacing:'0.01em'}}>Place</span> button and drop the composed button onto the page</li>
              </ol>
            </>
          }
        >
          <div className="flex gap-2">
            <Button variant="primary">Assign</Button>
            <Button variant="secondary">Close Issue</Button>
          </div>
        </TutorialSection>

        {/* ── Section 10: Fine-Tune the Design ── */}
        <TutorialSection
          step={10}
          title="Fine-Tune the Design"
          completed={completedSteps.has(10)}
          onMarkComplete={() => completeStep(10)}
          playgroundClassName="bg-indigo-600 text-white rounded-2xl p-12 text-center shadow-xl ring-4 ring-indigo-300"
          instructions={
            <>
              <p>VyBit isn't just for big changes — you can precisely adjust Tailwind classes too. Scrub spacing values, pick colors from a palette, adjust shadows, and see changes live as you drag.</p>
              <ol>
                <li>Switch to <strong>Select</strong> mode (<SelectIcon />)</li>
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

        {/* ── Section 11: Report a Bug ── */}
        <TutorialSection
          step={11}
          title="Report a Bug"
          completed={completedSteps.has(11)}
          onMarkComplete={() => completeStep(11)}
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

        {/* ── Completion Section ── */}
        {completedCount === totalSteps && (
          <section className="bg-linear-to-br from-green-50 to-teal-50 rounded-lg shadow-sm border border-green-200 px-6 py-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">You did it!</h2>
            <div className="text-sm text-gray-600 leading-relaxed max-w-lg mx-auto">
              <p>You've explored every major VyBit feature:</p>
              <ul className="text-left inline-block mt-3 space-y-1">
                <li>✓ Selecting elements and sending change messages</li>
                <li>✓ Voice messages</li>
                <li>✓ Inline text editing</li>
                <li>✓ Describing new content to insert</li>
                <li>✓ Sketching layouts</li>
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
          </section>
        )}
      </main>
    </div>
  )
}

export default App
