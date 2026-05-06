import { useEffect, useRef, useState } from "react";
import { useFloating, offset, flip, shift, autoUpdate, FloatingPortal } from "@floating-ui/react";
import { FocusTrapContainer } from "../FocusTrapContainer";
import type { ScaleScrubberProps } from "./types";

/** Pixels of horizontal drag required before scrub mode activates */
const SCRUB_THRESHOLD = 4;
/** Pixels per one step when scrubbing */
const PX_PER_STEP = 10;

export function ScaleScrubber({
	values,
	currentValue,
	lockedValue,
	locked,
	ghost,
	onStart,
	onHover,
	onLeave,
	onClick,
	onRemove,
	onRemoveHover,
}: ScaleScrubberProps) {
	const [open, setOpen] = useState(false);
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);
	const scrubIndexRef = useRef<number | null>(null);
	const dragRef = useRef<{
		startX: number;
		startIndex: number;
		didScrub: boolean;
	} | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLDivElement>(null);

	const { refs, floatingStyles } = useFloating({
		open,
		strategy: "fixed",
		placement: "bottom-start",
		middleware: [offset(2), flip(), shift({ padding: 4 })],
		whileElementsMounted: autoUpdate,
	});

	// Only treat lockedValue as "ours" if it actually appears in this scrubber's values
	const isThisLocked = lockedValue !== null && values.includes(lockedValue);

	const displayValue =
		scrubIndex !== null
			? values[scrubIndex]
			: isThisLocked
				? lockedValue!
				: currentValue;

	// Scroll active item into view when dropdown opens
	useEffect(() => {
		if (open && activeItemRef.current) {
			activeItemRef.current.scrollIntoView?.({ block: "nearest" });
		}
	}, [open]);

	// A foreign lock (another property staged) fully disables this scrubber.
	// Our own lock (isThisLocked) keeps it interactive so the value can be revised.
	const foreignLocked = locked && !isThisLocked;

	function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
		if (foreignLocked) return;
		onStart?.();
		const activeValue = isThisLocked ? lockedValue! : currentValue;
		const currentIndex = values.indexOf(activeValue);
		dragRef.current = {
			startX: e.clientX,
			startIndex: currentIndex >= 0 ? currentIndex : 0,
			didScrub: false,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
		const drag = dragRef.current;
		if (!drag) return;
		const dx = e.clientX - drag.startX;
		if (!drag.didScrub && Math.abs(dx) > SCRUB_THRESHOLD) {
			drag.didScrub = true;
			setOpen(false);
		}
		if (drag.didScrub) {
			const steps = Math.round(dx / PX_PER_STEP);
			const idx = Math.max(
				0,
				Math.min(values.length - 1, drag.startIndex + steps),
			);
			scrubIndexRef.current = idx;
			setScrubIndex(idx);
			onHover(values[idx]);
		}
	}

	function handlePointerUp() {
		const drag = dragRef.current;
		if (!drag) return;
		const currentScrubIndex = scrubIndexRef.current;
		if (drag.didScrub && currentScrubIndex !== null) {
			onClick(values[currentScrubIndex]);
		} else if (!drag.didScrub) {
			setOpen((prev) => {
				if (prev) onLeave();
				return !prev;
			});
		}
		scrubIndexRef.current = null;
		setScrubIndex(null);
		dragRef.current = null;
	}

	const isScrubbing = scrubIndex !== null;

	const chipStyle = isScrubbing
		? "bg-bit-teal/9 text-bit-teal ring-1 ring-bit-teal"
		: isThisLocked
			? "bg-bit-surface-hi text-bit-text ring-1 ring-bit-border hover:bg-bit-teal/9 hover:text-bit-teal hover:ring-bit-teal"
			: open
				? "bg-bit-surface-hi text-bit-text ring-1 ring-bit-border"
				: foreignLocked
					? "bg-bit-surface text-bit-text-mid"
					: ghost
						? "border border-dashed border-bit-border text-bit-muted bg-transparent hover:border-bit-teal hover:text-bit-teal"
						: "bg-bit-surface text-bit-text-mid hover:bg-bit-surface-hi hover:text-bit-text";

	return (
		<div ref={containerRef} className="relative inline-block">
			<div
				ref={refs.setReference}
				className={`group select-none px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors ${foreignLocked ? "cursor-default" : "cursor-ew-resize"} ${chipStyle}`}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
			>
				{!foreignLocked && (
					<span
						className={`inline-block mr-0.5 text-[9px] transition-opacity ${isScrubbing ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}
					>
						‹
					</span>
				)}
				{displayValue}
				{!foreignLocked && (
					<span
						className={`inline-block ml-0.5 text-[9px] transition-opacity ${isScrubbing ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}
					>
						›
					</span>
				)}
			</div>

			{open && (
				<FloatingPortal>
					<FocusTrapContainer
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 max-h-52 overflow-y-auto bg-bit-bg border border-bit-border rounded-md shadow-md min-w-[5rem]"
						onPointerDown={e => e.stopPropagation()}
						onMouseLeave={onLeave}
						onClose={() => {
							setOpen(false);
							onLeave();
						}}
					>
						{onRemove && (
							<div
								className={`flex items-center gap-1.5 px-2.5 py-[3px] text-[11px] font-mono cursor-pointer border-b border-bit-border text-bit-muted hover:text-red-400 ${
									currentValue === "" || lockedValue === ""
										? "text-bit-orange"
										: ""
								}`}
								onMouseEnter={onRemoveHover}
								onClick={(e) => {
									e.stopPropagation();
									onRemove();
									setOpen(false);
								}}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
									<circle cx="6" cy="6" r="5.5" />
									<line x1="4" y1="4" x2="8" y2="8" />
									<line x1="8" y1="4" x2="4" y2="8" />
								</svg>
								remove
							</div>
						)}
						{values.map((val) => {
							const isActive = val === (lockedValue ?? currentValue);
							const itemStyle = isActive
								? "bg-bit-teal/9 text-bit-teal"
								: "text-bit-text-mid hover:bg-bit-surface hover:text-bit-text";
							return (
								<div
									key={val}
									ref={isActive ? activeItemRef : undefined}
									className={`px-2.5 py-[3px] text-[11px] font-mono cursor-pointer ${itemStyle}`}
									onMouseEnter={() => onHover(val)}
									onClick={(e) => {
										e.stopPropagation();
										onClick(val);
										setOpen(false);
									}}
								>
									{val}
								</div>
							);
						})}
					</FocusTrapContainer>
				</FloatingPortal>
			)}
		</div>
	);
}
