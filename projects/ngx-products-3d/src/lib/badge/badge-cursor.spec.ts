import { cursorFor } from './badge-cursor';

describe('cursorFor', () => {
	it("returns 'grabbing' while dragging, regardless of hover (drag takes priority)", () => {
		expect(cursorFor(true, false)).toBe('grabbing');
		expect(cursorFor(true, true)).toBe('grabbing');
	});

	it("returns 'grab' when hovered but not dragging", () => {
		expect(cursorFor(false, true)).toBe('grab');
	});

	it("returns 'auto' at rest (neither dragging nor hovered)", () => {
		expect(cursorFor(false, false)).toBe('auto');
	});
});
