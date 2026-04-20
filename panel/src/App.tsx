import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ContainerSwitcher } from "./components/ContainerSwitcher";
import { DrawTab } from "./components/DrawTab";
import { ModeToggle } from "./components/ModeToggle";
import { PatchPopover } from "./components/PatchPopover";
import { BugReportMode } from "./components/BugReportMode";
import { TabBar } from "./components/TabBar";
import { ThemeTab } from "./components/ThemeTab";
import { usePatchManager } from "./hooks/usePatchManager";
import { useModeStateMachine } from "./hooks/useModeStateMachine";
import { Picker } from "./Picker";
import {
	connect,
	isConnected,
	onConnect,
	onDisconnect,
	onMessage,
	send,
	sendTo,
} from "./ws";

const DesignMode = lazy(() =>
	import("./DesignMode").then((m) => ({ default: m.DesignMode })),
);

// URL param routing: ?mode=design renders the drawing canvas instead of the Picker
const urlParams = new URLSearchParams(window.location.search);
const appMode = urlParams.get("mode");
const isEmbeddedInStorybook = urlParams.get("embedded") === "storybook";

function formatInsertLabel(position: string, targetName: string): string {
	const tag = `<${targetName}>`;
	switch (position) {
		case 'before': return `Before ${tag}`;
		case 'after': return `After ${tag}`;
		case 'first-child': return `First in ${tag}`;
		case 'last-child': return `Last in ${tag}`;
		default: return `${position} ${tag}`;
	}
}

export function App() {
	// If URL has ?mode=design, render the design canvas (used inside the overlay iframe)
	if (appMode === "design") {
		return (
			<Suspense fallback={null}>
				<DesignMode />
			</Suspense>
		);
	}

	return <InspectorApp />;
}

