<script>
import {sizes} from "./constants.js";

export let selected = new Set();
export let userIndex;
export let planet;

export let deposits;
export let armies;
export let terrain;
export let territory;
export let tiletypes;

const canSkip = {
	2: true, 
	5: true,
	8: true
};

let selectedTile;
$: {
	selectedTile = selected.values().next().value;
}

let stage = 0;
let text;
$: {
	text = {
		0: "Welcome to worlds! To start out, select your <b>Core</b>, which is the tile that currently has 15 army. Then, move your army around by pressing WASD.",
		1: "We need more bricks! Move to an empty tile adjacent to your core and press <kbd>3</kbd> to build a <b>Kiln</b>.",
		2: "That just cost 20 bricks. But don't worry! Each <b>Kiln</b> will give you 1 brick per turn.<br><br>" +
			"The costs of any building is shown in the <b>bottom-left corner</b>. To see how much material you have, see the <b>top-left corner</b>.",
		3: "A Village consists of a core and the 8 tiles around it. Kilns must be located inside of a Village.<br><br>Build 3 more Kilns, for a total of 5.",
		4: "Good! Now, use the remaining 3 spots in your Village to build Camps by pressing <kbd>2</kbd>. Camps generate 1 army every 5 turns; having a large army is important for success later on.",
		5: "After you build up an army, use it to explore your island a bit.",
		6: "See those little brown squares? Those are copper deposits. Copper is an important resource that is required for many buildings. A <b>Mine v1</b> can be used to get copper.<br><br>Go to a copper deposit and build a Mine on top of it by pressing <kbd>4</kbd>.",
		7: "Good! Our next step is to build a Mine v2 over an iron deposit (the little silver squares). While you're waiting, it might be a good idea to build some more copper mines.<br><br>Gather copper and build a Mine v2 over an iron deposit by pressing <kbd>5</kbd>.",
		8: "In addition to iron, Mine v2 can also mine copper and uranium.<br><br>Build some more iron & copper mines.",
		9: "Next, we have to mine some gold, which we need to build a Launcher to get to Mars. Only the Mine v3 can mine gold.<br><br>Find a gold deposit (small yellow squares). You'll have to cross the ocean. Build a Mine v3 on top of the deposit by pressing <kbd>6</kbd>.",
		10: "Hooray! Now it's time to build a Launcher, which will get us to Mars. Launchers can be located anywhere on land.",
		11: "Let's go to Mars! Select your Launcher and press <kbd>L</kbd>.",
		12: "Hooray! You've reached the end of this tutorial. You should be able to continue on your own from here."
	}[stage];
}

let stageInfo = [];
$: if (stage == 0) {
	if (tiletypes[selectedTile] == "core" && territory[selectedTile] == userIndex) {
		stageInfo[0] = true;
	}
	if (tiletypes[selectedTile] != "core" && stageInfo[0]) {
		stage += 1;
	}
}

$: if (stage == 1) {
	if (tiletypes[selectedTile] == "" && territory[selectedTile] == userIndex) {
		stageInfo[1] = selectedTile;
	}
	if (tiletypes[stageInfo[1]] == "kiln") {
		stage += 1;
	}
}
$: if (stage == 3) {
	let count = 0;
	for (let tile = 0; tile < sizes.earth*sizes.earth; tile++) {
		if (tiletypes[tile] == "kiln" && territory[tile] == userIndex)
			count += 1;
	}
	if (count >= 5) {
		stage += 1;
	}
}

$: if (stage == 4) {
	let count = 0;
	for (let tile = 0; tile < sizes.earth*sizes.earth; tile++) {
		if (tiletypes[tile] == "camp" && territory[tile] == userIndex)
			count += 1;
	}
	if (count >= 3) {
		stage = 5;
	}
}

$: if (stage == 6) {
	for (let tile = 0; tile < sizes.earth*sizes.earth; tile++) {
		if (tiletypes[tile] == "mine1" && territory[tile] == userIndex) {
			stage = 7;
			break;
		}
	}
}
$: if (stage == 7) {
	for (let tile = 0; tile < sizes.earth*sizes.earth; tile++) {
		if (tiletypes[tile] == "mine2" && deposits[tile] == "iron" && territory[tile] == userIndex) {
			stage = 8;
			break;
		}
	}
}
$: if (stage == 9) {
	for (let tile = 0; tile < sizes.earth*sizes.earth; tile++) {
		if (tiletypes[tile] == "mine3" && territory[tile] == userIndex) {
			stage = 10;
			break;
		}
	}
}
$: if (stage == 10) {
	for (let tile = 0; tile < sizes.earth*sizes.earth; tile++) {
		if (tiletypes[tile] == "launcher" && territory[tile] == userIndex) {
			stage = 11;
			break;
		}
	}
}
$: if (stage == 11) {
	if (planet == "mars") {
		stage = 12;
	}
}
</script>

<style>
div {
	position: fixed;
	bottom: 16px; right: 16px;
	width: 300px; height: 150px;
	background: #777; border: 2px solid #444;
	color: #fff;
	z-index: 3;
	padding: 8px 16px;
}
button {
	border: 0;
 	background: transparent;
	position: absolute;
	bottom: 16px;
	right: 16px;
	padding: 0;
	color: #fff;
	text-decoration: underline;
}
</style>

<div>
	{@html text}
	{#if canSkip[stage]}
	<button on:click={() => stage += 1}>Next</button>
	{/if}
</div>
