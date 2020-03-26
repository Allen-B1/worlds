<script>
export let players = [];
export let losers = [];

let playerOrder = players;
$: {
	playerOrder = [];
	if (losers == null) losers = [];
	for (let i = 0; i < players.length; i++) {
		if (losers.indexOf(i) == -1) {
			playerOrder.push(i);
		}
	}
	for (let i = losers.length - 1; i >= 0; i++) {
		playerOrder.push(i);
	}
	playerOrder = playerOrder;
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
	color: #fff;
}
td {
	padding: 4px 8px;
}
.loser {
	text-decoration: line-through;
}

.player-0 {
	background: hsl(0, 50%, 50%); }
.player-1 {
	background: hsl(100, 50%, 50%); }
.player-2 {
	background: hsl(200, 50%, 50%); }
</style>

<table>
	{#each playerOrder as player}
	<tr class={"player-" + player + " " + (losers.indexOf(player) != -1 ? "loser": "")}>
		<td>{players[player]}</td>
	</tr>
	{/each}
</table>
