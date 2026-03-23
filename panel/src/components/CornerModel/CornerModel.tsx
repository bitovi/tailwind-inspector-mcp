import { useState } from "react";
import "./CornerModel.css";
import { MiniScrubber } from "../BoxModel/components/MiniScrubber";
import type {
	CornerKey,
	CornerModelProps,
	CornerSlotData,
	SideKey,
	SlotKey,
} from "./types";

/** Strip the "rounded" prefix and corner/side qualifier for compact display.
 *  e.g. "rounded-tl-lg" → "lg", "rounded-t-lg" → "lg", "rounded-lg" → "lg", "rounded" → "—" */
function truncateRounded(value: string): string {
	if (value === "rounded") return "—";
	const withoutPrefix = value.replace(/^rounded-/, "");
	return withoutPrefix.replace(/^(?:tl|tr|br|bl|[trbl])-/, "");
}

/** Derive the corner/side class from a shorthand.
 *  e.g. deriveFromShorthand('rounded-lg', 'tl') → 'rounded-tl-lg'
 *       deriveFromShorthand('rounded', 'tr') → 'rounded-tr' */
function deriveFromShorthand(shorthand: string, key: CornerKey | SideKey): string {
	const suffix = shorthand.replace(/^rounded-?/, "");
	if (suffix === "") return `rounded-${key}`;
	return `rounded-${key}-${suffix}`;
}

/* ── Corner arc icons ───────────────────────────────────── */
const CORNER_ICONS: Record<CornerKey, React.ReactNode> = {
	tl: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M2 11V4.5C2 3.12 3.12 2 4.5 2H11"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	tr: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M10 11V4.5C10 3.12 8.88 2 7.5 2H1"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	bl: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M2 1V7.5C2 8.88 3.12 10 4.5 10H11"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	br: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M10 1V7.5C10 8.88 8.88 10 7.5 10H1"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
};

