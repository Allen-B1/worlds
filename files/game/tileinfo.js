(function() {
	function costToHTML(cost) {
		let html = "";
		for (let material in cost) {
			html += '<span style="display:inline-block;padding-right:4px;">' + cost[material]/10 + '&nbsp;<span class="icon icon-' + material + '"></span></span> ';
		}
		return html;
	}

	class TileInfo extends HTMLElement {
		init() {
			return fetch("/api/tileinfo.json").then((res) => {
				return res.json();
			}).then((json) => {
				this.tileinfos = json;
				this.categories = new Map();
				for (let type in this.tileinfos) {
					if (this.tileinfos[type].hidden) continue;

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

			let shadow = this.attachShadow({mode:"closed"});

			let link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/game/tileinfo.css");
			shadow.appendChild(link);

			link = document.createElement("link");
			link.setAttribute("rel", "stylesheet");
			link.setAttribute("href", "/style.css");
			shadow.appendChild(link);

			const root = document.createElement("div");
			root.className = "root";
			shadow.appendChild(root);

			this.onkeydown = function(e) {
				let selected = shadow.querySelector(".selected");

				let newSelected = null;
				switch(e.code) {
				case "KeyD":
					newSelected = selected.nextElementSibling.nextElementSibling;
					break;
				case "KeyA":
					newSelected = selected.previousElementSibling.previousElementSibling;
					break;
				case "KeyW":
					newSelected = selected.parentNode.previousElementSibling.children[1];
					break;
				case "KeyS":
					newSelected = selected.parentNode.nextElementSibling.children[1];
					break;
				case "Enter":
					selected.click();
					break;
				}
				if (newSelected != selected && newSelected != null && newSelected.classList.contains("item")) {
					selected.classList.remove("selected");
					newSelected.classList.add("selected");
					newSelected.scrollIntoView();
				}
			};

			this.init().then(() => {
				const itemsElem = document.createElement("div");
				itemsElem.className = "items";

				root.appendChild(itemsElem);

				const categoriesElem = document.createElement("div");
				categoriesElem.className = "categories";
				for (let category of this.categories.keys()) {
					let categoryElem = document.createElement("div");
					categoryElem.id = "category-" + category;	
					categoryElem.className = "category";

					let nameElem = document.createElement("h3");
					nameElem.innerHTML = category[0].toUpperCase() + category.slice(1);
					categoryElem.appendChild(nameElem);

					let selected = shadow.querySelectorAll(".selected");
					for (let item of selected) {
						item.classList.remove("selected");
					}

					let items = this.categories.get(category);
					for (let item of items) {
						let itemElem = document.createElement("div");
						itemElem.className = "item";

						let inner = document.createElement("span");
						inner.innerHTML = this.tileinfos[item].strength || "1";
						inner.style.background = "url(/tiles/" + item + ".svg)";
						itemElem.appendChild(inner);

						itemElem.onclick = () => {
							this.dispatchEvent(new CustomEvent("make", {detail:item}));
						};

						categoryElem.appendChild(itemElem);

						{
							let info = this.tileinfos[item];
							let infoElem = document.createElement("div");
							infoElem.className = "info";

							let nameElem = document.createElement("h4");
							nameElem.innerHTML = info.name;
							infoElem.appendChild(nameElem);

							if (info.description) {
								let descElem = document.createElement("div");
								descElem.innerHTML = info.description;
								descElem.className = "description";
								infoElem.appendChild(descElem);
							}

							let costElem = document.createElement("div");
							costElem.innerHTML = costToHTML(info.cost);
							infoElem.appendChild(costElem);

							categoryElem.appendChild(infoElem);
						}
					}

					itemsElem.appendChild(categoryElem);
				}

				shadow.querySelector(".item").classList.add("selected");
			});
		}
	}

	customElements.define("w-tileinfo", TileInfo);
})();
