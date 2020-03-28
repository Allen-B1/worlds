<script>
export let documents;

const maxDocuments = 4;

let documentcount;
$: documentcount = Math.min(documents, maxDocuments);

let document = 1;
</script>

<style>
div {
	width: 300px;
	height: 300px;
	position: fixed;
	top: 50%; left: 50%;
	margin-top: -150px; margin-left: -150px;
	background: #D6D4C1; border: 2px solid #ADA984;
	z-index: 4;
	padding: 16px;
}
h3 {
	font-size: 16px;
	margin-top: 0;
	margin-bottom: 8px;
	text-align: center;
}
p {
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

<div>
{#if document === 1}
<h3>Sea level rise worry city officials</h3>
<p><b>AMSTERDAM</b> - A recent report that came out last Wednesday
found that sea levels were rising at an alarming 1cm per day, much higher than previous estimates.
City officials in Amsterdam are worried that the city's complex sea-resistance system is not going to hold up
against this alarming rate. "We did not forsee that this system would need to resist sea levels this high," an architect said
who wished to remain anonymous.</p>
{:else if document === 2}
<h3>Scientist Publicly Challenges Darwinism</h3>
<p><b>BEIJING</b> - Scientist Liao Shi blamed scientist's acceptance of Darwin's theory of evolution
for the recent changes to the environment. "The heavens are not happy with our acceptance of blasphemous
theories," he said at a conference last Friday.</p>
{:else if document === 3}
<h3>United States and China blaming each other for climate change</h3>
<p><b>WASHINGTON, D.C.</b> - <span class="blur-s">The United States</span> <span class="blur-m">and China have been
throwing attacks at</span> <span class="blur">each other for the past week. It's important to realize that eu iaculis mauris. 
Cras feugiat, turpis eu semper aliquet, nulla arcu tincidunt erat, sed dapibus quam nisl sit
 amet leo. Vivamus eget sollicitudin leo, sed luctus sem. 
Aenean nulla orci, tempor ac euismod eget, gravida ut dolor.</span></p>
<!-- TODO: add more documents -->
{:else if document === 4}
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
