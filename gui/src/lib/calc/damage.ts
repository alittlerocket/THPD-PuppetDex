/**
 * TPDP damage engine.
 *
 * A faithful port of damage.js from tpdpextcalc
 * (https://github.com/Gengetsu12/tpdpextcalc), itself derived from the
 * Pokemon Showdown damage calculator.
 * MIT -- Copyright (c) 2013-2018 Honko and other contributors.
 *
 * Deliberately transliterated rather than rewritten: the conditionals, ordering
 * and rounding are load-bearing, and the structure is kept close to the source
 * so it can be diffed against upstream. The two jQuery lookups in the original
 * (`$('#StatBoostL')`) are parameters here instead. Comments marked TODO are
 * the original author's open questions about game mechanics, kept for context.
 */

import { FA, FD, SA, SD, SP, MARKS, STATS_ALL } from './types';
import type {
	Description,
	DamageResult,
	Field,
	Move,
	Puppet,
	StatKey,
} from './types';
import { getItemType, isItemCharm } from './items';

/**
 * Type effectiveness chart, injected from the database at startup rather than
 * bundled: the app keeps a single source of truth in puppetdex.db.
 */
let TYPE_CHART: Record<string, Record<string, number>> | null = null;

export function setTypeChart(
	chart: Record<string, Record<string, number>>,
): void {
	TYPE_CHART = chart;
}

function chart(): Record<string, Record<string, number>> {
	if (!TYPE_CHART) {
		throw new Error(
			'Type chart not loaded — call setTypeChart() before calculating damage.',
		);
	}
	return TYPE_CHART;
}

/** Game version: 8 = Shard of Dreams Extended (the default), 5 = base SoD. */
export interface CalcOptions {
	gen?: number;
	ironWill?: boolean;
}

