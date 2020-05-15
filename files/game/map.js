(function() {
	class Map extends HTMLElement {
		constructor() {
			super();

			let width = this.getAttribute("width") | 0;
			let height = this.getAttribute("height") | 0;

			this.style.width = width * 32 + "px";
			this.style.height = height * 32 + "px";

			this.shadow = this.attachShadow({mode:"open"});

			const linkElem = document.createElement('link');
			linkElem.setAttribute('rel', 'stylesheet');
			linkElem.setAttribute('href', '/game/map.css');

			this.shadow.appendChild(linkElem);

			var root = document.createElement("div");
			root.className = "root";
			root.setAttribute("tabIndex", -1);
			this.shadow.appendChild(root);

			root.style.width = width * 32 + "px";
			root.style.height = height * 32 + "px";

			for (let i = 0; i < width * height; i++) {
				let tile = document.createElement("div");
				tile.className = "tile";
				tile.style.left = (i % width) * 32 + "px";
				tile.style.top = ((i / width)|0) * 32 + "px";
				tile.id = "tile-" + i;

				let inner = document.createElement("span");
				inner.className = "inner";
				tile.appendChild(inner);

				tile.addEventListener("click", function() {
					for (let elem of root.querySelectorAll("[selected=\"\"]")) {
						elem.removeAttribute("selected");
					}
					if (tile.hasAttribute("selected")) {
						tile.removeAttribute("selected");
					} else {
						tile.setAttribute("selected", "");
					}
				});
				root.appendChild(tile);
			}

			let self = this;
			root.addEventListener("keydown", function(e) {
				switch(e.code) {
				case "KeyW":
				case "KeyA":
				case "KeyS":
				case "KeyD":
					let tile = self.selected();
					let toTile;
					if (e.code == "KeyW") toTile = tile - width;
					if (e.code == "KeyS") toTile = tile + width;
					if (e.code == "KeyA") toTile = tile - 1;
					if (e.code == "KeyD") toTile = tile + 1;

					console.log(tile + " => " + toTile);

					for (let elem of root.querySelectorAll("[selected=\"\"]")) {
						elem.removeAttribute("selected");
					}
					self.tileAt(toTile).setAttribute("selected", "");

					self.dispatchEvent(new CustomEvent("move", {detail:{from:tile,to:toTile}}));
					break;
				}
			})
		}

		selected() {
			return this.shadow.querySelector("[selected=\"\"]").id.slice(5) | 0;
		}

		tileAt(index) {
			return this.shadow.getElementById("tile-" + index);
		}
	}

	customElements.define("w-map", Map);
})();
