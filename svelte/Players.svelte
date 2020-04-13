<script>
import {createEventDispatcher} from 'svelte';

export let players = [];
export let losers = [];
export let relationships = [];
export let userIndex;

const dispatch = createEventDispatcher();

let playerOrder = players;
$: {
	playerOrder = [];

	if (losers == null) losers = [];

	for (let i = 0; i < players.length; i++) {
		if (losers.indexOf(i) == -1) {
			playerOrder.push(i);
		}
	}

	playerOrder = playerOrder.concat(losers);

	playerOrder = playerOrder;
}

const RELATIONSHIP_SYMBOLS = {
	"-1": "E",
	"0": "N",
	"1": "C",
	"2": "A"
};

function inc(evt) {
	let i = evt.target.parentNode.className.indexOf("player-") + "player-".length;
	let player = evt.target.parentNode.className[i];
	dispatch("status", {player:player, action:"upgrade"});
}

function dec(evt) {
	let i = evt.target.parentNode.className.indexOf("player-") + "player-".length;
	let player = evt.target.parentNode.className[i];
	dispatch("status", {player:player, action:"downgrade"});
}
</script>

<style>
table {
	position: fixed;
	background: #ddd;
	border: 2px solid #999;
    font-family: 'VT323', monospace;
	font-size: 16px;
	border-collapse: collapse;
	z-index: 3;
	top: 16px;
	right: 16px;
	color: #000;
}
td {
	padding: 4px 8px;
}
.loser .name {
	text-decoration: line-through;
}
.name {
	color: #fff;
	min-width: 80px;
	text-align: center;
}

.player-0 .name {
	background: hsl(0, 50%, 50%); }
.player-1 .name {
	background: hsl(100, 50%, 50%); }
.player-2 .name {
	background: hsl(200, 50%, 50%); }
.player-3 .name {
	background: hsl(300, 50%, 50%); }
.player-4 .name {
	background: hsl(40, 50%, 50%); }
.player-5 .name {
	background: hsl(250, 50%, 50%); }
.self {
	font-weight: bold; }

.relationship {
	min-width: 24px;
	text-align: center; }

.action {
	cursor: pointer;
	text-align: center;
	min-width: 12px; }
.action:hover {
	background: #bbb; }
</style>

<table>
	{#each playerOrder as player}
	<tr class={"player-" + player + " " + (losers.indexOf(player) != -1 ? "loser ": "") + (userIndex === player ? "self " : "")}>
		<td class="name">{players[player]}</td>
		{#if player != userIndex}
		<td class="relationship">{RELATIONSHIP_SYMBOLS[relationships[player]]}</td>
		{#if losers.indexOf(player) == -1}
		<td class="action" on:click={inc}>↑</td>
		<td class="action" on:click={dec}>↓</td>
		{/if}
		{/if}
	</tr>
	{/each}
</table>
