import { resourceValueOrUndefined, type ReadableResource } from './resource-value';

function resourceStub<T>(hasValue: boolean, value: () => T): ReadableResource<T> {
	return { hasValue: () => hasValue, value };
}

describe('resourceValueOrUndefined', () => {
	it('returns value() when hasValue() is true (resolved resource)', () => {
		const resource = resourceStub(true, () => 'texture');

		expect(resourceValueOrUndefined(resource)).toBe('texture');
	});

	it('returns undefined when hasValue() is false, without invoking value()', () => {
		let read = false;
		const resource = resourceStub(false, () => {
			read = true;
			return 'texture';
		});

		expect(resourceValueOrUndefined(resource)).toBeUndefined();
		// value() nunca se llama en estado no resuelto → nunca se dispara el throw de un recurso en error.
		expect(read).toBe(false);
	});

	it('never calls the throwing value() when hasValue() is false (error state simulation)', () => {
		const resource = resourceStub(false, () => {
			throw new Error('ResourceValueError');
		});

		expect(() => resourceValueOrUndefined(resource)).not.toThrow();
		expect(resourceValueOrUndefined(resource)).toBeUndefined();
	});
});