export function getDamageResult(
	attacker: Puppet,
	defender: Puppet,
	move: Move,
	field: Field,
	options: CalcOptions = {},
): DamageResult {
	const gen = options.gen ?? 8;
	const ironWill = options.ironWill ?? false;

	const description: Description = {
		attackerName: attacker.name,
		moveName: move.name,
		defenderName: defender.name,
	};

	// 0 damage
	if (move.bp === 0) {
		return { damage: [0], description: buildDescription(description) };
	}
	if (field.isProtected && !move.bypassesProtect) {
		description.isProtected = true;
		return { damage: [0], description: buildDescription(description) };
	}

	// Ability acquisition/nullification
	let atkAbility = attacker.ability;
	let defAbility = defender.ability;
	let atkYoumaMod = '';
	let defYoumaMod = '';
	if (
		attacker.ability === 'Bibliophilia' &&
		attacker.name === 'Extra Kosuzu' &&
		attacker.item.indexOf('Youma Scroll: ') !== -1
	) {
		atkYoumaMod = attacker.item.substr(14);
		atkAbility =
			atkYoumaMod === 'Red'
				? 'Imposing Stance'
				: atkYoumaMod === 'Blue'
					? 'Known Limits'
					: atkYoumaMod === 'Black'
						? 'Unbound'
						: atkYoumaMod === 'White'
							? 'Wariness'
							: 'Bibliophilia';
		description.attackerAbility = 'Bibliophilia (' + atkYoumaMod + ')';
	}
	if (
		defender.ability === 'Bibliophilia' &&
		defender.name === 'Extra Kosuzu' &&
		defender.item.indexOf('Youma Scroll: ') !== -1
	) {
		defYoumaMod = defender.item.substr(14);
		defAbility =
			defYoumaMod === 'Red'
				? 'Imposing Stance'
				: defYoumaMod === 'Blue'
					? 'Known Limits'
					: defYoumaMod === 'Black'
						? 'Unbound'
						: defYoumaMod === 'White'
							? 'Wariness'
							: 'Bibliophilia';
		description.defenderAbility = 'Bibliophilia (' + defYoumaMod + ')';
	}
	if (defAbility === 'Invalidate') {
		// Invalidate has higher priority since it's considered activated on switching in
		atkAbility = '';
		description.defenderAbility = defAbility;
	}
	if (
		['Drunkard', 'Unbound', 'Brute Force', 'Invalidate'].indexOf(
			atkAbility,
		) !== -1 ||
		field.terrain === 'Kohryu'
	) {
		defAbility = '';
		if (atkYoumaMod === '' && field.terrain !== 'Kohryu') {
			description.attackerAbility = atkAbility;
		}
	}

	// Auto-crit flag
	const isCritical = !!(
		move.isCrit &&
		defAbility !== 'Indomitable' &&
		defender.item !== 'Dragon Amulet' &&
		move.usedTimes === 1
	);

	// Weather/Terrain-based type modification
	if (
		move.name === 'Heavenly Blessing' ||
		move.name === 'Heavenly Influence'
	) {
		move.type =
			field.weather === 'Calm'
				? 'Wind'
				: field.weather === 'Aurora'
					? 'Light'
					: field.weather === 'Heavy Fog'
						? 'Dark'
						: field.weather === 'Dust Storm'
							? 'Earth'
							: field.weather === 'Sunshower'
								? 'Warped'
								: 'Void';
		description.weather = field.weather;
		description.moveType = move.type;
	} else if (
		move.name === 'Earthly Blessing' ||
		move.name === 'Earthly Influence'
	) {
		move.type =
			field.terrain === 'Suzaku'
				? 'Fire'
				: field.terrain === 'Genbu'
					? 'Water'
					: field.terrain === 'Seiryu'
						? 'Nature'
						: field.terrain === 'Kohryu'
							? 'Earth'
							: field.terrain === 'Byakko'
								? 'Steel'
								: 'Void';
		description.terrain = field.terrain;
		description.moveType = move.type;
	}

	// Form ability handler
	const formCheck = [
		'Stream Form',
		'Natural Form',
		'Unyielding Form',
		'Gale Form',
		'Bright Form',
		'Midnight Form',
		'Ghost Form',
		'Desolation Form',
		"General's Form",
	].indexOf(atkAbility);
	if (formCheck !== -1 && move.type === 'Void') {
		move.type = [
			'Water',
			'Nature',
			'Steel',
			'Wind',
			'Light',
			'Dark',
			'Nether',
			'Earth',
			'Fighting',
		][formCheck];
	}

	// Flat Speed correction
	if (
		[atkAbility, defender.ability].indexOf('Flat Speed') !== -1 &&
		move.hasPriority
	) {
		move.hasPriority = false;
		if (atkAbility === 'Flat Speed') {
			description.attackerAbility = atkAbility;
		} else {
			description.defenderAbility = defender.ability;
		}
	}

	// Type Effectiveness Calculation
	const noCommonSense =
		atkAbility === 'Common Senseless' ||
		(atkAbility === 'Eastern Expanse' && field.terrain === 'Seiryu');
	const typeEffect1 = getMoveEffectiveness(
		move,
		defender.type1,
		noCommonSense,
	);
	const typeEffect2 = defender.type2
		? getMoveEffectiveness(move, defender.type2, noCommonSense)
		: 1;
	let typeEffectiveness = typeEffect1 * typeEffect2;
	if (noCommonSense) {
		description.attackerAbility = atkAbility;
	}

	// Cursed Doll Handling
	if (defender.item === 'Cursed Doll' && typeEffectiveness === 0) {
		if (chart()[move.type][defender.type1] === 0) {
			typeEffectiveness =
				chart()[move.type][defender.type2 as string] === 0
					? 1
					: typeEffect2;
		} else if (chart()[move.type][defender.type2 as string] === 0) {
			typeEffectiveness = typeEffect1;
		}
	}

	// Crystal Mirror Handling
	if (
		attacker.item === 'Crystal Mirror' &&
		field.terrain === 'Byakko' &&
		typeEffectiveness === 0
	) {
		typeEffectiveness = 1;
		description.attackerItem = attacker.item;
	}

	// Immunity Handling
	if (typeEffectiveness === 0) {
		return { damage: [0], description: buildDescription(description) };
	}
	if (field.isGhost && move.type === 'Fighting') {
		description.defenderGhost = true;
		return { damage: [0], description: buildDescription(description) };
	}
	if (move.type === 'Earth' && defender.item === 'Floating Stone') {
		description.defenderItem = defender.item;
		return { damage: [0], description: buildDescription(description) };
	}
	// Reverse effectiveness, Seiryu handling
	if (field.terrain === 'Seiryu') {
		typeEffectiveness = 1;
	} else if (typeEffectiveness !== 1) {
		if (field.isReversed) {
			typeEffectiveness = 1 / typeEffectiveness;
			description.defenderReversed = true;
		}
		if (defAbility === 'Affinity Twist') {
			typeEffectiveness = 1 / typeEffectiveness;
			description.defenderAbility = defAbility;
		}
	}
	const whenHitByA: Record<string, string> = {
		// There's one for almost every type
		'Cloak of Darkness': 'Dark',
		'Benefit of Fire': 'Fire',
		'Grace of Water': 'Water',
		'Force of Nature': 'Nature',
		'Air Cushion': 'Earth',
		Metallurgy: 'Steel',
		'Smooth Sailing': 'Wind',
		Electromagnetic: 'Electric',
		Absorbent: 'Light',
		'Negative Aura': 'Dark',
		'Appeased Spirit': 'Nether',
		'Strict Dosage': 'Poison',
		"Master's Defense": 'Fighting',
		'Unwavering Heart': 'Illusion',
		'Sound Absorb': 'Sound',
		'In Sync': 'Warped',
	};
	if (
		(defAbility === 'Frail Health' &&
			typeEffectiveness <= 1 &&
			!(move.type === 'Dream')) ||
		(whenHitByA[defAbility] && move.type === whenHitByA[defAbility]) ||
		(move.hasPriority && defAbility === 'Intuition') ||
		(move.willCharge && defAbility === 'Restraint') ||
		(move.bp <= 50 && defAbility === 'Wariness')
	) {
		description.defenderAbility = defAbility;
		return { damage: [0], description: buildDescription(description) };
	}

	description.HPPP = defender.HPPP + ' HP';

	// Fixed damage moves
	if (['Charon Ferries', 'Aikido Arts'].indexOf(move.name) !== -1) {
		let lv = attacker.level;
		if (atkAbility === 'Two of a Kind') {
			lv *= 2;
			description.attackerAbility = atkAbility;
		}
		return { damage: [lv], description: buildDescription(description) };
	}
	if (move.name === 'Divine Punishment') {
		return {
			damage: [attacker.curHP],
			description: buildDescription(description),
		};
	}
	if (move.name === 'Prank') {
		const lostHP = field.isProtected
			? 0
			: Math.floor(defender.curHP / 2) +
				(atkAbility === 'Two of a Kind'
					? Math.floor(Math.ceil(defender.curHP / 2) / 2)
					: 0);
		if (atkAbility === 'Two of a Kind') {
			description.attackerAbility = atkAbility;
		}
		return { damage: [lostHP], description: buildDescription(description) };
	}

	// Two of a Kind flag
	let doppelganger = false;
	if (atkAbility === 'Two of a Kind' && move.hits === 1) {
		doppelganger = true;
		move.hits = 2;
		description.attackerAbility = atkAbility;
	}

	if (move.hits > 1) {
		description.hits = move.hits;
	}

	// Turn order (First Hit / After Move parsing)
	let turnOrder = attacker.stats[SP] > defender.stats[SP] ? 'FIRST' : 'LAST';
	turnOrder = (
		attacker.item === 'Heavy Armor'
			? defender.item === 'Heavy Armor'
			: defender.item !== 'Heavy Armor'
	)
		? turnOrder
		: move.hasPriority || defender.item === 'Heavy Armor'
			? 'FIRST'
			: 'LAST';

	// Damage Formula is as follows:
	// (([Attacker Level]*0.4 + 2) * [Attacking Stat]*[Atk Modifiers] * [Base Power]*[BP Modifiers] / ([Defense Stat]*[Def Modifiers]) / 50) + 2 = A
	// DMG = A * [Critical Hit] * [RNG] * [Effectiveness] * [STAB] * [Weather] * [Items] * [Abilities] * [Screens]
	// Where oper1*oper2 is Math.floor(oper1*oper2)

	/////////////////////////////////////////
	////////// Focus/Spread Attack //////////
	/////////////////////////////////////////

	// Revolving Illusions / Take Over handler
	let attack: number;
	const attackSource = move.isFoul === true ? defender : attacker;
	const attackStat: StatKey = move.category === 'Focus' ? FA : SA;

	description.attackPP =
		attacker.pp[attackStat] +
		(MARKS[attacker.mark] === attackStat ? '+' : '') +
		' ' +
		toTPDPStat(attackStat);
	if (
		attackSource.boosts[attackStat] === 0 ||
		(isCritical && attackSource.boosts[attackStat] < 0)
	) {
		attack = attackSource.rawStats[attackStat];
	} else if (defAbility === 'Wisdom Eye') {
		attack = attackSource.rawStats[attackStat];
		description.defenderAbility = defAbility;
	} else {
		attack = attackSource.stats[attackStat];
		description.attackBoost = attackSource.boosts[attackStat];
	}

	// Attack Modifiers
	// TODO: Do attack abilities apply in the BP step or the attack calculation step? Assume attack for now
	const atMods: number[] = [];

	// Ability-related
	if (
		(atkAbility === 'Miracle Mallet' && move.category === 'Focus') || // Double
		(atkAbility === 'Boundary Blurrer' && field.weather !== '')
	) {
		atMods.push(2);
		description.attackerAbility = atkAbility;
	} else if (
		(atkAbility === 'Surprise Tactics' &&
			field.weather === 'Heavy Fog' &&
			move.category === 'Spread') || // 50% Increase
		(atkAbility === 'Recalibration' &&
			field.weather === 'Calm' &&
			move.category === 'Spread') ||
		(atkAbility === 'Desperation' &&
			attacker.status.indexOf('Poisoned') !== -1 &&
			move.category === 'Focus') ||
		(atkAbility === "Mind's Eye" &&
			!(attacker.status[0] === 'None' && attacker.status[1] === 'None') &&
			move.category === 'Focus') ||
		(atkAbility === 'Brutality' && move.category === 'Spread') ||
		(atkAbility === 'Daredevil' && move.category === 'Focus') ||
		(atkAbility === 'Pride' &&
			!(attacker.status[0] === 'None' && attacker.status[1] === 'None') &&
			move.category === 'Spread')
	) {
		atMods.push(1.5);
		description.attackerAbility = atkAbility;
	} else if (
		(atkAbility === 'Sand Force' &&
			field.weather === 'Dust Storm' &&
			move.category === 'Focus') || // 30% Increase
		(atkAbility === 'Strange Rainbow' &&
			field.weather === 'Sunshower' &&
			move.category === 'Focus')
	) {
		atMods.push(1.3);
		description.attackerAbility = atkAbility;
	} else if (
		(atkAbility === 'True Admin' && attacker.curHP <= attacker.maxHP / 2) || // Half
		(atkAbility === 'Placid' && move.category === 'Spread')
	) {
		atMods.push(0.5);
		description.attackerAbility = atkAbility;
	}

	// Status-related
	if (
		attacker.status.indexOf('Blinded') !== -1 &&
		move.category === 'Focus' &&
		atkAbility !== "Mind's Eye"
	) {
		atMods.push(0.5);
		description.isBlinded = true;
	} else if (
		attacker.status.indexOf('Afraid') !== -1 &&
		move.category === 'Spread' &&
		atkAbility !== 'Pride'
	) {
		atMods.push(0.5);
		description.isAfraid = true;
	}

	// Item-related(?)
	if (
		(atkYoumaMod === 'Red' && move.category === 'Focus') ||
		(atkYoumaMod === 'Black' && move.category === 'Spread')
	) {
		atMods.push(2);
	}

	attack = Math.max(1, chainMods(attack, atMods));

	let basePower: number;

	// Knock Off-esque effect nullification
	const resistedKnockOffDamage =
		defender.item === '' ||
		defender.item.indexOf('Youma Scroll: ') !== -1 ||
		defender.item === 'Hope Mask' ||
		defender.item === 'Dream Shard' ||
		defender.item === 'Boundary Trance';

	switch (move.name) {
		/**
		 * Wiki gives:
		 * Power = (40 x foe Speed / user Speed) + 1, capped at 150
		 * but tpdpextcalc omits the +1, making every result 1 BP low.
		 * See https://tpdp.miraheze.org/wiki/Impact_Rebellion
		*/
		case 'Impact Rebellion':
			basePower = !(attacker.stats[SP] > 0)
				? 150
				: Math.min(
						150,
						Math.floor(
							(40 * defender.stats[SP]) / attacker.stats[SP],
						) + 1,
					);
			description.moveBP = basePower;
			break;
		case 'Tumble Plant':
		case 'Clearing Mist':
		case 'Mountain Breaker':
			basePower = Math.min(120, Math.max(40, defender.cost * 2 - 120));
			description.moveBP = basePower;
			break;
		case 'Blow from Calamity':
			basePower = move.bp * 2; // original compares an array to an array literal, which is always true
			description.moveBP = basePower;
			break;
		case 'Love or Pain':
			basePower = move.bp * 2; // as above
			description.moveBP = basePower;
			break;
		case 'Final Tribulation':
			basePower = Math.floor(
				move.bp * (attacker.hasType('Void') ? 1.3 : 1),
			);
			description.moveBP = basePower;
			break;
		case 'Mysterious Liquid':
			basePower =
				move.bp * (defender.status.indexOf('Poisoned') !== -1 ? 2 : 1);
			description.moveBP = basePower;
			break;
		case 'Fire Wall':
		case 'Panic Call':
		case "St. Elmo's Fire":
			// NOTE: in the main games this would be 97.5, but the floor in the damage formula makes it 97.
			basePower = Math.floor(
				move.bp * (!resistedKnockOffDamage ? 1.5 : 1),
			);
			description.moveBP = basePower;
			break;
		case 'Conflagration': {
			const dc = attacker.cost - defender.cost;
			basePower = Math.min(120, Math.max(60, Math.floor(60 + dc * 1.5)));
			description.moveBP = basePower;
			break;
		}
		case 'Infinite Scales':
			basePower = move.bp + 20 * countBoosts(attacker.boosts);
			description.moveBP = basePower;
			break;
		case 'Miracle Reprisal':
			basePower = move.bp + 20 * countBoosts(defender.boosts);
			description.moveBP = basePower;
			break;
		case 'Unfettered Soul':
			basePower =
				move.bp *
				(attacker.item === 'Sugilite' || !attacker.item ? 2 : 1);
			description.moveBP = basePower;
			break;
		case 'Heavenly Blessing':
		case 'Heavenly Influence':
		case 'Passing Breeze':
		case 'Sunbeam Dance': // TODO: Verify if this is a BP modification or a final damage modification
			basePower = move.bp * (field.weather !== '' ? 2 : 1);
			description.moveBP = basePower;
			break;
		case 'Earthly Blessing':
		case 'Earthly Influence':
		case 'Destruction Rift':
		case 'Lost Crisis': // TODO: Verify if this is a BP modification or a final damage modification
			basePower = move.bp * (field.terrain !== '' ? 2 : 1);
			description.moveBP = basePower;
			break;
		case 'Phoenix Waltz':
		case 'Aqua Cannon': {
			const hpRat = attacker.curHP / attacker.maxHP;
			basePower =
				hpRat === 1 ? 150 : Math.max(1, Math.floor(hpRat * 100));
			description.moveBP = basePower;
			break;
		}
		case 'Landslide':
			basePower =
				move.bp * (defender.curHP <= defender.maxHP / 2 ? 2 : 1);
			description.moveBP = basePower;
			break;
		case 'Death Match':
		case 'Dire State': {
			const p = Math.floor((48 * attacker.curHP) / attacker.maxHP);
			basePower =
				attacker.curHP === 1 || p < 2
					? 200
					: p < 5
						? 150
						: p < 10
							? 100
							: p < 17
								? 80
								: p < 33
									? 40
									: 20;
			description.moveBP = basePower;
			break;
		}
		case 'Dark Sphere':
			basePower = move.bp * (field.isCamo ? 2 : 1);
			description.moveBP = basePower;
			break;
		case 'Gravity Blast': {
			const hpRat = defender.curHP / defender.maxHP;
			basePower = hpRat === 1 ? 120 : Math.max(1, Math.floor(hpRat * 80));
			description.moveBP = basePower;
			break;
		}
		case 'Blitzkrieg':
			if (turnOrder === 'FIRST') {
				basePower = move.bp * 2;
				description.moveBP = basePower;
			} else {
				basePower = move.bp;
				description.moveBP = basePower;
			}
			break;
		case 'Rainbow Flowers':
			if (field.weather === '') {
				basePower = move.bp;
				break;
			}
			basePower = move.bp * (field.weather !== 'Aurora' ? 0.5 : 1);
			description.moveBP = basePower;
			break;
		case 'Dense Fog Bloom':
			if (field.weather === '') {
				basePower = move.bp;
				break;
			}
			basePower = move.bp * (field.weather !== 'Heavy Fog' ? 0.5 : 1);
			description.moveBP = basePower;
			break;
		default:
			basePower = move.bp;
	}


	let defense: number;
	let defenseStat: StatKey = move.defenseStat
		? move.defenseStat
		: move.category === 'Focus'
			? FD
			: SD;
	if (field.weather === 'Sunshower') {
		defenseStat = defenseStat === FD ? SD : FD;
		description.weather = field.weather;
	}
	description.defensePP =
		defender.pp[defenseStat] +
		(MARKS[defender.mark] === defenseStat ? '+' : '') +
		' ' +
		toTPDPStat(defenseStat);
	if (
		defender.boosts[defenseStat] === 0 ||
		(isCritical && defender.boosts[defenseStat] > 0) ||
		move.ignoresDefenseBoosts
	) {
		defense = defender.rawStats[defenseStat];
	} else if (
		attacker.ability === 'Wisdom Eye' ||
		(attacker.ability === 'Central Expanse' && field.terrain === 'Kohryu')
	) {
		defense = defender.rawStats[defenseStat];
		description.attackerAbility = attacker.ability;
	} else {
		defense = defender.stats[defenseStat];
		description.defenseBoost = defender.boosts[defenseStat];
	}

	const dfMods: number[] = [];

	// Explosion handling
	if (move.name === 'Whole Being' || move.name === 'Final Tribulation') {
		dfMods.push(0.5);
	}

	// Ability handling
	if (
		(defAbility === 'Miracle Mallet' && defenseStat === FD) ||
		(defAbility === 'Boundary Blurrer' && field.weather !== '') ||
		(defAbility === 'Boundary Savior' && field.terrain !== '')
	) {
		// Double
		dfMods.push(2);
		description.defenderAbility = defAbility;
	} else if (
		(defAbility === 'Aurora Grace' &&
			field.weather === 'Aurora' &&
			defenseStat === SD) ||
		(defAbility === 'Recalibration' &&
			field.weather === 'Calm' &&
			defenseStat === SD) ||
		(defAbility === 'Breather' &&
			field.weather === 'Calm' &&
			defenseStat === FD) ||
		(defAbility === 'Last Defense' && defenseStat === FD)
	) {
		// original compares array to literal: always true
		dfMods.push(1.5);
		description.defenderAbility = defAbility;
	}

	// Item handling
	if (
		(defYoumaMod === 'Blue' && defenseStat === FD) ||
		(defYoumaMod === 'White' && defenseStat === SD)
	) {
		dfMods.push(2);
	}

	defense = Math.max(1, chainMods(defense, dfMods));

	
	let baseDamage = getBaseDamage(attacker.level, basePower, attack, defense);

	// Since RNG comes 3rd in this equation, we can only really apply the crit factor first
	if (isCritical) {
		baseDamage = Math.floor(
			baseDamage * (atkAbility === 'Sniper' ? 2.25 : 1.5),
		);
		description.isCritical = isCritical;
	}

	// Already prepared effectiveness
	const finalMods: number[] = [typeEffectiveness];

	// Prepare STAB
	let isSTAB = attacker.hasType(move.type);
	let stabMod = 1;
	if (atkAbility === 'Infinite Changes') {
		// Infinite Changes will always have STAB
		isSTAB = true;
		description.attackerAbility = atkAbility;
	}
	if (isSTAB) {
		if (
			atkAbility === 'Niche' ||
			(atkAbility === 'Eastern Expanse' && field.terrain === 'Seiryu')
		) {
			stabMod = 2;
			description.attackerAbility = atkAbility;
		} else {
			stabMod = 1.5;
		}
	}
	finalMods.push(stabMod);

	// Prepare Weather
	let weatherMod = 1;
	if (
		(field.weather === 'Aurora' && move.type === 'Light') ||
		(field.weather === 'Heavy Fog' && move.type === 'Dark')
	) {
		weatherMod = 1.5;
		description.weather = field.weather;
	} else if (
		(field.weather === 'Aurora' && move.type === 'Dark') ||
		(field.weather === 'Heavy Fog' && move.type === 'Light')
	) {
		weatherMod = 0.5;
		description.weather = field.weather;
	}
	finalMods.push(weatherMod);

	// Prepare Item modifications (besides ones that explicitly modify stats)
	let atkItem = '',
		atkItemType = 'None';
	let defItem = '';
	if (
		field.terrain !== 'Kohryu' ||
		(field.terrain === 'Kohryu' && attacker.item === 'Boundary Trance') ||
		atkAbility === 'Central Expanse'
	) {
		atkItem = attacker.item;
		atkItemType = getItemType(atkItem);
		if (field.terrain === 'Kohryu') {
			description.attackerAbility = atkAbility;
		}
	}
	if (
		field.terrain !== 'Kohryu' ||
		(field.terrain === 'Kohryu' && defender.item === 'Boundary Trance') ||
		defAbility === 'Central Expanse'
	) {
		defItem = defender.item;
		getItemType(defItem);
		if (field.terrain === 'Kohryu') {
			description.defenderAbility = defAbility;
		}
	}

	// Offense Items
	if (move.type === atkItemType && atkItem.indexOf('Charm') === -1) {
		// Type-based boosting item
		if (atkItem.indexOf('Hairpin') === -1) {
			finalMods.push(1.4); // might be 1.3?
		} else {
			finalMods.push(1.2); // might be 1.1?
		}
		description.attackerItem = atkItem;
	} else if (
		(atkItem === 'Choice Ring' && move.category === 'Focus') ||
		(atkItem === 'Choice Earrings' && move.category === 'Spread') ||
		(atkItem === 'Yggdrasil Seed' && field.terrain === 'Seiryu')
	) {
		finalMods.push(1.5);
		description.attackerItem = attacker.item;
	} else if (
		atkItem === 'Radiant Hairpin' &&
		attacker.curHP / attacker.maxHP === 1 &&
		gen === 8
	) {
		finalMods.push(1.4);
		description.attackerItem = attacker.item;
	} else if (
		atkItem === 'Straw Doll' ||
		(atkItem === 'Radiant Hairpin' &&
			attacker.curHP / attacker.maxHP === 1 &&
			gen !== 8) ||
		(atkItem === 'Tsuzumi Drum' && !isSTAB)
	) {
		finalMods.push(1.3);
		description.attackerItem = atkItem;
	} else if (
		(atkItem === 'Javelin Arts' && move.isJavelin === true) ||
		(atkItem === 'Deadly Secrets' && typeEffectiveness > 1)
	) {
		finalMods.push(1.2);
		description.attackerItem = atkItem;
	} else if (
		(atkItem === 'Red Ring' && move.category === 'Focus') ||
		(atkItem === 'Blue Earrings' && move.category === 'Spread') ||
		atkItem === 'Dream Shard'
	) {
		finalMods.push(1.1);
		description.attackerItem = attacker.item;
	} else if (
		atkItem === 'Radiant Hairpin' &&
		attacker.curHP / attacker.maxHP !== 1
	) {
		const percentMaxHealth = attacker.curHP / attacker.maxHP;
		finalMods.push(percentMaxHealth * 0.2 + 1);
		description.attackerItem = attacker.item;
	} else if (atkItem === 'Boundary Trance') {
		finalMods.push(2.0);
		description.attackerItem = attacker.item;
	}

	// Defense Items
	const itemType = getItemType(defender.item);
	const itemCharm = isItemCharm(defender.item);
	if (move.type === itemType && itemCharm === 1) {
		// Type-based charm item
		finalMods.push(0.5);
		description.defenderItem = defItem;
	} else if (
		((defender.item === 'Golden Hairpin' && defenseStat === FD) ||
			(defender.item === 'Silver Hairpin' && defenseStat === SD)) &&
		!(field.weather === 'Sunshower')
	) {
		finalMods.push(2 / 3);
		description.defenderItem = defender.item;
	} else if (
		((defender.item === 'Golden Hairpin' && defenseStat === SD) ||
			(defender.item === 'Silver Hairpin' && defenseStat === FD)) &&
		field.weather === 'Sunshower'
	) {
		finalMods.push(2 / 3);
		description.defenderItem = defender.item;
	} else if (defender.item === 'Iron Will Ribbon' && ironWill) {
		finalMods.push(0.9);
		description.defenderItem = defender.item;
	} else if (defender.item === 'Dream Shard') {
		finalMods.push(10 / 11);
		description.defenderItem = defender.item;
	} else if (defender.item === 'Large Shield' && typeEffectiveness !== 1) {
		// Large Shield halves resisted hits, but doubles super-effective ones
		finalMods.push(typeEffectiveness < 1 ? 0.5 : 2);
		description.defenderItem = defender.item;
	} else if (
		defender.item === 'Yggdrasil Seed' &&
		field.terrain === 'Seiryu'
	) {
		finalMods.push(1.5);
		description.defenderItem = defender.item;
	} else if (defender.item === 'Boundary Trance') {
		finalMods.push(0.5);
		description.defenderItem = defItem;
	}

	// Prepare Ability modifications (INCLUDING ones that make moves more "powerful")
	// Offense-related abilities
	let pendingMod = 1;
	if (
		(atkAbility === 'Forward Dash' && move.category === 'Spread') ||
		(atkAbility === 'Skilled Hand' && typeEffectiveness < 1)
	) {
		// TODO: Skilled Hand ignores quad resists?
		pendingMod = 2;
	} else if (
		(atkAbility === 'Strategist' && basePower <= 60) ||
		((atkAbility === 'Precise Aim' ||
			(atkAbility === 'Western Expanse' && field.terrain === 'Byakko')) &&
			move.alwaysHits &&
			gen !== 5) ||
		(atkAbility === "Gentei's Water" &&
			field.terrain === 'Genbu' &&
			move.type === 'Water') ||
		(atkAbility === "Sutei's Fire" &&
			field.terrain === 'Suzaku' &&
			move.type === 'Fire') ||
		(atkAbility === "Byakutei's Metal" &&
			field.terrain === 'Byakko' &&
			move.type === 'Steel') ||
		(atkAbility === "Seitei's Wood" &&
			field.terrain === 'Seiryu' &&
			move.type === 'Nature') ||
		(atkAbility === "Koutei's Earth" &&
			field.terrain === 'Kohryu' &&
			move.type === 'Earth') ||
		(atkAbility === 'Final Form' &&
			isSTAB &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Robust Spirit' &&
			move.type === 'Steel' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Vigorous Spirit' &&
			move.type === 'Fighting' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Sparking Spirit' &&
			move.type === 'Steel' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Surging Spirit' &&
			move.type === 'Water' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Abyssal Spirit' &&
			move.type === 'Dark' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Sinister Spirit' &&
			move.type === 'Steel' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Raging Spirit' &&
			move.type === 'Wind' &&
			attacker.curHP < attacker.maxHP / 3) ||
		(atkAbility === 'Musical Spirit' &&
			move.type === 'Sound' &&
			attacker.curHP < attacker.maxHP / 3)
	) {
		pendingMod = 1.5;
	} else if (
		(atkAbility === 'Vision Bonus' && move.type === 'Illusion') ||
		(atkAbility === 'Spark Bonus' && move.type === 'Electric') ||
		(atkAbility === 'Normal Bonus' && move.type === 'Void') ||
		(atkAbility === 'Disjointed Blow' && typeEffectiveness > 1)
	) {
		pendingMod = 1.4;
	} else if (
		(atkAbility === 'Charge!' && move.hasSecondaryEffect) ||
		(atkAbility === 'After Move' && turnOrder !== 'FIRST') ||
		(atkAbility === 'On the Edge' && attacker.curHP === 1) ||
		(formCheck !== -1 && move.isVoid === true)
	) {
		pendingMod = 1.3;
	} else if (
		(atkAbility === 'Reckless' &&
			(move.hasRecoil === 'number' || move.hasRecoil === 'crash')) ||
		(atkAbility === 'Western Expanse' &&
			field.terrain === 'Byakko' &&
			move.acc100) ||
		(atkAbility === 'Empowered' && move.isEN) ||
		(atkAbility === 'Astronomy' && !move.isEN) ||
		(atkAbility === 'First Hit' && turnOrder === 'FIRST') ||
		atkAbility === 'Full Power'
	) {
		pendingMod = 1.2;
	} else if (atkAbility === 'Mindless Dance' && move.willLock) {
		pendingMod = 0.9;
	} else if (atkAbility === 'Fast Talker' && move.willCharge) {
		pendingMod = 0.9;
	} else if ((atkAbility === 'Known Limits' && !isSTAB) || doppelganger) {
		pendingMod = 0.66;
	}
	// Skip the entire above section's power modifications if Ascertainment is present
	if (
		pendingMod !== 1 &&
		(defAbility === 'Ascertainment' || field.terrain === 'Kohryu')
	) {
		// NOTE: This also blocks the power reduction from Two of a Kind, but NOT the multihit!
		if (defAbility === 'Ascertainment') {
			description.defenderAbility = defAbility;
		}
	} else if (pendingMod !== 1) {
		finalMods.push(pendingMod);
		if (atkYoumaMod === '') {
			description.attackerAbility = atkAbility;
		}
	}

	// Defense-related abilities
	pendingMod = 1;
	if (defAbility === 'Cloak of Darkness' && move.type === 'Light') {
		pendingMod = 1.25;
	} else if (defAbility === 'Slow Tempo') {
		pendingMod = 0.9;
	} else if (
		(defAbility === 'Spirit of Yin' &&
			(move.type === 'Poison' ||
				move.type === 'Dark' ||
				move.type === 'Nether') &&
			gen !== 5) ||
		(defAbility === 'Spirit of Yang' &&
			(move.type === 'Electric' ||
				move.type === 'Light' ||
				move.type === 'Illusion') &&
			gen !== 5)
	) {
		pendingMod = 0.8;
	} else if (defAbility === 'Glamorous' && typeEffectiveness > 1) {
		pendingMod = 0.75;
	} else if (defAbility === 'Known Limits' && !isSTAB) {
		pendingMod = 0.66;
	} else if (
		(defAbility === 'Inverse Reaction' &&
			(move.type === 'Light' || move.type === 'Dark')) ||
		(defAbility === 'Yata no Kagami' &&
			defender.curHP === defender.maxHP) ||
		(defAbility === 'Unique Shield' && move.category === 'Focus') ||
		(defAbility === "Gentei's Water" &&
			field.terrain === 'Genbu' &&
			move.type === 'Earth') ||
		(defAbility === "Sutei's Fire" &&
			field.terrain === 'Suzaku' &&
			move.type === 'Water') ||
		(defAbility === "Byakutei's Metal" &&
			field.terrain === 'Byakko' &&
			move.type === 'Fire') ||
		(defAbility === "Seitei's Wood" &&
			field.terrain === 'Seiryu' &&
			move.type === 'Steel') ||
		(defAbility === "Koutei's Earth" &&
			field.terrain === 'Kohryu' &&
			move.type === 'Nature')
	) {
		pendingMod = 0.5;
	}
	// Skip the entire above section's power modifications if Ascertainment is present
	// NOTE: precedence here matches the original exactly (&& binds tighter than ||).
	if (
		(pendingMod !== 1 && atkAbility === 'Ascertainment') ||
		field.terrain === 'Kohryu'
	) {
		if (atkAbility === 'Ascertainment') {
			description.attackerAbility = atkAbility;
		}
	} else if (pendingMod !== 1) {
		finalMods.push(pendingMod);
		if (defYoumaMod === '') {
			description.defenderAbility = defAbility;
		}
	}

	// Prepare Screens
	if (move.name !== 'Break Shot' && move.name !== 'Field Break') {
		if (field.isFieldProtect && move.category === 'Focus' && !isCritical) {
			finalMods.push(0.5);
			description.isFieldProtect = true;
		} else if (
			field.isFieldBarrier &&
			move.category === 'Spread' &&
			!isCritical
		) {
			finalMods.push(0.5);
			description.isFieldBarrier = true;
		}
	}

	let damage: number[] = new Array(15).fill(0);
	for (let i = 0; i < 15; i++) {
		// RNG = 0.86, 0.87, ..., 1.00
		damage[i] = getFinalDamage(baseDamage, i, finalMods);
	}
	if (move.dropsStats && move.usedTimes > 1) {
		let adjMultiplier = 1;
		if (attacker.ability === 'Good Management') {
			adjMultiplier = 2;
		}
		description.moveTurns = 'over ' + move.usedTimes + ' turns';
		const hasPurify = attacker.item === 'Purify Charm';
		let usedPurify = false;
		let dropCount = attacker.boosts[attackStat];
		for (let times = 0; times < move.usedTimes; times++) {
			const newAttack = getModifiedStat(
				attacker.rawStats[attackStat],
				dropCount,
			);
			let damageMultiplier = 0;
			damage = damage.map(function (affectedAmount) {
				if (times) {
					const newBaseDamage = getBaseDamage(
						attacker.level,
						basePower,
						newAttack,
						defense,
					);
					const newFinalDamage = getFinalDamage(
						newBaseDamage,
						damageMultiplier,
						finalMods,
					);
					damageMultiplier++;
					return affectedAmount + newFinalDamage;
				}
				return affectedAmount;
			});
			if (
				atkAbility === 'Usurpation'
					? defAbility !== 'Reverse Function'
					: defAbility === 'Reverse Function'
			) {
				dropCount = Math.min(
					6,
					dropCount + (move.dropsStats as number) * adjMultiplier,
				);
				if (atkAbility === 'Usurpation' || atkAbility === 'Simple') {
					description.attackerAbility = atkAbility;
				}
				if (defAbility === 'Reverse Function') {
					description.defenderAbility = defAbility;
				}
			} else {
				dropCount = Math.max(
					-6,
					dropCount - (move.dropsStats as number) * adjMultiplier,
				);
				if (atkAbility === 'Simple') {
					description.attackerAbility = atkAbility;
				} else if (atkAbility === 'Usurpation') {
					// if this is true, then both triggered
					description.attackerAbility = atkAbility;
					description.defenderAbility = defAbility;
				}
			}
			// the puppet hits THEN the stat rises / lowers
			if (hasPurify && attacker.boosts[attackStat] < 0 && !usedPurify) {
				dropCount += (move.dropsStats as number) * adjMultiplier;
				usedPurify = true;
				description.attackerItem = attacker.item;
			}
		}
	}
	if (attacker.item === 'Repetitive Arts' && move.repetitionCount > 1) {
		const boostTurns = move.dropsStats
			? move.usedTimes
			: move.repetitionCount;
		for (
			let repetitiveArts = 0;
			repetitiveArts < boostTurns;
			repetitiveArts++
		) {
			const totalRepBoost = 1 + repetitiveArts / 10;
			damage = damage.map((damageRoll) =>
				puppRound(damageRoll * totalRepBoost),
			);
		}
		description.attackerItem = 'Repetitive Arts';
	}
	description.attackBoost = attacker.boosts[attackStat];
	return { damage, description: buildDescription(description) };
}

