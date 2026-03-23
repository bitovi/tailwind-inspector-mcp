import { fireEvent, render, screen } from "@testing-library/react";
import { CornerModel } from "./CornerModel";
import type { CornerModelState } from "./types";

const RADIUS_SCALE = [
	"rounded-none",
	"rounded-sm",
	"rounded",
	"rounded-md",
	"rounded-lg",
	"rounded-xl",
	"rounded-2xl",
	"rounded-3xl",
	"rounded-full",
];

function cornerScale(prefix: string) {
	return [
		`${prefix}-none`,
		`${prefix}-sm`,
		prefix,
		`${prefix}-md`,
		`${prefix}-lg`,
		`${prefix}-xl`,
		`${prefix}-2xl`,
		`${prefix}-3xl`,
		`${prefix}-full`,
	];
}

function makeState(
	overrides: Partial<{
		all: string | null;
		tl: string | null;
		tr: string | null;
		br: string | null;
		bl: string | null;
		t: string | null;
		r: string | null;
		b: string | null;
		l: string | null;
	}> = {},
): CornerModelState {
	return {
		shorthandValue: overrides.all ?? null,
		shorthandScaleValues: RADIUS_SCALE,
		slots: [
			{
				key: "all",
				value: overrides.all ?? null,
				placeholder: "all",
				scaleValues: RADIUS_SCALE,
			},
			{
				key: "t",
				value: overrides.t ?? null,
				placeholder: "t",
				scaleValues: cornerScale("rounded-t"),
			},
			{
				key: "r",
				value: overrides.r ?? null,
				placeholder: "r",
				scaleValues: cornerScale("rounded-r"),
			},
			{
				key: "b",
				value: overrides.b ?? null,
				placeholder: "b",
				scaleValues: cornerScale("rounded-b"),
			},
			{
				key: "l",
				value: overrides.l ?? null,
				placeholder: "l",
				scaleValues: cornerScale("rounded-l"),
			},
			{
				key: "tl",
				value: overrides.tl ?? null,
				placeholder: "tl",
				scaleValues: cornerScale("rounded-tl"),
			},
			{
				key: "tr",
				value: overrides.tr ?? null,
				placeholder: "tr",
				scaleValues: cornerScale("rounded-tr"),
			},
			{
				key: "br",
				value: overrides.br ?? null,
				placeholder: "br",
				scaleValues: cornerScale("rounded-br"),
			},
			{
				key: "bl",
				value: overrides.bl ?? null,
				placeholder: "bl",
				scaleValues: cornerScale("rounded-bl"),
			},
		],
	};
}

test("renders the cm-root container", () => {
	const { container } = render(<CornerModel state={makeState()} />);
	expect(container.querySelector(".cm-root")).toBeInTheDocument();
});

test("renders the shorthand row with scrubber", () => {
	const { container } = render(<CornerModel state={makeState()} />);
	expect(container.querySelector(".cm-shorthand-row")).toBeInTheDocument();
});

test("renders the ALL placeholder when no shorthand is set", () => {
	render(<CornerModel state={makeState()} />);
	expect(screen.getByText("all")).toBeInTheDocument();
});

test("displays truncated shorthand value", () => {
	render(<CornerModel state={makeState({ all: "rounded-lg" })} />);
	expect(screen.getByText("lg")).toBeInTheDocument();
});

test("displays bare rounded as em dash", () => {
	render(<CornerModel state={makeState({ all: "rounded" })} />);
	expect(screen.getByText("—")).toBeInTheDocument();
});

test("applies cm-frozen class when frozen prop is true", () => {
	const { container } = render(<CornerModel state={makeState()} frozen />);
	expect(container.querySelector(".cm-root")).toHaveClass("cm-frozen");
});

test("has expand corners toggle button", () => {
	render(<CornerModel state={makeState()} />);
	expect(
		screen.getByLabelText("Expand individual corners"),
	).toBeInTheDocument();
});

test("shows corner slots when expand toggle is clicked", () => {
	render(<CornerModel state={makeState()} />);
	fireEvent.click(screen.getByLabelText("Expand individual corners"));
	expect(screen.getByText("tl")).toBeInTheDocument();
	expect(screen.getByText("tr")).toBeInTheDocument();
	expect(screen.getByText("bl")).toBeInTheDocument();
	expect(screen.getByText("br")).toBeInTheDocument();
});

test("auto-expands when individual corners have values", () => {
	render(<CornerModel state={makeState({ tl: "rounded-tl-xl" })} />);
	expect(screen.getByText("xl")).toBeInTheDocument();
});

test("shows sides toggle when corners are expanded", () => {
	render(<CornerModel state={makeState()} />);
	fireEvent.click(screen.getByLabelText("Expand individual corners"));
	expect(screen.getByLabelText("Show side controls")).toBeInTheDocument();
});

test("shows side slots when sides toggle is clicked", () => {
	render(<CornerModel state={makeState()} />);
	fireEvent.click(screen.getByLabelText("Expand individual corners"));
	fireEvent.click(screen.getByLabelText("Show side controls"));
	expect(screen.getByText("t")).toBeInTheDocument();
	expect(screen.getByText("r")).toBeInTheDocument();
	expect(screen.getByText("b")).toBeInTheDocument();
	expect(screen.getByText("l")).toBeInTheDocument();
});

test("auto-expands sides when side values are set", () => {
	render(<CornerModel state={makeState({ t: "rounded-t-lg" })} />);
	expect(screen.getByText("lg")).toBeInTheDocument();
});

test("corners inherit shorthand value when expanded", () => {
	render(<CornerModel state={makeState({ all: "rounded-lg" })} />);
	fireEvent.click(screen.getByLabelText("Expand individual corners"));
	// Each corner should show "lg" inherited from the shorthand
	const lgElements = screen.getAllByText("lg");
	// 1 for shorthand + 4 for corners = 5
	expect(lgElements.length).toBeGreaterThanOrEqual(5);
});

test("shows Mixed when one corner differs from shorthand", () => {
	render(
		<CornerModel
			state={makeState({ all: "rounded-lg", tl: "rounded-tl-xl" })}
		/>,
	);
	expect(screen.getByText("Mixed")).toBeInTheDocument();
	expect(screen.getByText("xl")).toBeInTheDocument();
});

test("does not show Mixed when no corners differ", () => {
	render(<CornerModel state={makeState({ all: "rounded-lg" })} />);
	fireEvent.click(screen.getByLabelText("Expand individual corners"));
	expect(screen.queryByText("Mixed")).not.toBeInTheDocument();
});

test("calls onSlotClick for the all slot when no scaleValues", () => {
	const state: CornerModelState = {
		shorthandValue: null,
		slots: [{ key: "all", value: null, placeholder: "all" }],
	};
	const onSlotClick = vi.fn();
	render(<CornerModel state={state} onSlotClick={onSlotClick} />);
	screen.getByText("all").click();
	expect(onSlotClick).toHaveBeenCalledWith("all", expect.any(Element));
});

test("does not call onSlotClick when frozen", () => {
	const state: CornerModelState = {
		shorthandValue: null,
		slots: [{ key: "all", value: null, placeholder: "all" }],
	};
	const onSlotClick = vi.fn();
	render(<CornerModel state={state} frozen onSlotClick={onSlotClick} />);
	screen.getByText("all").click();
	expect(onSlotClick).not.toHaveBeenCalled();
});
