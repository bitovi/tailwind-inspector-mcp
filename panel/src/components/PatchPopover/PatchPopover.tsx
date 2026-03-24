import { useEffect, useMemo, useRef, useState } from "react";
import type { Patch, PatchSummary } from "../../../../shared/types";

type PatchItem = Patch | PatchSummary;

function describeComponentDrop(item: PatchItem): string {
	const droppedName = item.component?.name ?? "component";
	const dropped = `<${droppedName}>`;
	const insertMode = "insertMode" in item ? item.insertMode : undefined;
	const componentTargetName =
		("targetComponentName" in item && item.targetComponentName) ||
		("parentComponent" in item && item.parentComponent?.name) ||
		null;
	const rawTargetName = componentTargetName || (item.elementKey || null);
	const wrappedTargetName = componentTargetName ? `<${rawTargetName}>` : rawTargetName;
	const isNewTarget = "targetPatchId" in item && !!item.targetPatchId;
	const targetName = wrappedTargetName && isNewTarget ? `new ${wrappedTargetName}` : wrappedTargetName;

	switch (insertMode) {
		case "after":
			return targetName ? `Appended ${dropped} after ${targetName}` : `Appended ${dropped}`;
		case "before":
			return targetName ? `Prepended ${dropped} before ${targetName}` : `Prepended ${dropped}`;
		case "last-child":
			return targetName ? `Inserted ${dropped} bottom of ${targetName}` : `Inserted ${dropped}`;
		case "first-child":
			return targetName ? `Inserted ${dropped} top of ${targetName}` : `Inserted ${dropped}`;
		default:
			return targetName ? `Inserted ${dropped} in ${targetName}` : `Inserted ${dropped}`;
	}
}

/** Determine the change type for icon/badge rendering */
function getChangeType(item: PatchItem): "add" | "change" | "remove" | "message" | "design" | "drop" | "text" {
	const kind = "kind" in item ? item.kind : "class-change";
	if (kind === "message") return "message";
	if (kind === "design") return "design";
	if (kind === "component-drop") return "drop";
	if (kind === "text-change") return "text";
	// class-change: no originalClass means addition, no newClass means removal
	if (!item.originalClass && item.newClass) return "add";
	if (item.originalClass && !item.newClass) return "remove";
	return "change";
}

/** Small badge indicating the type of change */
function ChangeTypeBadge({ type }: { type: ReturnType<typeof getChangeType> }) {
	switch (type) {
		case "add":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
					+
				</span>
			);
		case "remove":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] font-bold bg-red-500/15 text-red-400">
					−
				</span>
			);
		case "change":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] bg-amber-500/15 text-amber-400">
					↔
				</span>
			);
		case "message":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] bg-blue-500/15 text-blue-400">
					💬
				</span>
			);
		case "design":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] bg-purple-500/15 text-purple-400">
					✏️
				</span>
			);
		case "drop":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] bg-cyan-500/15 text-cyan-400">
					⤵
				</span>
			);
		case "text":
			return (
				<span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] bg-violet-500/15 text-violet-400">
					T
				</span>
			);
	}
}

/** Group items by component name, preserving order of first appearance */
function groupByComponent(items: PatchItem[]): { name: string; items: PatchItem[] }[] {
	const groups: Map<string, PatchItem[]> = new Map();
	for (const item of items) {
		const name = item.component?.name || "General";
		const existing = groups.get(name);
		if (existing) {
			existing.push(item);
		} else {
			groups.set(name, [item]);
		}
	}
	return Array.from(groups.entries()).map(([name, groupItems]) => ({ name, items: groupItems }));
}

interface PatchPopoverProps {
	label: string;
	count: number;
	items: PatchItem[];
	activeColor: string;
	/** Tailwind bg class for the status dot indicator */
	dotColor?: string;
	/** Action buttons per item (e.g. commit, discard) */
	onCommit?: (id: string) => void;
	onDiscard?: (id: string) => void;
	/** Bulk actions shown at the bottom */
	onCommitAll?: () => void;
	onDiscardAll?: () => void;
}