/* Side icons — each shows which 2 corners are controlled */
const SIDE_ICONS: Record<SideKey, React.ReactNode> = {
	/* t (top): tl-arc + tr-arc joined at top */
	t: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M1 10V4C1 2.34 2.34 1 4 1H8C9.66 1 11 2.34 11 4V10"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	/* r (right): tr-arc + br-arc joined at right */
	r: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M2 1H8C9.66 1 11 2.34 11 4V8C11 9.66 9.66 11 8 11H2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	/* b (bottom): bl-arc + br-arc joined at bottom */
	b: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M1 2V8C1 9.66 2.34 11 4 11H8C9.66 11 11 9.66 11 8V2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	/* l (left): tl-arc + bl-arc joined at left */
	l: (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<path
				d="M10 1H4C2.34 1 1 2.34 1 4V8C1 9.66 2.34 11 4 11H10"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
};

/* ── All-corners toggle icon (border-radius) ───────────── */
function AllCornersIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			aria-hidden
			width="14"
			height="14"
			viewBox="0 0 16 16"
			className={`shrink-0 transition-colors ${expanded ? "text-bv-teal" : "text-bv-muted"}`}
		>
			<path d="M2,5H0V2A2,2,0,0,1,2,0H5V2H2Z" fill="currentColor" />
			<path d="M16,5H14V2H11V0h3a2,2,0,0,1,2,2Z" fill="currentColor" />
			<path d="M5,16H2a2,2,0,0,1-2-2V11H2v3H5Z" fill="currentColor" />
			<path
				d="M14,16H11V14h3V11h2v3A2,2,0,0,1,14,16Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/* ── Settings (sides) icon — preferences/sliders ────────── */
function SidesIcon({ active }: { active: boolean }) {
	return (
		<svg
			aria-hidden
			width="14"
			height="14"
			viewBox="0 0 16 16"
			className={`shrink-0 transition-colors ${active ? "text-bv-teal" : "text-bv-muted"}`}
		>
			<path
				fill="currentColor"
				d="M15,3h-4c-0.6,0-1,0.4-1,1s0.4,1,1,1h4c0.6,0,1-0.4,1-1S15.6,3,15,3z"
			/>
			<path
				fill="currentColor"
				d="M5,1C3.7,1,2.6,1.9,2.2,3C2.1,3,2.1,3,2,3H1C0.4,3,0,3.4,0,4s0.4,1,1,1h1c0.1,0,0.1,0,0.2,0 C2.6,6.1,3.7,7,5,7c1.7,0,3-1.3,3-3S6.7,1,5,1z"
			/>
			<path
				fill="currentColor"
				d="M1,13h4c0.6,0,1-0.4,1-1s-0.4-1-1-1H1c-0.6,0-1,0.4-1,1S0.4,13,1,13z"
			/>
			<path
				fill="currentColor"
				d="M15,11h-1c-0.1,0-0.1,0-0.2,0c-0.4-1.2-1.5-2-2.8-2c-1.7,0-3,1.3-3,3s1.3,3,3,3 c1.3,0,2.4-0.9,2.8-2c0.1,0,0.1,0,0.2,0h1c0.6,0,1-0.4,1-1S15.6,11,15,11z"
			/>
		</svg>
	);
}

/* ── Shorthand icon (all corners equal) ─────────────────── */
function ShorthandIcon() {
	return (
		<svg
			aria-hidden
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="shrink-0 text-bv-muted"
		>
			<rect
				x="1.5"
				y="1.5"
				width="9"
				height="9"
				rx="2.5"
				stroke="currentColor"
				strokeWidth="1.3"
			/>
		</svg>
	);
}

/* ── Slot row — renders icon + MiniScrubber for one slot ── */
interface SlotRowProps {
	slot: CornerSlotData;
	icon: React.ReactNode;
	frozen: boolean;
	/** Inherited value from shorthand (shown dimmer, used as currentValue for scrubber) */
	inheritedValue?: string | null;
	onSlotClick: (slotKey: SlotKey, anchorEl: Element) => void;
	onSlotChange: (slotKey: SlotKey, value: string) => void;
	onSlotHover: (slotKey: SlotKey, value: string | null) => void;
	onSlotRemove?: (slotKey: SlotKey) => void;
	onSlotRemoveHover?: (slotKey: SlotKey) => void;
	onScrubStart: (slotKey: SlotKey) => void;
	onScrubEnd: () => void;
	onOpen: (slotKey: SlotKey) => void;
	onClose: () => void;
	className?: string;
}

function SlotRow({
	slot,
	icon,
	frozen,
	inheritedValue,
	onSlotClick,
	onSlotChange,
	onSlotHover,
	onSlotRemove,
	onSlotRemoveHover,
	onScrubStart,
	onScrubEnd,
	onOpen,
	onClose,
	className = "",
}: SlotRowProps) {
	const hasVal = slot.value != null;
	const effectiveValue = slot.value ?? inheritedValue ?? null;
	const isInherited = !hasVal && inheritedValue != null;

	if (slot.scaleValues && slot.scaleValues.length > 0) {
		return (
			<div className={`cm-slot-row ${className}${isInherited ? " cm-inherited" : ""}`}>
				{icon}
				<MiniScrubber
					placeholder={slot.placeholder}
					values={slot.scaleValues}
					currentValue={effectiveValue}
					displayValue={effectiveValue ? truncateRounded(effectiveValue) : null}
					formatValue={truncateRounded}
					axis="x"
					disabled={frozen}
					onHover={(v) => onSlotHover(slot.key, v)}
					onLeave={() => onSlotHover(slot.key, null)}
					onClick={(v) => onSlotChange(slot.key, v)}
					onScrubStart={() => onScrubStart(slot.key)}
					onScrubEnd={onScrubEnd}
					onOpen={() => onOpen(slot.key)}
					onClose={onClose}
					onRemove={onSlotRemove ? () => onSlotRemove(slot.key) : undefined}
					onRemoveHover={
						onSlotRemoveHover ? () => onSlotRemoveHover(slot.key) : undefined
					}
				/>
			</div>
		);
	}

	return (
		<div className={`cm-slot-row ${className}`}>
			{icon}
			<span
				className={`cm-slot${hasVal ? " cm-has-val" : isInherited ? " cm-inherited" : ""}`}
				role="button"
				tabIndex={frozen ? -1 : 0}
				onClick={
					frozen
						? undefined
						: (e) => onSlotClick(slot.key, e.currentTarget as Element)
				}
			>
				{effectiveValue ? truncateRounded(effectiveValue) : slot.placeholder}
			</span>
		</div>
	);
}

/* ── Main component ─────────────────────────────────────── */
export function CornerModel({
	state,
	frozen = false,
	onSlotClick,
	onSlotChange,
	onSlotHover,
	onSlotRemove,
	onSlotRemoveHover,
	onEditStart,
}: CornerModelProps) {
	const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);

	const slotMap = new Map(state.slots.map((s) => [s.key, s]));

	// Check if any individual corner or side has a value
	const cornerKeys: CornerKey[] = ["tl", "tr", "br", "bl"];
	const sideKeys: SideKey[] = ["t", "r", "b", "l"];
	const hasCornerValues = cornerKeys.some((k) => slotMap.get(k)?.value != null);
	const hasSideValues = sideKeys.some((k) => slotMap.get(k)?.value != null);

	// Auto-expand corners if individual corners or sides are set
	const [cornersExpanded, setCornersExpanded] = useState(
		hasCornerValues || hasSideValues,
	);
	// Auto-expand sides if individual sides are set
	const [sidesExpanded, setSidesExpanded] = useState(hasSideValues);

	const effectiveFrozen = frozen || activeSlot !== null;

	// ── CSS cascade: corner → side → shorthand (most specific wins) ──
	// Which sides affect which corner
	const CORNER_SIDES: Record<CornerKey, [SideKey, SideKey]> = {
		tl: ["t", "l"],
		tr: ["t", "r"],
		bl: ["b", "l"],
		br: ["b", "r"],
	};

	/** Get the inherited value for a corner slot, respecting the CSS cascade:
	 *  1. Side-specific value (e.g. rounded-t-xl overrides shorthand for tl & tr)
	 *  2. Shorthand value (e.g. rounded-lg applies to all corners)
	 *  For side slots, only shorthand applies as inheritance. */
	function getInheritedValue(key: CornerKey | SideKey): string | null {
		if (key === "t" || key === "r" || key === "b" || key === "l") {
			// Side slots only inherit from shorthand
			if (state.shorthandValue == null) return null;
			return deriveFromShorthand(state.shorthandValue, key);
		}
		// Corner slots: check sides first, then shorthand
		const [side1, side2] = CORNER_SIDES[key as CornerKey];
		const sideVal1 = slotMap.get(side1)?.value;
		const sideVal2 = slotMap.get(side2)?.value;
		// If a side has a value, derive the corner class from it
		// (if both sides set, last in CSS wins — pick the first set one for display)
		const sideValue = sideVal1 ?? sideVal2;
		if (sideValue != null) {
			// Extract the suffix from the side class and apply it to this corner
			const suffix = truncateRounded(sideValue);
			if (suffix === "—") return `rounded-${key}`;
			return `rounded-${key}-${suffix}`;
		}
		if (state.shorthandValue == null) return null;
		return deriveFromShorthand(state.shorthandValue, key);
	}

	/** Resolve the effective display value for a corner, respecting the full cascade */
	function resolveCornerDisplay(k: CornerKey): string | null {
		const explicit = slotMap.get(k)?.value;
		if (explicit != null) return truncateRounded(explicit);
		// Check sides
		const [side1, side2] = CORNER_SIDES[k];
		const sideVal = slotMap.get(side1)?.value ?? slotMap.get(side2)?.value;
		if (sideVal != null) return truncateRounded(sideVal);
		// Shorthand
		if (state.shorthandValue != null) return truncateRounded(state.shorthandValue);
		return null;
	}

	// Determine if corners have mixed effective values (including side overrides)
	const cornerEffective = cornerKeys.map(resolveCornerDisplay);
	const hasAnyCornerOrSideValues = hasCornerValues || hasSideValues;
	const isMixed = hasAnyCornerOrSideValues && cornerEffective.some((v) => v !== cornerEffective[0]);

	// Ensure an 'all' slot always exists for the shorthand
	const rawAllSlot: CornerSlotData = slotMap.get("all") ?? {
		key: "all",
		value: state.shorthandValue,
		placeholder: "all",
		scaleValues: state.shorthandScaleValues,
	};

	// Override the display when corners are mixed
	const allSlot: CornerSlotData = isMixed
		? { ...rawAllSlot, value: null, placeholder: "Mixed" }
		: rawAllSlot;

	function getSlot(key: SlotKey): CornerSlotData {
		return (
			slotMap.get(key) ?? {
				key,
				value: null,
				placeholder: key,
				scaleValues: undefined,
			}
		);
	}

	const slotCallbacks = {
		onSlotClick: (k: SlotKey, el: Element) => onSlotClick?.(k, el),
		onSlotChange: (k: SlotKey, v: string) => onSlotChange?.(k, v),
		onSlotHover: (k: SlotKey, v: string | null) => onSlotHover?.(k, v),
		onSlotRemove,
		onSlotRemoveHover,
		onScrubStart: (k: SlotKey) => {
			setActiveSlot(k);
			onEditStart?.();
		},
		onScrubEnd: () => setActiveSlot(null),
		onOpen: (k: SlotKey) => {
			setActiveSlot(k);
			onEditStart?.();
		},
		onClose: () => setActiveSlot(null),
	};

	const rootCls = `cm-root${effectiveFrozen ? " cm-frozen" : ""}${activeSlot ? " cm-active" : ""}`;

	return (
		<div className={rootCls}>
			{/* ── Row 1: Shorthand (all) + expand toggle ──────── */}
			<div className="cm-shorthand-row">
				<SlotRow
					slot={allSlot}
					icon={<ShorthandIcon />}
					frozen={effectiveFrozen}
					className="cm-slot-row-grow"
					{...slotCallbacks}
				/>
				<button
					type="button"
					aria-label={
						cornersExpanded
							? "Collapse individual corners"
							: "Expand individual corners"
					}
					className={`cm-toggle-btn${cornersExpanded ? " cm-toggle-active" : ""}`}
					onClick={() => setCornersExpanded((prev) => !prev)}
				>
					<AllCornersIcon expanded={cornersExpanded} />
				</button>
			</div>

			{/* ── Expanded: Individual corners (2×2 grid) ─────── */}
			{cornersExpanded && (
				<div className="cm-corners-grid">
					{cornerKeys.map((key) => (
						<SlotRow
							key={key}
							slot={getSlot(key)}
							icon={CORNER_ICONS[key]}
							frozen={effectiveFrozen}
							inheritedValue={getInheritedValue(key)}
							{...slotCallbacks}
						/>
					))}

					{/* Sides toggle button — bottom-right of corners grid */}
					<div className="cm-sides-toggle-row">
						<button
							type="button"
							aria-label={
								sidesExpanded ? "Hide side controls" : "Show side controls"
							}
							className={`cm-toggle-btn${sidesExpanded ? " cm-toggle-active" : ""}`}
							onClick={() => setSidesExpanded((prev) => !prev)}
						>
							<SidesIcon active={sidesExpanded} />
						</button>
					</div>
				</div>
			)}

			{/* ── Expanded: Side slots (t/r/b/l) — spatial layout ── */}
			{cornersExpanded && sidesExpanded && (
				<div className="cm-sides-section">
					<div className="cm-sides-label">Sides</div>
					<div className="cm-sides-spatial">
						{/* Top — full width */}
						<div className="cm-side-top">
							<SlotRow
								slot={getSlot("t")}
								icon={SIDE_ICONS.t}
								frozen={effectiveFrozen}
								inheritedValue={getInheritedValue("t")}
								{...slotCallbacks}
							/>
						</div>
						{/* Left + Right — side by side */}
						<div className="cm-side-middle">
							<SlotRow
								slot={getSlot("l")}
								icon={SIDE_ICONS.l}
								frozen={effectiveFrozen}
								inheritedValue={getInheritedValue("l")}
								{...slotCallbacks}
							/>
							<SlotRow
								slot={getSlot("r")}
								icon={SIDE_ICONS.r}
								frozen={effectiveFrozen}
								inheritedValue={getInheritedValue("r")}
								{...slotCallbacks}
							/>
						</div>
						{/* Bottom — full width */}
						<div className="cm-side-bottom">
							<SlotRow
								slot={getSlot("b")}
								icon={SIDE_ICONS.b}
								frozen={effectiveFrozen}
								inheritedValue={getInheritedValue("b")}
								{...slotCallbacks}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
