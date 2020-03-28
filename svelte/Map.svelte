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

	let size, tiles, offset;
	$: {
		size = planet == "earth" ? sizes.earth : sizes.mars;
		offset = planet == "earth" ? 0 : sizes.earth*sizes.earth;
		tiles = planet == "earth" ? 
			[...Array(sizes.earth*sizes.earth).keys()] :
			[...Array(sizes.mars*sizes.mars).keys()].map(i => i+offset);
		console.log(size);
	}

	console.log(tiles);

	let elem;
	$: {
		if (elem) {
			elem.style.width = elem.style.height = size * 32 + "px";
		}
	}

	export let selected = new Set();
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
			if (e.code == "KeyS") toTile = tile + size;
			if (e.code == "KeyA") toTile = tile - 1;
			if (e.code == "KeyD") toTile = tile + 1;

			if (e.code == "KeyA" || e.code == "KeyD") {
				if (Math.floor((toTile-offset) / size) != Math.floor((tile-offset) / size)) {
					return;
				}
			} else {
				if (toTile >= offset+size*size || toTile < offset) {
					return;
				}
			}

			dispatch("move", {from:tile, to: toTile});
			selected.clear();
			selected.add(toTile);
			selected = selected;
		}
		return;
	case "Backspace":
		for (let tile of selected) {
			dispatch("make", {tile:tile, type:""});
		}
		return;
	}

	if (e.key in tileTypes) {
		for (let tile of selected) {
			dispatch("make", {tile:tile, type:tileTypes[e.key]});
		}
	}

	if (e.key == "g") {
		for (let tile of selected) {
			dispatch("make", {tile:tile, type:"greenhouse"});
		}
	}

	if (e.key == "l") {
		let tile = selected.values().next().value;
		dispatch("launch", {tile:tile});
	}

	if (e.key == "n") {
		let tile = selected.values().next().value;
		dispatch("nuke", {tile:tile});
	}
	});
</script>

<style>
div {
	position: relative;
	background: #fafafa;
	margin: auto;
}
</style>

<div bind:this={elem}>
	{#each tiles as tile} 
		<Tile on:click={select} selected={selected.has(tile)} tile={tile} terrain={terrain[tile]} army={armies[tile]} territory={territory[tile]} deposit={deposits[tile]} tiletype={tiletypes[tile]} />
	{/each}
</div>
