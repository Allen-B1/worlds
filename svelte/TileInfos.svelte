<script>
import {materialSyms} from './constants.js';

export let infos;
export let minimized;

function costToHTML(costs) {
	var str = "";
	for (var material in costs) {
		str += '<span class="text-' + material + '">' + costs[material] + " " + materialSyms[material] + "</span> ";
	}
	return str;
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

	bottom: 16px;
	left: 16px;
}
td {
	padding: 4px 8px;
}
</style>

<table>
{#each infos as info}
	{#if info}
	<tr>
		<td><kbd>{info.key}</kbd></td>
		<td>{info.name}</td>
		{#if !minimized}
		<td>{@html costToHTML(info.cost)}</td>
		{/if}
	</tr>
	{/if}
{/each}
</table>