export function PatchPopover({
	label,
	count,
	items,
	activeColor,
	dotColor,
	onCommit,
	onDiscard,
	onCommitAll,
	onDiscardAll,
}: PatchPopoverProps) {
	const [open, setOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [popoverLeft, setPopoverLeft] = useState<number | undefined>(undefined);

	const groups = useMemo(() => groupByComponent(items), [items]);

	// Compute clamped horizontal position when popover opens
	useEffect(() => {
		if (!open || !buttonRef.current) return;
		const btn = buttonRef.current;
		const btnRect = btn.getBoundingClientRect();
		const popoverWidth = 260;
		const viewportWidth = window.innerWidth;
		const pad = 4;

		let idealLeft = btnRect.left + btnRect.width / 2 - popoverWidth / 2;
		idealLeft = Math.max(
			pad,
			Math.min(idealLeft, viewportWidth - popoverWidth - pad),
		);
		setPopoverLeft(idealLeft - btnRect.left);
	}, [open]);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open]);

	const isActive = count > 0;
	const hasActions = onCommit || onDiscard || onCommitAll || onDiscardAll;

	return (
		<div ref={wrapperRef} className="relative">
			<button
				ref={buttonRef}
				className={`flex items-center gap-1.5 text-[11px] tabular-nums border-none bg-transparent cursor-pointer px-0 py-0 ${
					isActive ? `${activeColor} font-medium` : "text-bv-muted"
				} ${isActive ? "hover:underline" : ""}`}
				onClick={() => isActive && setOpen(!open)}
				disabled={!isActive}
				type="button"
			>
				{dotColor && (
					<span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
				)}
				<span className={`${isActive ? "bg-white/10 px-1.5 py-0.5 rounded-full text-[10px] font-bold" : ""}`}>
					{count}
				</span>
				{label}
			</button>

			{open && (
				<div
					className="absolute bottom-full mb-1.5 w-65 bg-bv-surface border border-bv-border rounded-lg shadow-xl overflow-hidden flex flex-col z-9999"
					style={
						popoverLeft !== undefined ? { left: `${popoverLeft}px` } : undefined
					}
				>
					{/* Header */}
					<div className="px-3 py-2 border-b border-bv-border flex items-center justify-between">
						<span className="text-[11px] font-semibold text-bv-text uppercase tracking-wide">
							{label}
						</span>
						<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeColor} bg-white/10`}>
							{count}
						</span>
					</div>

					{/* Grouped patch list */}
					<div className="flex-1 overflow-auto max-h-80">
						{items.length === 0 ? (
							<div className="px-3 py-3 text-[11px] text-bv-muted italic text-center">
								No changes
							</div>
						) : (
							groups.map((group) => (
								<div key={group.name}>
									{/* Component group header */}
									<div className="sticky top-0 z-10 px-3 py-1 bg-bv-surface-hi/80 backdrop-blur-sm border-b border-bv-border/50">
										<span className="text-[10px] font-semibold text-bv-text-mid tracking-wide">
											{group.name}
										</span>
										<span className="text-[10px] text-bv-muted ml-1.5">
											({group.items.length})
										</span>
									</div>

									{/* Items in this group */}
									{group.items.map((item) => {
										const changeType = getChangeType(item);
										const isMessage = changeType === "message";
										const isDesign = changeType === "design";
										const isComponentDrop = changeType === "drop";
										const isTextChange = changeType === "text";
										return (
											<div
												key={item.id}
												className="flex items-center gap-2 px-3 py-1.5 border-b border-bv-border/40 last:border-b-0 hover:bg-bv-surface-hi/40 transition-colors group"
											>
												<ChangeTypeBadge type={changeType} />
												<div className="flex-1 min-w-0">
													{isComponentDrop ? (
														<div className="text-[11px] text-bv-text truncate">
															{describeComponentDrop(item)}
														</div>
													) : isDesign ? (
														<div className="text-[11px] text-bv-text">
															<span className="truncate">
																Drawing
																{item.component?.name
																	? ` in ${item.component.name}`
																	: ""}
															</span>
															{"image" in item && item.image && (
																<img
																	src={item.image as string}
																	alt="Design drawing"
																	className="w-full max-h-14 object-contain rounded border border-bv-border bg-white mt-1"
																/>
															)}
														</div>
													) : isMessage ? (
														<div className="text-[11px] text-bv-text truncate italic">
															"{("message" in item && item.message) || ""}"
														</div>
													) : isTextChange ? (
														<div className="text-[11px] font-mono text-bv-text truncate">
															{"originalText" in item && item.originalText && (
																<>
																	<span className="line-through text-bv-muted">
																		{item.originalText}
																	</span>
																	{" → "}
																</>
															)}
															<span className="text-violet-400">
																{"newText" in item ? item.newText : ""}
															</span>
														</div>
													) : (
														<div className="text-[11px] font-mono text-bv-text truncate">
															{item.originalClass ? (
																<>
																	<span className="line-through text-bv-muted">
																		{item.originalClass}
																	</span>
																	<span className="text-bv-muted mx-1">→</span>
																	<span className="text-bv-teal font-medium">
																		{item.newClass}
																	</span>
																</>
															) : (
																<span className="text-emerald-400 font-medium">
																	{item.newClass}
																</span>
															)}
														</div>
													)}
												</div>

												{/* Discard button — always visible */}
												{onDiscard && (
													<button
														className="shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] border-none cursor-pointer bg-transparent text-bv-muted hover:text-bv-orange hover:bg-red-500/10 transition-colors"
														onClick={(e) => {
															e.stopPropagation();
															onDiscard(item.id);
														}}
														title="Discard"
														type="button"
													>
														✕
													</button>
												)}
											</div>
										);
									})}
								</div>
							))
						)}
					</div>

					{/* Bulk actions footer */}
					{hasActions && items.length > 0 && (onCommitAll || onDiscardAll) && (
						<div className="flex gap-2 px-3 py-2 border-t border-bv-border bg-bv-surface-hi/40">
							{onCommitAll && (
								<button
									className="flex-1 text-[11px] py-1.5 rounded-md border-none cursor-pointer font-semibold bg-bv-teal text-white hover:brightness-110 transition-all"
									onClick={() => {
										onCommitAll();
										setOpen(false);
									}}
									type="button"
								>
									Commit All
								</button>
							)}
							{onDiscardAll && (
								<button
									className="text-[11px] px-3 py-1.5 rounded-md cursor-pointer font-semibold bg-transparent border border-bv-border text-bv-text-mid hover:text-bv-orange hover:border-bv-orange transition-colors"
									onClick={() => {
										onDiscardAll();
										setOpen(false);
									}}
									type="button"
								>
									Discard All
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
