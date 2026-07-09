import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
	NgtrPhysics,
	type NgtrRigidBodyOptions,
	type NgtrRopeJointParams,
	type NgtrSphericalJointParams,
} from 'angular-three-rapier';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadgeScene } from './badge-scene.component';
import { BADGE_CARD_PLACEHOLDER, BADGE_LAYOUT, BADGE_PHYSICS } from './badge.config';

interface SceneInternals {
	cardBodyType: () => string;
	layout: typeof BADGE_LAYOUT;
	placeholder: typeof BADGE_CARD_PLACEHOLDER;
	bodyOptions: Partial<NgtrRigidBodyOptions>;
	segmentColliderArgs: [number];
	cardColliderArgs: [number, number, number];
	cardPlaneArgs: [number, number];
	segmentJointData: NgtrRopeJointParams;
	cardJointData: NgtrSphericalJointParams;
}

const MEMBER: BadgeMemberData = {
	name: 'Ada Lovelace',
	memberNumber: '0042',
	tier: 'gold',
};

const THEME: Products3dBadgeTheme = {
	bandTextureUrl: 'assets/band.png',
	baseTextures: { gold: 'assets/gold.png' },
	defaultBaseTextureUrl: 'assets/default.png',
	fontUrl: 'assets/font.json',
};

// Mock mínimo de NgtrPhysics para los hooks de joints (ropeJoint/sphericalJoint):
// con worldSingleton/rapier a null los joints quedan en espera y nunca tocan Rapier.
// La escena real (bodies, colliders, joints activos) se verifica en playground (Nivel 3):
// montar el template ngt-* en jsdom sin WebGL no es viable ni deseable (verification.md).
const PHYSICS_MOCK = {
	worldSingleton: () => null,
	rapier: () => null,
};

function createScene(): ComponentFixture<Products3dBadgeScene> {
	TestBed.configureTestingModule({
		providers: [{ provide: NgtrPhysics, useValue: PHYSICS_MOCK }],
	});
	// Template vacío: se testea la derivación de estado desde badge.config,
	// no el render 3D (requiere canvas + WebGL reales).
	TestBed.overrideComponent(Products3dBadgeScene, { set: { template: '' } });
	const fixture = TestBed.createComponent(Products3dBadgeScene);
	fixture.componentRef.setInput('member', MEMBER);
	fixture.componentRef.setInput('theme', THEME);
	return fixture;
}

function internalsOf(fixture: ComponentFixture<Products3dBadgeScene>): SceneInternals {
	// Campos protected/private (solo template/joints); narrow tipado para test
	return fixture.componentInstance as unknown as SceneInternals;
}

describe('Products3dBadgeScene', () => {
	it("defaults cardBodyType to 'dynamic' (kinematicPosition switch belongs to the drag feature)", () => {
		const fixture = createScene();

		expect(internalsOf(fixture).cardBodyType()).toBe('dynamic');
	});

	it('derives rigid body options from BADGE_PHYSICS with auto-colliders disabled', () => {
		const fixture = createScene();

		expect(internalsOf(fixture).bodyOptions).toEqual({
			colliders: false,
			angularDamping: BADGE_PHYSICS.angularDamping,
			linearDamping: BADGE_PHYSICS.linearDamping,
		});
	});

	it('builds rope joint data from BADGE_PHYSICS: local anchors and segmentLength', () => {
		const fixture = createScene();
		const jointData = internalsOf(fixture).segmentJointData;

		expect(jointData.body1Anchor).toBe(BADGE_PHYSICS.segmentJointAnchor);
		expect(jointData.body2Anchor).toBe(BADGE_PHYSICS.segmentJointAnchor);
		expect(jointData.length).toBe(BADGE_PHYSICS.segmentLength);
	});

	it('anchors the spherical joint at the card top edge (BADGE_PHYSICS.cardJointAnchor)', () => {
		const fixture = createScene();
		const jointData = internalsOf(fixture).cardJointData;

		expect(jointData.body1Anchor).toBe(BADGE_PHYSICS.segmentJointAnchor);
		expect(jointData.body2Anchor).toBe(BADGE_PHYSICS.cardJointAnchor);
	});

	it('derives collider args from BADGE_PHYSICS: ball radius and cuboid half-extents', () => {
		const fixture = createScene();
		const internals = internalsOf(fixture);

		expect(internals.segmentColliderArgs).toEqual([BADGE_PHYSICS.segmentColliderRadius]);
		expect(internals.cardColliderArgs).toBe(BADGE_PHYSICS.cardColliderHalfExtents);
	});

	it('takes body positions and card placeholder values from badge.config', () => {
		const fixture = createScene();
		const internals = internalsOf(fixture);

		expect(internals.layout).toBe(BADGE_LAYOUT);
		expect(internals.placeholder).toBe(BADGE_CARD_PLACEHOLDER);
		expect(internals.cardPlaneArgs).toBe(BADGE_CARD_PLACEHOLDER.planeSize);
	});
});
