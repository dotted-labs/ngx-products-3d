import { MeshStandardMaterial } from 'three';
import type { BadgePhysicalMaterialOptions } from '../types';
import { mergeMaterialOptions, tintMetalMaterial } from './badge-material';

const DEFAULTS: BadgePhysicalMaterialOptions = {
	clearcoat: 1,
	clearcoatRoughness: 0.15,
	roughness: 0.3,
	metalness: 0.5,
	iridescence: 0,
	iridescenceIOR: 1,
};

describe('mergeMaterialOptions', () => {
	it('returns the defaults verbatim when no override is provided', () => {
		expect(mergeMaterialOptions(DEFAULTS)).toEqual({
			clearcoat: 1,
			clearcoatRoughness: 0.15,
			roughness: 0.3,
			metalness: 0.5,
			iridescence: 0,
			iridescenceIOR: 1,
		});
	});

	it('applies a partial override field by field, keeping the rest at defaults', () => {
		const merged = mergeMaterialOptions(DEFAULTS, { roughness: 0.9 });

		expect(merged.roughness).toBe(0.9);
		expect(merged.clearcoat).toBe(1);
		expect(merged.clearcoatRoughness).toBe(0.15);
		expect(merged.metalness).toBe(0.5);
		expect(merged.iridescence).toBe(0);
		expect(merged.iridescenceIOR).toBe(1);
	});

	it('lets a full override replace every field', () => {
		const full: BadgePhysicalMaterialOptions = {
			clearcoat: 0.2,
			clearcoatRoughness: 0.4,
			roughness: 0.6,
			metalness: 0.1,
			iridescence: 0.8,
			iridescenceIOR: 1.5,
		};

		expect(mergeMaterialOptions(DEFAULTS, full)).toEqual(full);
	});

	it('treats an explicit 0 override as a value (not a fallback to default)', () => {
		const merged = mergeMaterialOptions(DEFAULTS, { clearcoat: 0 });

		expect(merged.clearcoat).toBe(0);
	});

	it('does not mutate the defaults object (immutable merge)', () => {
		const defaults: BadgePhysicalMaterialOptions = { ...DEFAULTS };

		const merged = mergeMaterialOptions(defaults, { metalness: 0.99 });

		expect(defaults).toEqual(DEFAULTS);
		expect(merged).not.toBe(defaults);
	});
});

describe('tintMetalMaterial', () => {
	it('clones the material and applies the color to the clone without mutating the original', () => {
		const metal = new MeshStandardMaterial({ color: 0xcccccc });

		const tinted = tintMetalMaterial(metal, '#ff0000');

		expect(tinted).not.toBe(metal);
		expect(tinted.color.getHex()).toBe(0xff0000);
		expect(metal.color.getHex()).toBe(0xcccccc);
	});
});
