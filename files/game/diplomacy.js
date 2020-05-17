(function() {
	class Diplomacy extends HTMLElement {
		constructor() {
			super();

			let shadow = this.attachShadow({mode:"closed"});

			let link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/game/diplomacy.css");
			shadow.appendChild(link);

			this.root = document.createElement("div");
			this.root.className = "root";
			shadow.appendChild(this.root);

			this.root.innerHTML = "<h4>Diplomacy</h4>";
		}

		_add(playerIndex, playerName, class_, message, acceptable, rejectable) {
			let messageElem = document.createElement("div");
			messageElem.className = "message " + class_;

			let playerElem = document.createElement("div");
			playerElem.innerHTML = playerName;
			playerElem.style.background = "hsl(" + HUES[playerIndex] + ",50%,75%)";
			playerElem.className = "player";
			let textElem = document.createElement("div");
			textElem.innerHTML = message;
			textElem.className = "content";

			messageElem.appendChild(playerElem);
			messageElem.appendChild(textElem);

			if (acceptable) {
				let acceptElem = document.createElement("div");
				acceptElem.innerHTML = "&#x2713;";
				acceptElem.className = "action";
				acceptElem.onclick = () => {
					this.dispatchEvent(new CustomEvent("accept", {detail:playerIndex}));
				};
				messageElem.appendChild(acceptElem);
			}

			if (rejectable) {
				let closeElem = document.createElement("div");
				closeElem.innerHTML = "&times;";
				closeElem.className = "action";
				closeElem.onclick = () => messageElem.remove();
				messageElem.appendChild(closeElem);
			}

			this.root.appendChild(messageElem);
		}

		setRequests(names, status, requests) {
			let prev = this.root.getElementsByClassName("request");
			for (let item of prev) {
				item.remove();
			}

			for (let player of requests) {
				this._add(player, names[player], "request", status[player] < 0 ? "Peace" : "Allies", true, false);
			}
		}

		addWar(index, name) {
			this._add(index, name, "war", "War", false, true);
		}
	}

	customElements.define("w-diplomacy", Diplomacy);
})();
