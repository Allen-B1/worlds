<script>
import Map from './Map.svelte';
import Stats from './Stats.svelte';
import TileInfos from './TileInfos.svelte';
import Players from './Players.svelte';
import Tutorial from './Tutorial.svelte';
import History from './History.svelte';

import {tileTypes, tileKeys} from './constants.js';

let armies = [];
let terrain = [];
let territory = [];
let deposits = [];
let tiletypes = [];
let relationships = [];

let players = [];
let losers = [];

// Set: the currently selected tiles
let selected = new Set();

let launched = false;

let hide = false;
let minimized = false;

let materials = {};
let materialLabels = [
		["Brk", "brick", "text-brick"],
		["Cu", "copper", "text-copper"],
		["Fe", "iron", "text-iron"],
		["Au", "gold", "text-gold"],
		["U", "uranium", "text-uranium"]];
$: if (materials.green) {
	materialLabels[5] = ["G", "green", "text-green"];
} else {
	materialLabels.length = 5;
}

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
	let i = 0;
	for (let kbd of tileKeys) {
		let type = tileTypes[kbd];
		let xhr = new XMLHttpRequest();
		let j = i;
		xhr.onload = function() {
			let info = JSON.parse(xhr.responseText);
			info.key = kbd;
			tileInfos[j] = info;
			tileInfos = tileInfos;
		};
		xhr.open("GET", "/api/tileinfo?type=" + type);
		xhr.send();
		i += 1;
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
		relationships = json.relationships;
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


function nuke(evt) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "/api/" + roomId + "/nuke?tile=" + evt.detail.tile + "&key=" + userKey);
	xhr.send();
}

let greenhouses = 0;
let showHistory = false;
$: {
	greenhouses = 0;
	for (let i = 0; i < territory.length; i++) {
		if (territory[i] == userIndex & tiletypes[i] == "greenhouse") {
			greenhouses += 1;
		}
	}
}

window.addEventListener("keydown", function(e) {
	if (e.key == "h") hide = !hide;
	if (e.key == "m") minimized = !minimized;
	if (e.key == "r") {
		if (greenhouses != 0) {
			showHistory = !showHistory;
		} else {
			showHistory = false;
		}
	}
});

function relationshipUpdate(evt) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "/api/" + roomId + "/relationship?action=" + evt.detail.action + "&player=" + evt.detail.player + "&key=" + userKey);
	xhr.send();
}
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
	on:nuke={nuke}
	bind:selected={selected}
 />

{#if !hide}
<Stats stats={stats}
	labels={statsLabels}
	x="16" y="16" />
<Stats stats={materials}
	labels={materialLabels}
	x="16" y="88" />
{#if tileInfos.length == 11}
<TileInfos infos={tileInfos} minimized={minimized} />
{/if}
<Players on:status={relationshipUpdate} players={players} losers={losers} userIndex={userIndex} relationships={relationships} />

<button style={"z-index:5;top:300px;left:16px;position:fixed;display:" + (launched?"block":"none")}
	on:click={() => {planet=planet=="earth"?"mars":"earth"}}>To {planet == "earth" ? "Mars" : "Earth"}</button>
{/if}

<History documents={greenhouses} show={showHistory} />ni

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

