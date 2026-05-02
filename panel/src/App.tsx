import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ContainerSwitcher } from "./components/ContainerSwitcher";
import { DrawTab } from "./components/DrawTab";
import { ModeToggle } from "./components/ModeToggle";
import { PatchPopover } from "./components/PatchPopover";
import { BugReportMode } from "./components/BugReportMode";
import { TabBar } from "./components/TabBar";
import { ThemeTab } from "./components/ThemeTab";
import type { ThemeOverride } from "./components/ThemeTab";
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
	const [colorScheme, setColorScheme] = useState<'dark' | 'light'>(() => {
		try { return (localStorage.getItem('vybit-color-scheme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
	});

	// Apply .light class to document root + persist + notify overlay
	useEffect(() => {
		document.documentElement.classList.toggle('light', colorScheme === 'light');
		try { localStorage.setItem('vybit-color-scheme', colorScheme); } catch { /* ignore */ }
		sendTo('overlay', { type: 'COLOR_SCHEME_CHANGED', colorScheme });
	}, [colorScheme]);

	const {
		mode,
		editTool,
		elementData,
		selectionId,
		insertPoint,
		selectModeActive,
		textEditing,
		currentTabs,
		activeTab,
		isPicking: rawIsPicking,
		isEditMode,
		handleModeChange,
		handleEditToolChange,
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

	// Lifted expanded state — survives DrawTab unmount/remount across conditional branches
	const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
	const toggleComponentExpanded = useCallback((groupName: string) => {
		setExpandedComponents(prev => {
			const next = new Set(prev);
			if (next.has(groupName)) next.delete(groupName);
			else next.add(groupName);
			return next;
		});
	}, []);
	const expandComponent = useCallback((groupName: string) => {
		setExpandedComponents(prev => {
			if (prev.has(groupName)) return prev;
			const next = new Set(prev);
			next.add(groupName);
			return next;
		});
	}, []);

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

	// --- Theme edits state (lifted from ThemeTab for discard integration) ---
	const [themeEdits, setThemeEdits] = useState<Map<string, ThemeOverride>>(new Map());

	// Live-preview theme overrides in the overlay
	const themeOverrides = useMemo(() => Array.from(themeEdits.values()), [themeEdits]);
	const tailwindVersion = themeConfig?.tailwindVersion ?? 4;
	useEffect(() => {
		sendTo('overlay', { type: 'THEME_PREVIEW', overrides: themeOverrides, tailwindVersion });
	}, [themeOverrides, tailwindVersion]);
	// On unmount / mode change away from theme, clear preview
	useEffect(() => {
		return () => {
			sendTo('overlay', { type: 'THEME_PREVIEW', overrides: [], tailwindVersion });
		};
	}, [tailwindVersion]);

	const handleThemeEdit = useCallback((tokenKey: string, override: ThemeOverride) => {
		setThemeEdits(prev => {
			const next = new Map(prev);
			next.set(tokenKey, override);
			return next;
		});
		patchManager.stageTheme(tokenKey, override, tailwindVersion as 3 | 4);
	}, [patchManager, tailwindVersion]);

	// Wrap discard to also remove theme edits
	const handleDiscard = useCallback((id: string) => {
		// Check if the discarded patch is a theme edit
		const discarded = patchManager.patches.find(p => p.id === id);
		if (discarded && discarded.elementKey === 'theme' && discarded.property) {
			setThemeEdits(prev => {
				const next = new Map(prev);
				next.delete(discarded.property);
				return next;
			});
		}
		patchManager.discard(id);
	}, [patchManager]);

	// Wrap discardAll to also clear all theme edits
	const handleDiscardAll = useCallback(() => {
		setThemeEdits(new Map());
		patchManager.discardAll();
	}, [patchManager]);

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

	const colorSchemeToggle = (
		<button
			type="button"
			onClick={() => setColorScheme(prev => prev === 'dark' ? 'light' : 'dark')}
			className="w-6 h-6 flex items-center justify-center rounded text-bit-muted hover:text-bit-text transition-colors"
			title={colorScheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{colorScheme === 'dark' ? (
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			) : (
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			)}
		</button>
	);

	const headerRight = (
		<div className="flex items-center gap-1">
			{colorSchemeToggle}
			{!isEmbeddedInStorybook && <ContainerSwitcher />}
		</div>
	);

	const queueFooter = (
		<div className="shrink-0">
			{agentWarning && (
				<div className="flex border-y border-bit-warn-border bg-bit-warn-bg">
					{/* Left accent rail */}
					<div className="w-[3px] shrink-0 bg-bit-warn-accent" />
					<div className="flex items-center gap-2 px-2.5 py-1.5 flex-1 min-w-0">
						{/* Icon chip */}
						{agentWarning.icon === "dot" ? (
							<div className="w-1.5 h-1.5 rounded-full bg-bit-orange animate-pulse shrink-0" />
						) : (
							<div
								className="w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0"
								style={{
									background: 'var(--color-bit-warn-icon-bg)',
									color: 'var(--color-bit-warn-icon-color)',
									boxShadow: '0 1px 3px var(--color-bit-warn-icon-shadow), inset 0 1px 0 rgba(255,255,255,0.25)',
								}}
							>
								<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
									<path
										fillRule="evenodd"
										d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.516-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
						)}
						{/* Text */}
						<span className="flex-1 text-[10px] font-medium leading-tight min-w-0" style={{ color: 'var(--color-bit-warn-text-sub)' }}>
							<span style={{ color: 'var(--color-bit-warn-text)' }}>{agentWarning.text}</span> —{" "}
							<a
								href="https://github.com/bitovi/vybit?tab=readme-ov-file#telling-your-agent-to-start-making-features"
								target="_blank"
								rel="noreferrer"
								className="underline transition-colors"
								style={{ color: 'var(--color-bit-warn-link)' }}
								onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--color-bit-warn-link-hover)'; }}
								onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--color-bit-warn-link)'; }}
							>
								ask your agent
							</a>{" "}
							to start
						</span>
						{/* Copy prompt button */}
						<button
							onClick={handleCopyPrompt}
							className="shrink-0 px-1.5 py-0.5 rounded border font-semibold text-[9px] transition-colors"
							style={promptCopied ? {
								background: '#d1fae5',
								borderColor: '#059669',
								color: '#065f46',
							} : {
								background: 'var(--color-bit-warn-btn-bg)',
								borderColor: 'var(--color-bit-warn-btn-border)',
								color: 'var(--color-bit-warn-btn-text)',
								boxShadow: `0 1px 2px var(--color-bit-warn-btn-shadow)`,
							}}
							onMouseEnter={e => {
								if (!promptCopied) {
									const el = e.currentTarget;
									el.style.background = 'var(--color-bit-warn-btn-hover-bg)';
									el.style.borderColor = 'var(--color-bit-warn-btn-hover-border)';
									el.style.color = 'var(--color-bit-warn-btn-hover-text)';
								}
							}}
							onMouseLeave={e => {
								if (!promptCopied) {
									const el = e.currentTarget;
									el.style.background = 'var(--color-bit-warn-btn-bg)';
									el.style.borderColor = 'var(--color-bit-warn-btn-border)';
									el.style.color = 'var(--color-bit-warn-btn-text)';
								}
							}}
							title={`Copy: "${VYBIT_PROMPT}"`}
						>
							{promptCopied ? "Copied!" : "Copy prompt"}
						</button>
					</div>
				</div>
			)}
			<div className="flex items-center justify-center px-3 py-1.5 border-t border-bit-border gap-3 text-[10px]">
				<PatchPopover
					label="draft"
					count={draft}
					items={draftPatches}
					activeColor="text-bit-draft"
					onDiscard={handleDiscard}
					onCommitAll={() => patchManager.commitAll()}
					onDiscardAll={handleDiscardAll}
				/>
				<PatchPopover
					label="committed"
					count={committed}
					items={committedCommits.flatMap((c) => c.patches)}
					activeColor="text-bit-committed"
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
					activeColor="text-bit-teal"
				/>
			</div>
		</div>
	);

	// Block the entire panel while the overlay is not connected
	if (!overlayConnected) {
		return (
			<div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
				<div className="w-12 h-12 rounded-full bg-bit-teal/10 text-bit-teal flex items-center justify-center">
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
					<p className="text-[13px] text-bit-text font-medium">
						Connecting to page…
					</p>
					<p className="text-[11px] text-bit-text-mid mt-1 leading-relaxed">
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
					<div className="px-3 pt-3 pb-2 border-b border-bit-border">
						<div className="flex items-center justify-between gap-2">
							<ModeToggle
								mode={mode}
								onModeChange={handleModeChange}
								isPicking={isPicking}
								isEngaged={isEngaged}
								isEditMode={isEditMode}
							/>
							{headerRight}
						</div>
					</div>
					{themeConfig ? (
						<ThemeTab
							tailwindConfig={themeConfig}
							tailwindVersion={themeConfig.tailwindVersion ?? 4}
							themeEdits={themeEdits}
							onThemeEdit={handleThemeEdit}
						/>
					) : (
						<div className="flex-1 flex items-center justify-center text-[11px] text-bit-text-mid">
							Loading theme data…
						</div>
					)}
					{queueFooter}
				</div>
			);
		}

		// Landing page — edit mode, no tool selected yet
		if (mode === null) {
			return (
				<div className="h-full flex flex-col">
					<div className="px-3 pt-3 pb-2 border-b border-bit-border">
						<div className="flex items-center justify-between gap-2">
							<ModeToggle
								mode={mode}
								onModeChange={handleModeChange}
								isPicking={isPicking}
								isEngaged={isEngaged}
								isEditMode={isEditMode}
							/>
							{headerRight}
						</div>
					</div>
					<TabBar tabs={currentTabs} activeTab={activeTab} onTabChange={handleTabChange} />
					<div className="flex-1 overflow-auto">
						{activeTab === 'components' ? (
							<DrawTab insertMode="place" hasPageSelection={false} onArmedChange={handleArmedChange} expandedComponents={expandedComponents} onToggleExpanded={toggleComponentExpanded} onExpandComponent={expandComponent} />
						) : (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
								<div className="w-10 h-10 rounded-full bg-bit-teal/10 text-bit-teal flex items-center justify-center">
									<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
										<path d="M14,0H2C.895,0,0,.895,0,2V14c0,1.105,.895,2,2,2H6c.552,0,1-.448,1-1h0c0-.552-.448-1-1-1H2V2H14V6c0,.552,.448,1,1,1h0c.552,0,1-.448,1-1V2c0-1.105-.895-2-2-2Z" />
										<path d="M12.043,10.629l2.578-.644c.268-.068,.43-.339,.362-.607-.043-.172-.175-.308-.345-.358l-7-2c-.175-.051-.363-.002-.492,.126-.128,.129-.177,.317-.126,.492l2,7c.061,.214,.257,.362,.48,.362h.009c.226-.004,.421-.16,.476-.379l.644-2.578,3.664,3.664c.397,.384,1.03,.373,1.414-.025,.374-.388,.374-1.002,0-1.389l-3.664-3.664Z" />
									</svg>
								</div>
								<span className="text-[12px] text-bit-text-mid leading-relaxed">
									Use the toolbar below the page to select an element or set an insertion point.
								</span>
							</div>
						)}
					</div>
					{queueFooter}
				</div>
			);
		}

		// Bug Report mode — full-panel timeline UI (no element selection needed)
		if (mode === 'bug-report') {
			return (
				<div className="h-full flex flex-col">
					<div className="px-3 pt-3 pb-2 border-b border-bit-border">
						<div className="flex items-center justify-between gap-2">
							<ModeToggle
								mode={mode}
								onModeChange={handleModeChange}
								isPicking={isPicking}
							isEngaged={isEngaged}
							isEditMode={isEditMode}
						/>
						<div className="flex-1 min-w-0">
							<span className="font-display font-bold text-[13px] text-bit-text leading-tight">
								Bug Report
								</span>
							</div>
								{headerRight}
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
				<div className="px-3 pt-3 pb-2 border-b border-bit-border">
					<div className="flex items-center justify-between gap-2">
						<ModeToggle
							mode={mode}
							onModeChange={handleModeChange}
							isPicking={isPicking}
							isEngaged={isEngaged}
							isEditMode={isEditMode}
						/>
					{headerRight}
					</div>
				</div>
				<TabBar tabs={currentTabs} activeTab={activeTab} onTabChange={handleTabChange} />
				<div className="flex-1 overflow-auto">
				{activeTab === "components" ? (
					<DrawTab insertMode={mode === 'insert' ? 'place' : 'replace'} hasPageSelection={!!elementData || !!insertPoint} selectedComponentName={elementData?.componentName} selectedComponentProps={resolvedComponentProps} ghostPatchId={elementData?.ghostPatchId} onArmedChange={handleArmedChange} expandedComponents={expandedComponents} onToggleExpanded={toggleComponentExpanded} onExpandComponent={expandComponent} />
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
						<div className="w-10 h-10 rounded-full bg-bit-teal/10 text-bit-teal flex items-center justify-center">
							<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
								<path d="M14,0H2C.895,0,0,.895,0,2V14c0,1.105,.895,2,2,2H6c.552,0,1-.448,1-1h0c0-.552-.448-1-1-1H2V2H14V6c0,.552,.448,1,1,1h0c.552,0,1-.448,1-1V2c0-1.105-.895-2-2-2Z" />
								<path d="M12.043,10.629l2.578-.644c.268-.068,.43-.339,.362-.607-.043-.172-.175-.308-.345-.358l-7-2c-.175-.051-.363-.002-.492,.126-.128,.129-.177,.317-.126,.492l2,7c.061,.214,.257,.362,.48,.362h.009c.226-.004,.421-.16,.476-.379l.644-2.578,3.664,3.664c.397,.384,1.03,.373,1.414-.025,.374-.388,.374-1.002,0-1.389l-3.664-3.664Z" />
							</svg>
						</div>
						{selectModeActive ? (
							<>
								<span className="text-[12px] text-bit-teal font-medium">
									Selection mode active
								</span>
								<span className="text-[11px] text-bit-muted leading-relaxed">
									Click an element on the page to select it.
								</span>
							</>
						) : mode === 'insert' ? (
							<span className="text-[12px] text-bit-text-mid leading-relaxed">
								{insertPoint
									? formatInsertLabel(insertPoint.position, insertPoint.targetName)
									: 'Click on the page to set an insertion point.'}
							</span>
						) : (
							<span className="text-[12px] text-bit-text-mid leading-relaxed">
								No element selected
							</span>
						)}
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
			<div className="px-3 pt-3 pb-2 border-b border-bit-border">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<ModeToggle
							mode={mode}
							onModeChange={handleModeChange}
							isPicking={isPicking}
								isEngaged={isEngaged}							isEditMode={isEditMode}						/>
						<div className="font-display font-bold text-[13px] text-bit-text leading-tight truncate">
							{elementData.componentName}{" "}
							<span className="font-ui font-normal text-bit-text-mid">
								— {elementData.instanceCount} instance
								{elementData.instanceCount !== 1 ? "s" : ""}
							</span>
						</div>
					</div>
				{headerRight}
				</div>
			</div>
			<TabBar tabs={currentTabs} activeTab={activeTab} onTabChange={handleTabChange} />
			{textEditing && (
				<div className="px-3 py-2 bg-bit-teal/10 border-b border-bit-teal/30 text-xs text-bit-teal font-medium">
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
				{activeTab === "components" && (
					<DrawTab insertMode={mode === 'insert' ? 'place' : 'replace'} hasPageSelection={!!elementData || !!insertPoint} selectedComponentName={elementData?.componentName} selectedComponentProps={resolvedComponentProps} ghostPatchId={elementData?.ghostPatchId} onArmedChange={handleArmedChange} expandedComponents={expandedComponents} onToggleExpanded={toggleComponentExpanded} onExpandComponent={expandComponent} />
				)}
			</div>
			{queueFooter}
		</div>
	);
}
