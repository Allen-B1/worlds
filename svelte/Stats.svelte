<script>
export let stats = {};
export let labels = [];
export let x, y;
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
}
td {
	padding: 4px 8px;
}
</style>

<table style={"left:" + x + "px;top:" + y + "px"}>
	{#each labels as label}
	<tr class={label[2]||""}>
		<td>{label[0]}</td>
		<td>{stats[label[1]] | 0}</td>
	</tr>
	{/each}
</table>
