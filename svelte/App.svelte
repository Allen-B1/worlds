<script>
import Map from './Map.svelte';
import Stats from './Stats.svelte';
import TileInfos from './TileInfos.svelte';
import Players from './Players.svelte';
import Tutorial from './Tutorial.svelte';

import {tileTypes, tileKeys} from './constants.js';

let armies = [];
let terrain = [];
let territory = [];
let deposits = [];
let tiletypes = [];

let players = [];
let losers = [];

// Set: the currently selected tiles
let selected = new Set();

let launched = false;

let hide = false;

let materials = {};
const materialLabels = [
		["Brk", "brick", "text-brick"],
		["Cu", "copper", "text-copper"],
		["Fe", "iron", "text-iron"],
		["Au", "gold", "text-gold"],
		["U", "uranium", "text-uranium"]];

let stats = {};
const statsLabels = [
	["Turn", "turn"],
	["Pollution", "pollution"]];

let planet = "earth";
$: {
	if (planet == "earth") {
		document.title = "worlds • earth";
		document.body.style.background = "#3F6ABF";
	} else {
		document.title = "worlds • mars";
		document.body.style.background = "#993354";
	}
}

const isTutorial = location.hash.endsWith(":tutorial");

const roomId = location.pathname.split("/")[1];
const userKey = location.hash.slice(1).split(":")[0];
let userIndex;
{
	let xhr = new XMLHttpRequest();
	xhr.onload = function() {
		userIndex = xhr.responseText | 0;
	};
	xhr.open("POST", "/api/" + roomId + "/join?key=" + userKey);
	xhr.send();
}

let tileInfos = [];
{
	for (let kbd of tileKeys) {
		let type = tileTypes[kbd];
		let xhr = new XMLHttpRequest();
		xhr.onload = function() {
			let info = JSON.parse(xhr.responseText);
			info.key = kbd;
			tileInfos.push(info);
			tileInfos = tileInfos;
		};
		xhr.open("GET", "/api/tileinfo?type=" + type);
		xhr.send();
	}
}

setInterval(function(){
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		var json = JSON.parse(xhr.responseText);
		armies = json.armies;
		terrain = json.terrain;
		territory = json.territory;
		deposits = json.deposits;
		tiletypes = json.tiletypes;

		materials = json.stats[userIndex].materials;

		stats.pollution = json.pollution;
		stats.turn = json.turn;
		stats = stats;

		players = json.players;
		losers = json.losers;
	};
	xhr.open("GET", "/api/" + roomId + "/data.json?key=" + userKey);
	xhr.send();
}, 500);

function move(evt) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "/api/" + roomId + "/move?from=" + evt.detail.from + "&to=" + evt.detail.to + "&key=" + userKey);
	xhr.send();
}

function make(evt) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "/api/" + roomId + "/make?tile=" + evt.detail.tile + "&type=" + evt.detail.type + "&key=" + userKey);
	xhr.send();
}

function launch(evt) {
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		if (xhr.status == 200) {
			planet = "mars";
			launched = true;
		}
	}
	xhr.open("POST", "/api/" + roomId + "/launch?tile=" + evt.detail.tile + "&key=" + userKey);
	xhr.send();
}

window.addEventListener("keydown", function(e) {
	if (e.key == "h") hide = !hide;
});
</script>

<Map planet={planet}
	armies={armies}
	terrain={terrain}
	territory={territory}
	deposits={deposits}
	tiletypes={tiletypes}
	on:move={move}
	on:make={make}
	on:launch={launch}
	bind:selected={selected}
 />

{#if !hide}
<Stats stats={stats}
	labels={statsLabels}
	x="16" y="16" />
<Stats stats={materials}
	labels={materialLabels}
	x="16" y="88" />
<TileInfos infos={tileInfos} />
<Players players={players} losers={losers} userIndex={userIndex} />

<button style={"top:240px;left:16px;position:fixed;display:" + (launched?"block":"none")}
	on:click={() => {planet=planet=="earth"?"mars":"earth"}}>To {planet == "earth" ? "Mars" : "Earth"}</button>
{/if}

{#if isTutorial}
<Tutorial armies={armies}
	terrain={terrain}
	territory={territory}
	deposits={deposits}
	tiletypes={tiletypes}
	selected={selected}
	userIndex={userIndex}
	planet={planet}
/>
{/if}

