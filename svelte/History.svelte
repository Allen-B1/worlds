<script>
export let documents;
export let show;

const maxDocuments = 15;

let documentcount;
$: documentcount = Math.min(documents, maxDocuments);

let document = 1;
</script>

<style>
div {
	width: 350px;
	height: 400px;
	position: fixed;
	top: 50%; left: 50%;
	margin-top: -200px; margin-left: -175px;
	background: #D6D4C1; border: 2px solid #ADA984;
	z-index: 4;
	padding: 16px;
}
h3 {
	font-size: 20px;
	text-align: center;
}
h4 {
	text-align: center;
	font-size: 16px;
	color: rgba(0,0,0,0.5);
}
p, h3, h4{
	margin-top: 0;
	margin-bottom: 8px;
}
button {
	border: 0;
 	background: transparent;
	position: absolute;
	bottom: 16px;
	padding: 0;
	color: #000;
	text-decoration: underline;
}
.page {
	text-align: center;
	display: block;
	position: absolute;
	bottom: 16px;
	left: 0; right: 0;
}
.blur-s {
	color: transparent;
	text-shadow: 0 0 1px rgba(0,0,0,0.9);
}
.blur-m {
	color: transparent;
	text-shadow: 0 0 3px rgba(0,0,0,0.8);
}
.blur {
	color: transparent;
	text-shadow: 0 0 5px rgba(0,0,0,0.7);
}
</style>

<div style={"display:" + (show?"block":"none")}>
{#if document === 1}
<h3>Sea Level Rise Worries Amsterdam Officials</h3>
<h4>March 15, 2139</h4>
<p><b>AMSTERDAM</b> - A recent report that came out last Wednesday
found that sea levels were rising at an alarming 1cm per day, much higher than previous estimates.
City officials in Amsterdam are worried that the city's complex sea-resistance system is not going to hold up
against this alarming rate. "We did not forsee that this system would need to resist sea levels this high," an architect said
who wished to remain anonymous.</p>
{:else if document === 2}
<h3>Scientist Publicly Challenges Darwinism</h3>
<h4>May 4, 2139</h4>
<p><b>BEIJING</b> - Scientist Liao Shi blamed scientists' acceptance of Darwin's theory of evolution
for the recent natural disasters that have occurred, which have included two consecutive hurricanes hitting the
United States' east coast, a tsunami affecting Japan and China, and twenty-three tornadoes hitting the The Midwest, all within the span of two months.
"The heavens are not happy with our acceptance of blasphemous
theories," he said at a conference last Friday.</p>
{:else if document === 3}
<h3>United States and China Blame Each Other for Natural Disasters</h3>
<h4>May 6, 2139</h4>
<p><b>WASHINGTON, D.C.</b> - The United States and China have been throwing attacks at
each other for the past few days. China accuses the U.S. of laxly enforcing
its climate regulations. "We believe that all countries must do their part,
including the United States", a spokesperson for the Chinese government said.
The United States, on the other hand, has pointed to China's numerous
factory farms, which China repeatedly denies.
</p>
{:else if document === 4}
<h3>Unrest in Santo Dominigo as Evacuation Order Announced</h3>
<h4>May 12, 2139</h4>
<p><b>SANTIAGO</b> - The Dominican government has ordered all residents of
Santo Dominigo to evacuate within 1 month. Protests have begun around all parts
of the city, which protesters chanting slogans like "Rather die than leave."
Protesters are accusing the president of causing unnecessary panic and
profiting off of it. He has close ties with the CEO of Memorias, a company
that specializes in creating small items that supposedly stop the rising of the sea.</p>
{:else if document === 5}
<h3>China Arrests Scientist for "Disrupting the Harmonious Balance of Society"</h3>
<h4>May 15, 2139</h4>
<p><b>TAIEPEI</b> - Li Bao, a climate scientist, had been urging the Chinese goverment to take actions
against climate change on his Weibo account, warning that if no action is taken, millions
of people would drown. Last Monday, he disappeared, with no comment from the goverment
as to his whereabouts. On Wednesday, the Chinese government formally announced that he had
been sentenced to five years in prison for "disrupting the harmonious balance of society" and causing
unnecessary panic.</p>
<p>The Chinese government has repeatedly offered assurances that the damage
that climate change will inflict will be mitigated, despite warnings
from scientists.</p>
{:else if document == 6}
<h3>NASA Announces Venture to Colonize Mars</h3>
<h4>June 2, 2139</h4>
<p><b>WASHINGTON, D.C.</b> - NASA recently announced that it would be sending 10 astronauts on a rocket
headed for Mars. "We hope to establish a self-sufficient colony on Mars by
using a combination of solar and nuclear energy to power the base and grow
crops that have been bio-engineered to grow in the environment on Mars," a
spokesperson said.</p>
{:else if document == 7}
<h3>Switzerland to Rennovate Bunker System</h3>
<h4>June 29, 2139</h4>
<p><b>BERN</b> - Switzerland recently launched a new initiative
to rennovate its existing bunker system, designed to house millions
of citizens in the case of war.</p>
<!-- TODO: add more documents -->
{:else if document === 15}
<p>I created this in order to warn future civilizations about the plight of this one.</p>
<p>The future rests on your hands - whoever you may be - and whether you choose to
cooperate with each other or not.</p>
{/if}
<span class="page">{document} / {documentcount}</span>
{#if document != 1}
<button on:click={() => document -= 1} style="left:16px">&lt;</button>
{/if}
{#if document < documentcount}
<button on:click={() => document += 1} style="right:16px">&gt;</button>
{/if}
</div>