export function toTPDPStat(stat: StatKey): string {
	return stat === FA
		? 'FoAtk'
		: stat === FD
			? 'FoDef'
			: stat === SA
				? 'SpAtk'
				: stat === SD
					? 'SpDef'
					: stat === SP
						? 'Spe'
						: 'wtf';
}

export function chainMods(base: number, mods: number[]): number {
	// Each does a floor operation post multiplication
	for (let i = 0; i < mods.length; i++) {
		if (mods[i] !== 1) {
			base = Math.floor(base * mods[i]);
		}
	}
	return base;
}

export function getMoveEffectiveness(
	move: { type: string },
	type: string,
	noCommonSense?: boolean,
): number {
	if (noCommonSense && chart()[move.type][type] === 0) {
		return 1;
	}
	return chart()[move.type][type];
}

export function getModifiedStat(stat: number, mod: number): number {
	return mod > 0
		? Math.floor((stat * (2 + mod)) / 2)
		: mod < 0
			? Math.floor((stat * 2) / (2 - mod))
			: stat;
}

export function getFinalSpeed(
	puppet: Puppet,
	weather: string,
	terrain: string,
): number {
	let speed = getModifiedStat(puppet.rawStats[SP], puppet.boosts[SP]);
	if (
		puppet.item === 'Choice Belt' ||
		(puppet.item === 'Izanagi Object' && terrain === 'Kohryu')
	) {
		speed = Math.floor(speed * 1.5);
	} else if (puppet.item === 'Iron Clogs') {
		speed = Math.floor(speed / 2);
	} else if (puppet.item === 'Boundary Trance') {
		speed = Math.floor(speed * 2.0);
	}
	if (
		(puppet.ability === 'Flash' && weather === 'Aurora') ||
		(puppet.ability === 'Sand Devil' && weather === 'Dust Storm') ||
		(puppet.ability === 'Fog Traveler' && weather === 'Heavy Fog') ||
		(puppet.ability === "Fox's Wedding" && weather === 'Sunshower') ||
		(puppet.ability === 'Silent Running' && weather === 'Calm')
	) {
		speed *= 2;
	} else if (puppet.ability === 'Northern Expanse' && terrain === 'Genbu') {
		speed *= 0.5;
	}
	return speed;
}