function InspectorApp() {
	const [wsConnected, setWsConnected] = useState(false);
	const [overlayConnected, setOverlayConnected] = useState(false);
	const patchManager = usePatchManager();
	const [promptCopied, setPromptCopied] = useState(false);
	const [isComponentArmed, setIsComponentArmed] = useState(false);
	const [themeConfig, setThemeConfig] = useState<any>(null);

	const {
		mode,
		elementData,
		selectionId,
		insertPoint,
		selectModeActive,
		textEditing,
		currentTabs,
		activeTab,
		isPicking: rawIsPicking,
		handleModeChange,
		handleTabChange,
		handleWsMessage,
	} = useModeStateMachine();

	// When a component is armed, the mode button goes gray (not orange)
	const isPicking = rawIsPicking && !isComponentArmed;
	// Teal = target is locked (element selected or insert point set)
	const isEngaged = !!elementData || !!insertPoint;

	// When a ghost element is selected, resolve its componentArgs from the draft patch queue
	const resolvedComponentProps = useMemo(() => {
		if (elementData?.componentProps) return elementData.componentProps;
		if (!elementData?.ghostPatchId) return undefined;
		const ghostPatch = patchManager.queueState.draft.find(p => p.id === elementData.ghostPatchId);
		if (ghostPatch?.componentArgs) return ghostPatch.componentArgs;
		return undefined;
	}, [elementData?.componentProps, elementData?.ghostPatchId, patchManager.queueState.draft]);

	const handleArmedChange = useCallback((armed: boolean) => {
		setIsComponentArmed(armed);
	}, []);

	// Reset armed state when mode changes (DrawTab may unmount)
	useEffect(() => {
		setIsComponentArmed(false);
	}, [mode]);

	// Request theme vars from overlay when theme mode becomes active
	useEffect(() => {
		if (mode !== 'theme') return;
		sendTo('overlay', { type: 'REQUEST_THEME_VARS' });
	}, [mode]);

	const handleStageThemeChange = useCallback((description: string) => {
		const id = crypto.randomUUID();
		send({
			type: 'MESSAGE_STAGE',
			id,
			message: description,
			elementKey: 'theme',
		});
	}, []);

	useEffect(() => {
		const offConnect = onConnect(() => {
			setWsConnected(true);
			if (!isEmbeddedInStorybook) {
				try {
					const stored = localStorage.getItem("tw-panel-container");
					if (stored && stored !== "popover") {
						sendTo("overlay", { type: "SWITCH_CONTAINER", container: stored });
					}
				} catch {
					/* ignore */
				}
			}
		});
		const offDisconnect = onDisconnect(() => setWsConnected(false));

		const offMessage = onMessage((msg) => {
			// Mode-related messages are handled by the state machine hook
			if (handleWsMessage(msg)) return;

			if (msg.type === "THEME_VARS") {
				const varCount = msg.vars ? Object.keys(msg.vars).length : 0;
				console.log(`[theme-trace] THEME_VARS received: ${varCount} vars`);
				setThemeConfig({ vars: msg.vars });
			} else if (msg.type === "OVERLAY_STATUS") {
				console.log(`[theme-trace] OVERLAY_STATUS connected=${msg.connected}`);
				setOverlayConnected(!!msg.connected);
			} else if (msg.type === "QUEUE_UPDATE") {
				patchManager.handleQueueUpdate({
					draftCount: msg.draftCount,
					committedCount: msg.committedCount,
					implementingCount: msg.implementingCount,
					implementedCount: msg.implementedCount,
					partialCount: msg.partialCount,
					errorCount: msg.errorCount,
					draft: msg.draft,
					commits: msg.commits,
					agentWaiting: msg.agentWaiting,
				});
			} else if (msg.type === "PATCH_UPDATE") {
				// Legacy backward compat
				patchManager.handlePatchUpdate({
					staged: msg.staged,
					committed: msg.committed,
					implementing: msg.implementing,
					implemented: msg.implemented,
					patches: msg.patches,
				});
			}
		});

		connect();
		setWsConnected(isConnected());
		return () => {
			offConnect();
			offDisconnect();
			offMessage();
		};
	}, []);

	const { draft, committed, implementing, implemented, partial, error } =
		patchManager.counts;
	const showNoAgentWarning =
		(draft > 0 || committed > 0) && !patchManager.agentWaiting && implementing === 0;

	// Merge server draft + local patches for display.
	// Server draft is the source of truth for IDs; local patches carry richer detail.
	// Any server-only draft (e.g. from a second overlay) is also shown.
	const localById = new Map(
		patchManager.patches
			.filter((p) => p.status === "staged")
			.map((p) => [
				p.id,
				{
					id: p.id,
					kind: p.kind ?? ("class-change" as const),
					elementKey: p.elementKey,
					status: p.status,
					originalClass: p.originalClass,
					newClass: p.newClass,
					property: p.property,
					timestamp: p.timestamp,
					component: p.component,
					message: p.message,
					image: p.image,
				},
			]),
	);
	const serverIds = new Set(patchManager.queueState.draft.map((p) => p.id));
	const draftPatches = [
		// All server drafts (use local version if available for richer data)
		...patchManager.queueState.draft.map((p) => localById.get(p.id) ?? p),
		// Any local patches not yet acknowledged by the server
		...patchManager.patches
			.filter((p) => p.status === "staged" && !serverIds.has(p.id))
			.map((p) => localById.get(p.id)!),
	];

	const committedCommits = patchManager.queueState.commits.filter(
		(c) => c.status === "committed",
	);
	const implementingCommits = patchManager.queueState.commits.filter(
		(c) => c.status === "implementing",
	);
	const implementedCommits = patchManager.queueState.commits.filter(
		(c) => c.status === "implemented",
	);

	const VYBIT_PROMPT =
		"Please implement the next change and continue implementing changes with VyBit.";

	async function copyToClipboard(text: string) {
		if (navigator.clipboard) {
			try {
				const permission = await navigator.permissions.query({
					name: "clipboard-write" as PermissionName,
				});
				if (permission.state === "denied") {
					execCommandCopy(text);
					return;
				}
			} catch {
				// permissions API not supported — proceed anyway
			}
			navigator.clipboard.writeText(text).catch(() => execCommandCopy(text));
		} else {
			execCommandCopy(text);
		}
	}

	function handleCopyPrompt() {
		copyToClipboard(VYBIT_PROMPT);
		setPromptCopied(true);
		setTimeout(() => setPromptCopied(false), 2000);
	}

	function execCommandCopy(text: string) {
		const el = document.createElement("textarea");
		el.value = text;
		el.style.position = "fixed";
		el.style.opacity = "0";
		document.body.appendChild(el);
		el.select();
		document.execCommand("copy");
		document.body.removeChild(el);
	}

	const agentWarning = !wsConnected
		? { icon: "dot" as const, text: "No agent listening" }
		: showNoAgentWarning
			? { icon: "triangle" as const, text: "No agent watching" }
			: null;

	const queueFooter = (
		<div className="shrink-0">
			{agentWarning && (
				<div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/40 border-t border-amber-800/40 text-amber-300 text-[10px] font-medium">
					{agentWarning.icon === "dot" ? (
						<div className="w-1.5 h-1.5 rounded-full bg-bv-orange animate-pulse shrink-0" />
					) : (
						<svg
							width="12"
							height="12"
							viewBox="0 0 20 20"
							fill="currentColor"
							className="shrink-0 text-amber-400"
						>
							<path
								fillRule="evenodd"
								d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.516-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
								clipRule="evenodd"
							/>
						</svg>
					)}
					<span className="flex-1 leading-tight">
						{agentWarning.text} —{" "}
						<a
							href="https://github.com/bitovi/vybit?tab=readme-ov-file#telling-your-agent-to-start-making-features"
							target="_blank"
							rel="noreferrer"
							className="underline hover:text-amber-100"
						>
							ask your agent
						</a>{" "}
						to start
					</span>
					<button
						onClick={handleCopyPrompt}
						className={`shrink-0 px-1.5 py-0.5 rounded border font-semibold text-[9px] transition-colors ${promptCopied ? "border-emerald-700/50 bg-emerald-900/40 text-emerald-300" : "border-amber-700/50 bg-amber-900/40 hover:bg-amber-800/40 text-amber-300"}`}
						title={`Copy: "${VYBIT_PROMPT}"`}
					>
						{promptCopied ? "Copied!" : "Copy prompt"}
					</button>
				</div>
			)}
			<div className="flex items-center justify-center px-3 py-1.5 border-t border-bv-border gap-3 text-[10px]">
				<PatchPopover
					label="draft"
					count={draft}
					items={draftPatches}
					activeColor="text-amber-400"
					onDiscard={(id: string) => patchManager.discard(id)}
					onCommitAll={() => patchManager.commitAll()}
					onDiscardAll={() => patchManager.discardAll()}
				/>
				<PatchPopover
					label="committed"
					count={committed}
					items={committedCommits.flatMap((c) => c.patches)}
					activeColor="text-bv-orange"
					onDiscard={(id: string) => patchManager.discardCommit(id)}
				/>
				<PatchPopover
					label="implementing"
					count={implementing}
					items={implementingCommits.flatMap((c) => c.patches)}
					activeColor="text-blue-400"
				/>
				<PatchPopover
					label="implemented"
					count={implemented}
					items={implementedCommits.flatMap((c) => c.patches)}
					activeColor="text-bv-teal"
				/>
			</div>
		</div>
	);

	// Block the entire panel while the overlay is not connected
	if (!overlayConnected) {
		return (
			<div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
				<div className="w-12 h-12 rounded-full bg-bv-teal/10 text-bv-teal flex items-center justify-center">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
						<path d="M12 2v4" />
						<path d="M12 18v4" />
						<path d="M4.93 4.93l2.83 2.83" />
						<path d="M16.24 16.24l2.83 2.83" />
						<path d="M2 12h4" />
						<path d="M18 12h4" />
						<path d="M4.93 19.07l2.83-2.83" />
						<path d="M16.24 7.76l2.83-2.83" />
					</svg>
				</div>
				<div>
					<p className="text-[13px] text-bv-text font-medium">
						Connecting to page…
					</p>
					<p className="text-[11px] text-bv-text-mid mt-1 leading-relaxed">
						Waiting for the overlay script to connect.
						{!wsConnected && " Server WebSocket is also disconnected."}
					</p>
				</div>
			</div>
		);
	}

	if (!elementData) {
		// Theme mode — dedicated panel view
		if (mode === 'theme') {
			return (
				<div className="h-full flex flex-col">
					<div className="px-3 pt-3 pb-2 border-b border-bv-border">
						<div className="flex items-center justify-between gap-2">
							<ModeToggle
								mode={mode}
								onModeChange={handleModeChange}
								isPicking={isPicking}
								isEngaged={isEngaged}
							/>
							{!isEmbeddedInStorybook && <ContainerSwitcher />}
						</div>
					</div>
					{themeConfig ? (
						<ThemeTab
							tailwindConfig={themeConfig}
							tailwindVersion={themeConfig.tailwindVersion ?? 4}
							onStageThemeChange={handleStageThemeChange}
						/>
					) : (
						<div className="flex-1 flex items-center justify-center text-[11px] text-bv-text-mid">
							Loading theme data…
						</div>
					)}
					{queueFooter}
				</div>
			);
		}

		// Landing page — no mode selected yet
		if (mode === null) {
			return (
				<div className="h-full flex flex-col">
					<div className="px-3 pt-3 pb-2 border-b border-bv-border">
						<div className="flex items-center justify-between gap-2">
							<ModeToggle
								mode={mode}
								onModeChange={handleModeChange}
								isPicking={isPicking}
								isEngaged={isEngaged}
							/>
							{!isEmbeddedInStorybook && <ContainerSwitcher />}
						</div>
					</div>
					<div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
						<button
							onClick={() => handleModeChange('select')}
							className="w-full flex flex-col items-center gap-3 px-6 py-5 rounded-lg border border-bv-border bg-bv-surface hover:border-bv-teal hover:bg-bv-teal/5 transition-all cursor-pointer"
						>
							<div className="w-14 h-14 rounded-full bg-bv-teal/10 text-bv-teal flex items-center justify-center">
								<svg width="28" height="28" viewBox="0 0 64 64" fill="currentColor">
									<path d="M2,9C1.447,9,1,8.552,1,8V2c0-0.552,0.447-1,1-1h6c0.553,0,1,0.448,1,1S8.553,3,8,3H3v5C3,8.552,2.553,9,2,9z" />
									<path d="M8,48H2c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v5h5c0.553,0,1,0.448,1,1S8.553,48,8,48z" />
									<path d="M47,9c-0.553,0-1-0.448-1-1V3h-5c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1v6C48,8.552,47.553,9,47,9z" />
									<path d="M21,3h-6c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1S21.553,3,21,3z" />
									<path d="M2,22c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v6C3,21.552,2.553,22,2,22z" />
									<path d="M2,35c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v6C3,34.552,2.553,35,2,35z" />
									<path d="M47,22c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v6C48,21.552,47.553,22,47,22z" />
									<path d="M47,31c-0.553,0-1-0.448-1-1v-2c0-0.552,0.447-1,1-1s1,0.448,1,1v2C48,30.552,47.553,31,47,31z" />
									<path d="M34,3h-6c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1S34.553,3,34,3z" />
									<path d="M21,48h-6c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1S21.553,48,21,48z" />
									<path d="M30,48h-2c-0.553,0-1-0.448-1-1s0.447-1,1-1h2c0.553,0,1,0.448,1,1S30.553,48,30,48z" />
									<path d="M62.707,57.293L51.688,46.274l10.759-5.379c0.368-0.184,0.586-0.575,0.549-0.985c-0.037-0.41-0.322-0.755-0.717-0.87l-31-9c-0.355-0.1-0.729-0.005-0.986,0.253c-0.258,0.258-0.355,0.636-0.253,0.986l9,31c0.114,0.396,0.46,0.68,0.869,0.717C39.94,62.999,39.971,63,40,63c0.376,0,0.724-0.212,0.895-0.553l5.38-10.759l11.019,11.019c0.391,0.391,1.023,0.391,1.414,0l4-4C63.098,58.316,63.098,57.684,62.707,57.293z" />
								</svg>
							</div>
							<span className="text-[13px] text-bv-text font-medium">
								Select an element
							</span>
							<span className="text-[11px] text-bv-text-mid text-center leading-relaxed">
								to change its design, its text, or to replace it with something else
							</span>
						</button>
						<button
							onClick={() => handleModeChange('insert')}
							className="w-full flex flex-col items-center gap-3 px-6 py-4 rounded-lg border border-bv-border bg-bv-surface hover:border-bv-teal hover:bg-bv-teal/5 transition-all cursor-pointer"
						>
							<div className="w-14 h-14 rounded-full bg-bv-teal/10 text-bv-teal flex items-center justify-center">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
									<rect x="4" y="2" width="16" height="8" rx="2"/>
									<path d="m17,14h1c1.105,0,2,.895,2,2"/>
									<path d="m4,16c0-1.105.895-2,2-2h1"/>
									<path d="m7,22h-1c-1.105,0-2-.895-2-2"/>
									<path d="m20,20c0,1.105-.895,2-2,2h-1"/>
									<line x1="13" y1="14" x2="11" y2="14"/>
									<line x1="13" y1="22" x2="11" y2="22"/>
								</svg>
							</div>
							<span className="text-[13px] text-bv-text font-medium">
								Insert to add new content
							</span>
						</button>
						<button
							onClick={() => handleModeChange('bug-report')}
							className="w-full flex flex-col items-center gap-3 px-6 py-4 rounded-lg border border-bv-border bg-bv-surface hover:border-bv-teal hover:bg-bv-teal/5 transition-all cursor-pointer"
						>
							<div className="w-14 h-14 rounded-full bg-bv-teal/10 text-bv-teal flex items-center justify-center">
								<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
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
							</div>
							<span className="text-[13px] text-bv-text font-medium">
								Report a bug
							</span>
							<span className="text-[11px] text-bv-text-mid text-center leading-relaxed">
								Select events from recording history and describe the issue
							</span>
						</button>
						<button
							onClick={() => handleModeChange('theme')}
							className="w-full flex flex-col items-center gap-3 px-6 py-4 rounded-lg border border-bv-border bg-bv-surface hover:border-bv-teal hover:bg-bv-teal/5 transition-all cursor-pointer"
						>
							<div className="w-14 h-14 rounded-full bg-bv-teal/10 text-bv-teal flex items-center justify-center">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
									<path
									  fillRule="evenodd"
									  clipRule="evenodd"
									  d="M3 11A9 8.5 0 1 0 21 11A9 8.5 0 1 0 3 11ZM6.5 16A2 2 0 1 0 10.5 16A2 2 0 1 0 6.5 16ZM6.4 7.5A1.6 1.6 0 1 0 9.6 7.5A1.6 1.6 0 1 0 6.4 7.5ZM10.4 4.5A1.6 1.6 0 1 0 13.6 4.5A1.6 1.6 0 1 0 10.4 4.5ZM14.4 7.5A1.6 1.6 0 1 0 17.6 7.5A1.6 1.6 0 1 0 14.4 7.5ZM15.9 11.5A1.6 1.6 0 1 0 19.1 11.5A1.6 1.6 0 1 0 15.9 11.5ZM14.4 15.5A1.6 1.6 0 1 0 17.6 15.5A1.6 1.6 0 1 0 14.4 15.5Z"
									/>
								</svg>
							</div>
							<span className="text-[13px] text-bv-text font-medium">
								Theme
							</span>
							<span className="text-[11px] text-bv-text-mid text-center leading-relaxed">
								Edit colors, typography, spacing, and other CSS variables
							</span>
						</button>
					</div>
					{queueFooter}
				</div>
			);
		}

		// Bug Report mode — full-panel timeline UI (no element selection needed)
		if (mode === 'bug-report') {
			return (
				<div className="h-full flex flex-col">
					<div className="px-3 pt-3 pb-2 border-b border-bv-border">
						<div className="flex items-center justify-between gap-2">
							<ModeToggle
								mode={mode}
								onModeChange={handleModeChange}
								isPicking={isPicking}
							isEngaged={isEngaged}
						/>
						<div className="flex-1 min-w-0">
							<span className="font-display font-bold text-[13px] text-bv-text leading-tight">
								Bug Report
								</span>
							</div>
							{!isEmbeddedInStorybook && <ContainerSwitcher />}
						</div>
					</div>
					<BugReportMode
						onSubmit={(data) => {
							const patch = {
								id: crypto.randomUUID(),
								kind: 'bug-report' as const,
								elementKey: data.bugElement?.selectorPath ?? 'bug-report',
								status: 'staged' as const,
								originalClass: '',
								newClass: '',
								property: 'bug-report',
								timestamp: new Date().toISOString(),
								bugDescription: data.bugDescription,
								bugScreenshots: data.bugScreenshots,
								bugTimeline: data.bugTimeline,
								bugTimeRange: data.bugTimeRange,
								bugElement: data.bugElement,
							};
							send({ type: 'BUG_REPORT_STAGE', patch });
						}}
					/>
					{queueFooter}
				</div>
			);
		}

		// Mode is active but no element selected
		return (
			<div className="h-full flex flex-col">
				<div className="px-3 pt-3 pb-2 border-b border-bv-border">
					<div className="flex items-center justify-between gap-2">
						<ModeToggle
							mode={mode}
							onModeChange={handleModeChange}
							isPicking={isPicking}
							isEngaged={isEngaged}
					/>
					<div className="flex-1 min-w-0">
						{mode === 'insert' ? (
								<span className="text-[11px] text-bv-teal font-medium">
								{insertPoint
									? formatInsertLabel(insertPoint.position, insertPoint.targetName)
									: 'Pick a placement on the page'}
								</span>
							) : selectModeActive ? (
								<span className="text-[11px] text-bv-teal font-medium">
									Click an element on the page
								</span>
							) : (
								<span className="text-[12px] text-bv-muted">
									No element selected
								</span>
							)}
						</div>
					{!isEmbeddedInStorybook && <ContainerSwitcher />}
					</div>
				</div>
				<TabBar tabs={currentTabs} activeTab={activeTab} onTabChange={handleTabChange} />
				<div className="flex-1 overflow-auto">
				{activeTab === "replace" ? (
					<DrawTab insertMode="replace" hasPageSelection={!!elementData || !!insertPoint} selectedComponentName={elementData?.componentName} selectedComponentProps={resolvedComponentProps} ghostPatchId={elementData?.ghostPatchId} onArmedChange={handleArmedChange} />
				) : activeTab === "place" ? (
					<DrawTab insertMode="place" hasPageSelection={!!elementData || !!insertPoint} selectedComponentName={elementData?.componentName} selectedComponentProps={resolvedComponentProps} ghostPatchId={elementData?.ghostPatchId} onArmedChange={handleArmedChange} />
				) : selectModeActive ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
							<div className="w-10 h-10 rounded-full bg-bv-teal text-white flex items-center justify-center">
								<svg
									width="20"
									height="20"
									viewBox="0 0 16 16"
									fill="currentColor"
								>
									<path d="M14,0H2C.895,0,0,.895,0,2V14c0,1.105,.895,2,2,2H6c.552,0,1-.448,1-1h0c0-.552-.448-1-1-1H2V2H14V6c0,.552,.448,1,1,1h0c.552,0,1-.448,1-1V2c0-1.105-.895-2-2-2Z" />
									<path d="M12.043,10.629l2.578-.644c.268-.068,.43-.339,.362-.607-.043-.172-.175-.308-.345-.358l-7-2c-.175-.051-.363-.002-.492,.126-.128,.129-.177,.317-.126,.492l2,7c.061,.214,.257,.362,.48,.362h.009c.226-.004,.421-.16,.476-.379l.644-2.578,3.664,3.664c.397,.384,1.03,.373,1.414-.025,.374-.388,.374-1.002,0-1.389l-3.664-3.664Z" />
								</svg>
							</div>
							<span className="text-[12px] text-bv-teal font-medium">
								Selection mode active
							</span>
							<span className="text-[12px] text-bv-muted text-center leading-relaxed">
								Hover over elements on the page to preview, then click to
								select.
								<br />
								Press{" "}
								<span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/6 border border-white/8 font-mono text-[10px] text-bv-text-mid leading-none">Esc</span>{" "}
								to cancel.
							</span>
						</div>
					) : (
						<div className="flex flex-1 flex-col justify-center p-4">
							<button
								onClick={() => {
									handleModeChange('select');
								}}
								className="w-full flex flex-col items-center gap-3 px-6 py-5 rounded-lg border border-bv-border bg-bv-surface hover:border-bv-teal hover:bg-bv-teal/5 transition-all cursor-pointer"
							>
								<div className="w-14 h-14 rounded-full bg-bv-teal/10 text-bv-teal flex items-center justify-center">
									<svg
										width="28"
										height="28"
										viewBox="0 0 64 64"
										fill="currentColor"
									>
										<path d="M2,9C1.447,9,1,8.552,1,8V2c0-0.552,0.447-1,1-1h6c0.553,0,1,0.448,1,1S8.553,3,8,3H3v5C3,8.552,2.553,9,2,9z" />
										<path d="M8,48H2c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v5h5c0.553,0,1,0.448,1,1S8.553,48,8,48z" />
										<path d="M47,9c-0.553,0-1-0.448-1-1V3h-5c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1v6C48,8.552,47.553,9,47,9z" />
										<path d="M21,3h-6c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1S21.553,3,21,3z" />
										<path d="M2,22c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v6C3,21.552,2.553,22,2,22z" />
										<path d="M2,35c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v6C3,34.552,2.553,35,2,35z" />
										<path d="M47,22c-0.553,0-1-0.448-1-1v-6c0-0.552,0.447-1,1-1s1,0.448,1,1v6C48,21.552,47.553,22,47,22z" />
										<path d="M47,31c-0.553,0-1-0.448-1-1v-2c0-0.552,0.447-1,1-1s1,0.448,1,1v2C48,30.552,47.553,31,47,31z" />
										<path d="M34,3h-6c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1S34.553,3,34,3z" />
										<path d="M21,48h-6c-0.553,0-1-0.448-1-1s0.447-1,1-1h6c0.553,0,1,0.448,1,1S21.553,48,21,48z" />
										<path d="M30,48h-2c-0.553,0-1-0.448-1-1s0.447-1,1-1h2c0.553,0,1,0.448,1,1S30.553,48,30,48z" />
										<path d="M62.707,57.293L51.688,46.274l10.759-5.379c0.368-0.184,0.586-0.575,0.549-0.985c-0.037-0.41-0.322-0.755-0.717-0.87l-31-9c-0.355-0.1-0.729-0.005-0.986,0.253c-0.258,0.258-0.355,0.636-0.253,0.986l9,31c0.114,0.396,0.46,0.68,0.869,0.717C39.94,62.999,39.971,63,40,63c0.376,0,0.724-0.212,0.895-0.553l5.38-10.759l11.019,11.019c0.391,0.391,1.023,0.391,1.414,0l4-4C63.098,58.316,63.098,57.684,62.707,57.293z" />
									</svg>
								</div>
								<span className="text-[12px] text-bv-text font-medium">
									Select an element to inspect
								</span>
								<span className="inline-flex items-center gap-1">
									<span className="w-5 h-5 rounded flex items-center justify-center bg-white/6 border border-white/8 font-mono text-[10px] font-semibold text-bv-text-mid leading-none">⌘</span>
									<span className="w-5 h-5 rounded flex items-center justify-center bg-white/6 border border-white/8 font-mono text-[10px] font-semibold text-bv-text-mid leading-none">⇧</span>
									<span className="w-5 h-5 rounded flex items-center justify-center bg-white/6 border border-white/8 font-mono text-[10px] font-semibold text-bv-text-mid leading-none">C</span>
								</span>
							</button>
						</div>
					)}
				</div>
				{queueFooter}
			</div>
		);
	}

	const parsedClasses = elementData.parsedClasses;

	return (
		<div className="h-full flex flex-col">
			<div className="px-3 pt-3 pb-2 border-b border-bv-border">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<ModeToggle
							mode={mode}
							onModeChange={handleModeChange}
							isPicking={isPicking}
								isEngaged={isEngaged}
						/>
						<div className="font-display font-bold text-[13px] text-bv-text leading-tight truncate">
							{elementData.componentName}{" "}
							<span className="font-ui font-normal text-bv-text-mid">
								— {elementData.instanceCount} instance
								{elementData.instanceCount !== 1 ? "s" : ""}
							</span>
						</div>
					</div>
				{!isEmbeddedInStorybook && <ContainerSwitcher />}
				</div>
			</div>
			<TabBar tabs={currentTabs} activeTab={activeTab} onTabChange={handleTabChange} />
			{textEditing && (
				<div className="px-3 py-2 bg-bv-teal/10 border-b border-bv-teal/30 text-xs text-bv-teal font-medium">
					Editing text in the page…
				</div>
			)}
			<div className={`flex-1 overflow-auto ${textEditing ? 'opacity-40 pointer-events-none' : ''}`}>
				{activeTab === "design" && (
					<Picker
						key={selectionId}
						componentName={elementData.componentName}
						instanceCount={elementData.instanceCount}
						rawClasses={elementData.classes}
						parsedClasses={parsedClasses}
						tailwindConfig={elementData.tailwindConfig}
						patchManager={patchManager}
					/>
				)}
				{activeTab === "replace" && (
					<DrawTab insertMode="replace" hasPageSelection={!!elementData || !!insertPoint} selectedComponentName={elementData?.componentName} selectedComponentProps={resolvedComponentProps} ghostPatchId={elementData?.ghostPatchId} onArmedChange={handleArmedChange} />
				)}
				{activeTab === "place" && (
					<DrawTab insertMode="place" hasPageSelection={!!elementData || !!insertPoint} selectedComponentName={elementData?.componentName} selectedComponentProps={resolvedComponentProps} ghostPatchId={elementData?.ghostPatchId} onArmedChange={handleArmedChange} />
				)}
			</div>
			{queueFooter}
		</div>
	);
}
