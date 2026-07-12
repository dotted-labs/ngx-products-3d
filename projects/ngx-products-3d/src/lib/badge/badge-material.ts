import type { MeshStandardMaterial } from 'three';
import type { BadgePhysicalMaterialOptions } from '../types';

/** Merge inmutable de defaults + override parcial (campo a campo; ausente/undefined cae a default). */
export function mergeMaterialOptions(
	defaults: BadgePhysicalMaterialOptions,
	override?: Partial<BadgePhysicalMaterialOptions>,
): BadgePhysicalMaterialOptions {
	return {
		clearcoat: override?.clearcoat ?? defaults.clearcoat,
		clearcoatRoughness: override?.clearcoatRoughness ?? defaults.clearcoatRoughness,
		roughness: override?.roughness ?? defaults.roughness,
		metalness: override?.metalness ?? defaults.metalness,
		iridescence: override?.iridescence ?? defaults.iridescence,
		iridescenceIOR: override?.iridescenceIOR ?? defaults.iridescenceIOR,
	};
}

/** Clona el material metal y lo tiñe con `color` (no muta el original, compartido/cacheado por el GLB). */
export function tintMetalMaterial(
	metal: MeshStandardMaterial,
	color: string,
): MeshStandardMaterial {
	const clone = metal.clone();
	clone.color.set(color);
	return clone;
}
