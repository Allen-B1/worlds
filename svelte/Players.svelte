<script>
import {createEventDispatcher} from 'svelte';

export let players = [];
export let losers = [];
export let relationships = [];
export let userIndex;
export let stats = [];

export let minimized;

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
	"1": "A"
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

function sign(n) {
	return n > 0 ? "+" + n : String(n|0);
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
td, th {
	padding: 4px 8px;
}
.loser .name {
	text-decoration: line-through;
}
.name {
	color: #fff;
	min-width: 80px;
	text-align: center; }

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
.self .name {
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

th.large {
	padding: 4px 12px;}
</style>

<table>
	<tr>
		<th class="large">Player</th>
		{#if players.length != 1}
		<th class="large" colspan="3">{minimized?"Rel.":"Relationship"}</th>
		{/if}
		{#if !minimized}
		<th>❋</th>
		{/if}
	</tr>
	{#each playerOrder as player}
	<tr class={"player-" + player + " " + (losers.indexOf(player) != -1 ? "loser ": "") + (userIndex === player ? "self " : "")}>
		<td class="name">{players[player]}</td>

		{#if players.length != 1}
		{#if player != userIndex}
		<td class="relationship">{RELATIONSHIP_SYMBOLS[relationships[player]]}</td>
		{#if !minimized}
		{#if losers.indexOf(player) == -1}
		<td class="action" on:click={inc}>↑</td>
		<td class="action" on:click={dec}>↓</td>
		{:else}
		<td colspan="2"></td>
		{/if}
		{/if}
		{:else}
		<td colspan="{minimized?1:3}"></td>
		{/if}
		{/if}

		{#if stats[player] && !minimized}
		<td>{sign(stats[player].pollution)}</td>
		{/if}
	</tr>
	{/each}
</table>

