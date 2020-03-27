<script>
	import {createEventDispatcher} from 'svelte';
	import {sizes} from './constants.js';

	const dispatch = createEventDispatcher();

	export let tile;
	export let army;
	export let terrain;
	export let territory;
	export let tiletype;
	export let deposit;

	export let selected;

	let x, y, planet;
	$: {
		if (tile >= sizes.earth*sizes.earth) {
			x = (tile - sizes.earth*sizes.earth) % sizes.mars;
			y = ((tile - sizes.earth*sizes.earth) / sizes.mars) | 0;
			planet = "mars";
		} else {
			x = tile % sizes.earth;
			y = (tile / sizes.earth) | 0;
			planet = "earth";
		}
	}

	function click() {
		dispatch("click", tile);
	}
</script>

<style>
div {
	position: absolute;
	width: 32px;
	height: 32px;
	text-align: center;
	background: var(--territory);
}
span {
	font-size: 12px;
	display: inline-block;

	width: 32px;
	height: 24px;
	padding-top: 8px;

	position: relative;
	z-index: 2;
	color: #000;
}
.tiletype-core span {
	background: url(/core.svg); }
.tiletype-camp span {
	background: url(/camp.svg); }
.tiletype-kiln span {
	background: url(/kiln.svg); }
.tiletype-mine1 span {
	background: url(/mine1.svg); }
.tiletype-mine2 span {
	background: url(/mine2.svg); }
.tiletype-mine3 span {
	background: url(/mine3.svg); }
.tiletype-brick-wall span {
	background: url(/brick-wall.svg); }
.tiletype-copper-wall span {
	background: url(/copper-wall.svg); }
.tiletype-iron-wall span {
	background: url(/iron-wall.svg); }
.tiletype-launcher span {
	background: url(/launcher.svg); }
.tiletype-cleaner span {
	background: url(/cleaner.svg); }

.deposit-iron {
	background: url(/iron.svg) var(--territory); }
.deposit-copper {
	background: url(/copper.svg) var(--territory); }
.deposit-gold {
	background: url(/gold.svg) var(--territory); }
.deposit-uranium {
	background: url(/uranium.svg) var(--territory); }
.territory--1 {
	--territory: transparent; }
.territory-0 {
	--territory: hsl(0, 50%, 75%); }
.territory-1 {
	--territory: hsl(100, 50%, 75%); }
.territory-2 {
	--territory: hsl(200, 50%, 75%); }
.territory-3 {
	--territory: hsl(300, 50%, 75%); }
.territory-4 {
	--territory: hsl(40, 50%, 75%); }
.territory-5 {
	--territory: hsl(250, 50%, 75%); }

.terrain-ocean span {
	background: url(/ocean.svg); }
.terrain-ocean.territory--1 {
	--territory: #3F6ABF; }
.terrain-fog {
	background: #aaa; }
.terrain-fog span::before {
	content: "?"; }
.selected {
	outline: 2px solid #555;
	z-index: 2;
}
</style>

<div on:click={click} class={"deposit-" + deposit + " terrain-" + terrain + " tiletype-" + tiletype + " territory-" + territory + (selected ? " selected" : "")} style={"top:"+(32*y)+"px;left:"+(32*x)+"px;"}>
	<span>{((territory == -1 && !army) || army == undefined) ? "" : army}</span>
</div>

