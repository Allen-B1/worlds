(function() {
	class TileInfo extends HTMLElement {
		init() {
			return fetch("/api/tileinfo.json").then((res) => {
				return res.json();
			}).then((json) => {
				this.tileinfos = json;
				this.categories = new Map();
				for (let type in this.tileinfos) {
					let set = this.categories.get(this.tileinfos[type].category);
					if (!set) set = [];
					set.push(type);
					this.categories.set(this.tileinfos[type].category, set);
				}
				console.log(this.categories);
			});
		}

		constructor() {
			super();

			this.init().then(() => {
				let shadow = this.attachShadow({mode:"closed"});

				let link = document.createElement("link");
				link.setAttribute("rel", "stylesheet");
				link.setAttribute("href", "/game/tileinfo.css");
				shadow.appendChild(link);

				const root = document.createElement("div");
				root.className = "root";
				shadow.appendChild(root);

				const itemsElem = document.createElement("div");
				itemsElem.className = "items";
				root.appendChild(itemsElem);

				const categoriesElem = document.createElement("div");
				for (let category of this.categories.keys()) {
					let categoryElem = document.createElement("div");
					categoryElem.id = "category-" + category;	
					categoryElem.className = "category";
					categoryElem.innerHTML = category[0].toUpperCase() + category.slice(1);

					categoryElem.addEventListener("click", () => {
						let selected = shadow.querySelectorAll(".selected");
						for (let item of selected) {
							item.classList.remove("selected");
						}

						itemsElem.innerHTML = "";
						categoryElem.classList.add("selected");

						let items = this.categories.get(category);
						for (let item of items) {
							let itemElem = document.createElement("div");
							itemElem.className = "item";
							let inner = document.createElement("span");
							inner.innerHTML = "1";
							inner.style.background = "url(/tiles/" + item + ".svg)";
							itemElem.appendChild(inner);

							itemElem.onclick = () => {
								this.dispatchEvent(new CustomEvent("make", {detail:item}));
							};

							itemsElem.appendChild(itemElem);
						}
					});

					categoriesElem.appendChild(categoryElem);
				}
				categoriesElem.className = "categories";
				root.appendChild(categoriesElem);
			});
		}
	}

	customElements.define("w-tileinfo", TileInfo);
})();
