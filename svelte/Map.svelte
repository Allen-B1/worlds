<script>
	import Tile from "./Tile.svelte";
	import {sizes, tileTypes} from "./constants.js";
	import {createEventDispatcher} from 'svelte';

	const dispatch = createEventDispatcher();

	export let planet = "earth";
	export let deposits;

	export let armies;
	export let terrain;
	export let territory;
	export let tiletypes;

	const size = planet == "earth" ? sizes.earth : sizes.mars;
	const tiles = planet == "earth" ? 
		[...Array(sizes.earth*sizes.earth).keys()] :
		[...Array(sizes.mars*sizes.mars).keys()].map(i => i+sizes.earth*sizes.earth);

	console.log(tiles);

	let elem;
	$: {
		if (elem) {
			elem.style.width = elem.style.height = size * 32 + "px";
		}
	}

	export let show;

	let selected = new Set();
	function select(evt) {
		selected.clear();
		selected.add(evt.detail);
		selected = selected;
	}

	document.addEventListener("keydown", function(e) {
	switch (e.code) {
	case "KeyW":
	case "KeyA":
	case "KeyS":
	case "KeyD":
		if (selected.size != 0) {
			let tile = selected.values().next().value;
			let toTile;
			if (e.code == "KeyW") toTile = tile - size;
			if (e.code == "KeyA") toTile = tile - 1;
			if (e.code == "KeyS") toTile = tile + size;
			if (e.code == "KeyD") toTile = tile + 1;
			dispatch("move", {from:tile, to: toTile});
			selected.clear();
			selected.add(toTile);
			selected = selected;
		}
		break;
	case "Backspace":
		for (let tile of selected) {
			dispatch("make", {tile:tile, type:""});
		}
	}

	if (e.key in tileTypes) {
		for (let tile of selected) {
			dispatch("make", {tile:tile, type:tileTypes[e.key]});
		}
	}

	if (e.key == "l") {
		let tile = selected.values().next().value;
		dispatch("launch", {tile:tile});
	}
	});
</script>

<style>
div {
	position: relative;
	background: #fafafa;
	margin: auto;
}
.hide { display: none; }
</style>

<div class={show?"":"hide"} bind:this={elem}>
	{#each tiles as tile} 
		<Tile on:click={select} selected={selected.has(tile)} tile={tile} terrain={terrain[tile]} army={armies[tile]} territory={territory[tile]} deposit={deposits[tile]} tiletype={tiletypes[tile]} />
	{/each}
</div>