export function countBoosts(boosts: Record<StatKey, number>): number {
	let sum = 0;
	for (let i = 0; i < STATS_ALL.length; i++) {
		if (boosts[STATS_ALL[i]] > 0) {
			sum += boosts[STATS_ALL[i]];
		}
	}
	return sum;
}

// GameFreak rounds DOWN on .5; assume TPDP does the same until proven otherwise
export function puppRound(num: number): number {
	return num % 1 > 0.5 ? Math.ceil(num) : Math.floor(num);
}

export function getBaseDamage(
	level: number,
	basePower: number,
	attack: number,
	defense: number,
): number {
	return Math.floor(
		Math.floor(
			(Math.floor(0.4 * level + 2) * attack * basePower) / defense,
		) /
			50 +
			2,
	);
}

export function getFinalDamage(
	baseAmount: number,
	i: number,
	finalMods: number[],
): number {
	let damageAmount = Math.floor((baseAmount * (86 + i)) / 100);
	for (let m = 0; m < finalMods.length; m++) {
		damageAmount = Math.floor(damageAmount * finalMods[m]);
	}
	return damageAmount;
}

export function buildDescription(description: Description): string {
	let output = '';
	if (description.attackBoost) {
		if ((description.attackBoost as number) > 0) {
			output += '+';
		}
		output += description.attackBoost + ' ';
	}
	output = appendIfSet(output, description.attackPP);
	output = appendIfSet(output, description.attackerItem);
	output = appendIfSet(output, description.attackerAbility);
	if (description.isBlinded) {
		output += 'blinded ';
	} else if (description.isAfraid) {
		output += 'afraid ';
	}
	output += description.attackerName + ' ';
	output += description.moveName + ' ';
	if (description.moveBP && description.moveType) {
		output +=
			'(' + description.moveBP + ' BP ' + description.moveType + ') ';
	} else if (description.moveBP) {
		output += '(' + description.moveBP + ' BP) ';
	} else if (description.moveType) {
		output += '(' + description.moveType + ') ';
	}
	if (description.hits) {
		output += '(' + description.hits + ' hits) ';
	}
	output = appendIfSet(output, description.moveTurns);
	output += 'vs. ';
	if (description.defenseBoost) {
		if ((description.defenseBoost as number) > 0) {
			output += '+';
		}
		output += description.defenseBoost + ' ';
	}
	output = appendIfSet(output, description.HPPP);
	if (description.defensePP) {
		output += ' / ' + description.defensePP + ' ';
	}
	output = appendIfSet(output, description.defenderItem);
	output = appendIfSet(output, description.defenderAbility);
	if (description.isProtected) {
		output += 'protected ';
	}
	if (description.defenderGhost) {
		output += 'Ghost Chase ';
	}
	if (description.defenderReversed) {
		output += 'Reversed ';
	}
	output += description.defenderName;
	if (description.weather && description.terrain) {
		output += ' in ' + description.weather + ' and ' + description.terrain;
	} else if (description.weather) {
		output += ' in ' + description.weather;
	} else if (description.terrain) {
		output += ' in ' + description.terrain;
	}
	if (description.isFieldProtect) {
		output += ' through Field Protect';
	} else if (description.isFieldBarrier) {
		output += ' through Field Barrier';
	}
	if (description.isCritical) {
		output += ' on a critical hit';
	}
	return output;
}

function appendIfSet(
	str: string,
	toAppend: string | number | boolean | undefined,
): string {
	if (toAppend) {
		return str + toAppend + ' ';
	}
	return str;
}
