(function() {
	class Stats extends HTMLElement {
		constructor() {
			super();

			this.shadow = this.attachShadow({mode:"closed"});

			let link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/game/stats.css");
			this.shadow.appendChild(link);

			link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/style.css");
			this.shadow.appendChild(link);

			this.table = document.createElement("table");
			this.shadow.appendChild(this.table);
		}

		add(key, class_) {
			let row = this.shadow.getElementById("key-" + key);
			if (row === null) {
				row = this.table.insertRow();
				row.id = "key-" + key;
				let th = document.createElement("th");
				th.innerHTML = key;
				row.appendChild(th);
				row.appendChild(document.createElement("td"));
				console.log(row);
			}
			row.className = class_;
		}

		set(key, value) {
			let row = this.shadow.getElementById("key-" + key);
			if (row === null) {
				throw new Error("key '" + key + "' is not defined");
			}
			row.querySelector("td").innerHTML = value;
		}

		remove(key) {
			let row = this.shadow.getElementById("key-" + key);
			row.remove();
		}
	}

	customElements.define("w-stats", Stats);
})();


