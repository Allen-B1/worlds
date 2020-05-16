(function() {
	const HUES = [0, 100, 200, 300, 40, 250];

	class Players extends HTMLElement {
		constructor() {
			super();

			let shadow = this.attachShadow({mode:"closed"});

			let link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/game/players.css");
			shadow.appendChild(link);

			link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/style.css");
			shadow.appendChild(link);

			this.root = document.createElement("div");
			this.root.className = "players";
			shadow.appendChild(this.root);

			this._shadow = shadow;
		}

		setPlayers(players, index) {
			this.root.innerHTML = "";
			for (let i = 0; i < players.length; i++) {
				let playerElem = document.createElement('div');
				playerElem.id = "player-" + i;
				playerElem.className = "player";

				if (i == index) playerElem.classList.add("me");

				let nameElem = document.createElement("div");
				nameElem.innerHTML = players[i];
				nameElem.style.background = "hsl(" + HUES[i] + ",50%,75%)";
				nameElem.className = "name";

				let pollElem = document.createElement("div");
				pollElem.className = "pollution";

				let relElem = document.createElement("div");
				relElem.className = "relationship";

				let incElem = document.createElement("div");
				incElem.className = "rel-action";
				incElem.innerHTML = "+";

				let decElem = document.createElement("div");
				decElem.className = "rel-action";
				decElem.innerHTML = "-";

				playerElem.appendChild(nameElem);
				playerElem.appendChild(pollElem);
				playerElem.appendChild(relElem);
				playerElem.appendChild(incElem);
				playerElem.appendChild(decElem);

				incElem.onclick = () => {
					this.dispatchEvent(new CustomEvent("relationship", {detail:{action:"increase",player:i}}));
				};
				decElem.onclick = () => {
					this.dispatchEvent(new CustomEvent("relationship", {detail:{action:"decrease",player:i}}));
				};

				this.root.appendChild(playerElem);
			}
			this._sort();
		}

		setLosers(losers) {
			for (let index of losers) {
				this._shadow.getElementById("player-" + index).classList.add("loser");
			}
			this._sort();
		}

		setStats(stats) {
			for (let i = 0; i < stats.length; i++) {
				let playerElem = this._shadow.getElementById("player-" + i);
				playerElem.getElementsByClassName("pollution")[0].innerHTML = stats[i].pollution > 0 ? "+" + stats[i].pollution : stats[i].pollution;
			}
		}

		setRelationships(rel) {
			for (let i = 0; i < rel.length; i++) {
				let playerElem = this._shadow.getElementById("player-" + i);
				let symbol = "&#x1F610;";
				if (rel[i] > 0) symbol = "&#x1F603;";
				if (rel[i] < 0) symbol = "&#x1F620;";

				playerElem.getElementsByClassName("relationship")[0].innerHTML = symbol;
			}
		}

		_sort() {
			let playerElems = Array.from(this.root.children);
			playerElems.sort((a, b) => {
				// a < b: -1
				// a > b: 1

				if (a.classList.contains("loser") && !b.classList.contains("loser")) return 1;
				if (b.classList.contains("loser") && !a.classList.contains("loser")) return -1;

				let aPoll = a.querySelector(".pollution").innerHTML | 0;
				let bPoll = b.querySelector(".pollution").innerHTML | 0;
				if (aPoll < bPoll) return -1;
				if (aPoll > bPoll) return 1;

				let aIndex = a.id.slice("player-".length);
				let bIndex = b.id.slice("player-".length);
				return aIndex - bIndex;
			});

			this.root.innerHTML = "";
			for (let elem of playerElems) {
				this.root.appendChild(elem);
			}
		}
	}

	customElements.define("w-players", Players);
})();
