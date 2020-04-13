var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(html, anchor = null) {
            this.e = element('div');
            this.a = anchor;
            this.u(html);
        }
        m(target, anchor = null) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(target, this.n[i], anchor);
            }
            this.t = target;
        }
        u(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        p(html) {
            this.d();
            this.u(html);
            this.m(this.t, this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    const sizes = {
    	earth: 48,
    	mars: 24
    };

    const tileKeys = [1,2,3,4,5,6,7,8,9,0,"-"];

    const tileTypes = {
    	"1": "core",
    	"2": "camp",
    	"3": "kiln",
    	"4": "mine1",
    	"5": "mine2",
    	"6": "mine3",
    	"7": "bridge",
    	"8": "copper-wall",
    	"9": "iron-wall",
    	"0": "launcher",
    	"-": "cleaner"
    };

    const materialSyms = {
    	"brick": "Brk",
    	"copper": "Cu",
    	"iron": "Fe",
    	"gold": "Au",
    	"uranium": "U"
    };

    /* svelte/Tile.svelte generated by Svelte v3.20.1 */

    function create_fragment(ctx) {
    	let div;
    	let span;

    	let t_value = (/*territory*/ ctx[2] == -1 && !/*army*/ ctx[0] || /*army*/ ctx[0] == undefined
    	? ""
    	: /*army*/ ctx[0]) + "";

    	let t;
    	let div_class_value;
    	let div_style_value;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			span = element("span");
    			t = text(t_value);
    			attr(span, "class", "svelte-1swql8f");
    			attr(div, "class", div_class_value = "" + (null_to_empty("deposit-" + /*deposit*/ ctx[4] + " terrain-" + /*terrain*/ ctx[1] + " tiletype-" + /*tiletype*/ ctx[3] + " territory-" + /*territory*/ ctx[2] + (/*selected*/ ctx[5] ? " selected" : "")) + " svelte-1swql8f"));
    			attr(div, "style", div_style_value = "top:" + 32 * /*y*/ ctx[7] + "px;left:" + 32 * /*x*/ ctx[6] + "px;");
    		},
    		m(target, anchor, remount) {
    			insert(target, div, anchor);
    			append(div, span);
    			append(span, t);
    			if (remount) dispose();
    			dispose = listen(div, "click", /*click*/ ctx[8]);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*territory, army*/ 5 && t_value !== (t_value = (/*territory*/ ctx[2] == -1 && !/*army*/ ctx[0] || /*army*/ ctx[0] == undefined
    			? ""
    			: /*army*/ ctx[0]) + "")) set_data(t, t_value);

    			if (dirty & /*deposit, terrain, tiletype, territory, selected*/ 62 && div_class_value !== (div_class_value = "" + (null_to_empty("deposit-" + /*deposit*/ ctx[4] + " terrain-" + /*terrain*/ ctx[1] + " tiletype-" + /*tiletype*/ ctx[3] + " territory-" + /*territory*/ ctx[2] + (/*selected*/ ctx[5] ? " selected" : "")) + " svelte-1swql8f"))) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty & /*y, x*/ 192 && div_style_value !== (div_style_value = "top:" + 32 * /*y*/ ctx[7] + "px;left:" + 32 * /*x*/ ctx[6] + "px;")) {
    				attr(div, "style", div_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { tile } = $$props;
    	let { army } = $$props;
    	let { terrain } = $$props;
    	let { territory } = $$props;
    	let { tiletype } = $$props;
    	let { deposit } = $$props;
    	let { selected } = $$props;
    	let x, y;

    	function click() {
    		dispatch("click", tile);
    	}

    	$$self.$set = $$props => {
    		if ("tile" in $$props) $$invalidate(9, tile = $$props.tile);
    		if ("army" in $$props) $$invalidate(0, army = $$props.army);
    		if ("terrain" in $$props) $$invalidate(1, terrain = $$props.terrain);
    		if ("territory" in $$props) $$invalidate(2, territory = $$props.territory);
    		if ("tiletype" in $$props) $$invalidate(3, tiletype = $$props.tiletype);
    		if ("deposit" in $$props) $$invalidate(4, deposit = $$props.deposit);
    		if ("selected" in $$props) $$invalidate(5, selected = $$props.selected);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*tile*/ 512) {
    			 {
    				if (tile >= sizes.earth * sizes.earth) {
    					$$invalidate(6, x = (tile - sizes.earth * sizes.earth) % sizes.mars);
    					$$invalidate(7, y = (tile - sizes.earth * sizes.earth) / sizes.mars | 0);
    				} else {
    					$$invalidate(6, x = tile % sizes.earth);
    					$$invalidate(7, y = tile / sizes.earth | 0);
    				}
    			}
    		}
    	};

    	return [army, terrain, territory, tiletype, deposit, selected, x, y, click, tile];
    }

    class Tile extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			tile: 9,
    			army: 0,
    			terrain: 1,
    			territory: 2,
    			tiletype: 3,
    			deposit: 4,
    			selected: 5
    		});
    	}
    }

    /* svelte/Map.svelte generated by Svelte v3.20.1 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (112:1) {#each tiles as tile}
    function create_each_block(ctx) {
    	let current;

    	const tile = new Tile({
    			props: {
    				selected: /*selected*/ ctx[0].has(/*tile*/ ctx[14]),
    				tile: /*tile*/ ctx[14],
    				terrain: /*terrain*/ ctx[3][/*tile*/ ctx[14]],
    				army: /*armies*/ ctx[2][/*tile*/ ctx[14]],
    				territory: /*territory*/ ctx[4][/*tile*/ ctx[14]],
    				deposit: /*deposits*/ ctx[1][/*tile*/ ctx[14]],
    				tiletype: /*tiletypes*/ ctx[5][/*tile*/ ctx[14]]
    			}
    		});

    	tile.$on("click", /*select*/ ctx[8]);

    	return {
    		c() {
    			create_component(tile.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(tile, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const tile_changes = {};
    			if (dirty & /*selected, tiles*/ 65) tile_changes.selected = /*selected*/ ctx[0].has(/*tile*/ ctx[14]);
    			if (dirty & /*tiles*/ 64) tile_changes.tile = /*tile*/ ctx[14];
    			if (dirty & /*terrain, tiles*/ 72) tile_changes.terrain = /*terrain*/ ctx[3][/*tile*/ ctx[14]];
    			if (dirty & /*armies, tiles*/ 68) tile_changes.army = /*armies*/ ctx[2][/*tile*/ ctx[14]];
    			if (dirty & /*territory, tiles*/ 80) tile_changes.territory = /*territory*/ ctx[4][/*tile*/ ctx[14]];
    			if (dirty & /*deposits, tiles*/ 66) tile_changes.deposit = /*deposits*/ ctx[1][/*tile*/ ctx[14]];
    			if (dirty & /*tiletypes, tiles*/ 96) tile_changes.tiletype = /*tiletypes*/ ctx[5][/*tile*/ ctx[14]];
    			tile.$set(tile_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(tile.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(tile.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(tile, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div;
    	let current;
    	let each_value = /*tiles*/ ctx[6];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div, "class", "svelte-10afe2e");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			/*div_binding*/ ctx[13](div);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*selected, tiles, terrain, armies, territory, deposits, tiletypes, select*/ 383) {
    				each_value = /*tiles*/ ctx[6];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			/*div_binding*/ ctx[13](null);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { planet = "earth" } = $$props;
    	let { deposits } = $$props;
    	let { armies } = $$props;
    	let { terrain } = $$props;
    	let { territory } = $$props;
    	let { tiletypes } = $$props;
    	let size, tiles, offset;
    	console.log(tiles);
    	let elem;
    	let { selected = new Set() } = $$props;

    	function select(evt) {
    		selected.clear();
    		selected.add(evt.detail);
    		$$invalidate(0, selected);
    	}

    	document.addEventListener("keydown", function (e) {
    		switch (e.code) {
    			case "KeyW":
    			case "KeyA":
    			case "KeyS":
    			case "KeyD":
    				if (selected.size != 0) {
    					let tile = selected.values().next().value;
    					let toTile;
    					if (e.code == "KeyW") toTile = tile - size;
    					if (e.code == "KeyS") toTile = tile + size;
    					if (e.code == "KeyA") toTile = tile - 1;
    					if (e.code == "KeyD") toTile = tile + 1;

    					if (e.code == "KeyA" || e.code == "KeyD") {
    						if (Math.floor((toTile - offset) / size) != Math.floor((tile - offset) / size)) {
    							return;
    						}
    					} else {
    						if (toTile >= offset + size * size || toTile < offset) {
    							return;
    						}
    					}

    					dispatch("move", { from: tile, to: toTile });
    					selected.clear();
    					selected.add(toTile);
    					$$invalidate(0, selected);
    				}
    				return;
    			case "Backspace":
    				for (let tile of selected) {
    					dispatch("make", { tile, type: "" });
    				}
    				return;
    		}

    		if (e.key in tileTypes) {
    			for (let tile of selected) {
    				dispatch("make", { tile, type: tileTypes[e.key] });
    			}
    		}

    		if (e.key == "g") {
    			for (let tile of selected) {
    				dispatch("make", { tile, type: "greenhouse" });
    			}
    		}

    		if (e.key == "l") {
    			let tile = selected.values().next().value;
    			dispatch("launch", { tile });
    		}

    		if (e.key == "n") {
    			let tile = selected.values().next().value;
    			dispatch("nuke", { tile });
    		}
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(7, elem = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("planet" in $$props) $$invalidate(9, planet = $$props.planet);
    		if ("deposits" in $$props) $$invalidate(1, deposits = $$props.deposits);
    		if ("armies" in $$props) $$invalidate(2, armies = $$props.armies);
    		if ("terrain" in $$props) $$invalidate(3, terrain = $$props.terrain);
    		if ("territory" in $$props) $$invalidate(4, territory = $$props.territory);
    		if ("tiletypes" in $$props) $$invalidate(5, tiletypes = $$props.tiletypes);
    		if ("selected" in $$props) $$invalidate(0, selected = $$props.selected);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*planet, offset, size*/ 3584) {
    			 {
    				$$invalidate(10, size = planet == "earth" ? sizes.earth : sizes.mars);
    				$$invalidate(11, offset = planet == "earth" ? 0 : sizes.earth * sizes.earth);

    				$$invalidate(6, tiles = planet == "earth"
    				? [...Array(sizes.earth * sizes.earth).keys()]
    				: [...Array(sizes.mars * sizes.mars).keys()].map(i => i + offset));

    				console.log(size);
    			}
    		}

    		if ($$self.$$.dirty & /*elem, size*/ 1152) {
    			 {
    				if (elem) {
    					$$invalidate(7, elem.style.width = $$invalidate(7, elem.style.height = size * 32 + "px", elem), elem);
    				}
    			}
    		}
    	};

    	return [
    		selected,
    		deposits,
    		armies,
    		terrain,
    		territory,
    		tiletypes,
    		tiles,
    		elem,
    		select,
    		planet,
    		size,
    		offset,
    		dispatch,
    		div_binding
    	];
    }

    class Map$1 extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			planet: 9,
    			deposits: 1,
    			armies: 2,
    			terrain: 3,
    			territory: 4,
    			tiletypes: 5,
    			selected: 0
    		});
    	}
    }

    /* svelte/Stats.svelte generated by Svelte v3.20.1 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (23:1) {#each labels as label}
    function create_each_block$1(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*label*/ ctx[4][0] + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = (/*stats*/ ctx[0][/*label*/ ctx[4][1]] | 0) + "";
    	let t2;
    	let t3;
    	let tr_class_value;

    	return {
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			attr(td0, "class", "svelte-rbfwso");
    			attr(td1, "class", "svelte-rbfwso");
    			attr(tr, "class", tr_class_value = /*label*/ ctx[4][2] || "");
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*labels*/ 2 && t0_value !== (t0_value = /*label*/ ctx[4][0] + "")) set_data(t0, t0_value);
    			if (dirty & /*stats, labels*/ 3 && t2_value !== (t2_value = (/*stats*/ ctx[0][/*label*/ ctx[4][1]] | 0) + "")) set_data(t2, t2_value);

    			if (dirty & /*labels*/ 2 && tr_class_value !== (tr_class_value = /*label*/ ctx[4][2] || "")) {
    				attr(tr, "class", tr_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let table;
    	let table_style_value;
    	let each_value = /*labels*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			table = element("table");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(table, "style", table_style_value = "left:" + /*x*/ ctx[2] + "px;top:" + /*y*/ ctx[3] + "px");
    			attr(table, "class", "svelte-rbfwso");
    		},
    		m(target, anchor) {
    			insert(target, table, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*labels, stats*/ 3) {
    				each_value = /*labels*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*x, y*/ 12 && table_style_value !== (table_style_value = "left:" + /*x*/ ctx[2] + "px;top:" + /*y*/ ctx[3] + "px")) {
    				attr(table, "style", table_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(table);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { stats = {} } = $$props;
    	let { labels = [] } = $$props;
    	let { x } = $$props, { y } = $$props;

    	$$self.$set = $$props => {
    		if ("stats" in $$props) $$invalidate(0, stats = $$props.stats);
    		if ("labels" in $$props) $$invalidate(1, labels = $$props.labels);
    		if ("x" in $$props) $$invalidate(2, x = $$props.x);
    		if ("y" in $$props) $$invalidate(3, y = $$props.y);
    	};

    	return [stats, labels, x, y];
    }

    class Stats extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { stats: 0, labels: 1, x: 2, y: 3 });
    	}
    }

    /* svelte/TileInfos.svelte generated by Svelte v3.20.1 */

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (36:1) {#if info}
    function create_if_block(ctx) {
    	let tr;
    	let td0;
    	let kbd;
    	let t0_value = /*info*/ ctx[2].key + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*info*/ ctx[2].name + "";
    	let t2;
    	let t3;
    	let t4;
    	let if_block = !/*minimized*/ ctx[1] && create_if_block_1(ctx);

    	return {
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			kbd = element("kbd");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			attr(td0, "class", "svelte-1k4icsq");
    			attr(td1, "class", "svelte-1k4icsq");
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, kbd);
    			append(kbd, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    			if (if_block) if_block.m(tr, null);
    			append(tr, t4);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*infos*/ 1 && t0_value !== (t0_value = /*info*/ ctx[2].key + "")) set_data(t0, t0_value);
    			if (dirty & /*infos*/ 1 && t2_value !== (t2_value = /*info*/ ctx[2].name + "")) set_data(t2, t2_value);

    			if (!/*minimized*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(tr, t4);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    			if (if_block) if_block.d();
    		}
    	};
    }

    // (40:2) {#if !minimized}
    function create_if_block_1(ctx) {
    	let td;
    	let raw_value = costToHTML(/*info*/ ctx[2].cost) + "";

    	return {
    		c() {
    			td = element("td");
    			attr(td, "class", "svelte-1k4icsq");
    		},
    		m(target, anchor) {
    			insert(target, td, anchor);
    			td.innerHTML = raw_value;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*infos*/ 1 && raw_value !== (raw_value = costToHTML(/*info*/ ctx[2].cost) + "")) td.innerHTML = raw_value;		},
    		d(detaching) {
    			if (detaching) detach(td);
    		}
    	};
    }

    // (35:0) {#each infos as info}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*info*/ ctx[2] && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (/*info*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let table;
    	let each_value = /*infos*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	return {
    		c() {
    			table = element("table");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(table, "class", "svelte-1k4icsq");
    		},
    		m(target, anchor) {
    			insert(target, table, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*costToHTML, infos, minimized*/ 3) {
    				each_value = /*infos*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(table);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function costToHTML(costs) {
    	var str = "";

    	for (var material in costs) {
    		str += "<span class=\"text-" + material + "\">" + costs[material] + " " + materialSyms[material] + "</span> ";
    	}

    	return str;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { infos } = $$props;
    	let { minimized } = $$props;

    	$$self.$set = $$props => {
    		if ("infos" in $$props) $$invalidate(0, infos = $$props.infos);
    		if ("minimized" in $$props) $$invalidate(1, minimized = $$props.minimized);
    	};

    	return [infos, minimized];
    }

    class TileInfos extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { infos: 0, minimized: 1 });
    	}
    }

    /* svelte/Players.svelte generated by Svelte v3.20.1 */

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (104:2) {#if player != userIndex}
    function create_if_block$1(ctx) {
    	let td;
    	let t0_value = /*RELATIONSHIP_SYMBOLS*/ ctx[5][/*relationships*/ ctx[2][/*player*/ ctx[9]]] + "";
    	let t0;
    	let t1;
    	let show_if = /*losers*/ ctx[0].indexOf(/*player*/ ctx[9]) == -1;
    	let if_block_anchor;
    	let if_block = show_if && create_if_block_1$1(ctx);

    	return {
    		c() {
    			td = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(td, "class", "relationship svelte-1svw7vf");
    		},
    		m(target, anchor) {
    			insert(target, td, anchor);
    			append(td, t0);
    			insert(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*relationships, playerOrder*/ 20 && t0_value !== (t0_value = /*RELATIONSHIP_SYMBOLS*/ ctx[5][/*relationships*/ ctx[2][/*player*/ ctx[9]]] + "")) set_data(t0, t0_value);
    			if (dirty & /*losers, playerOrder*/ 17) show_if = /*losers*/ ctx[0].indexOf(/*player*/ ctx[9]) == -1;

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(td);
    			if (detaching) detach(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (106:2) {#if losers.indexOf(player) == -1}
    function create_if_block_1$1(ctx) {
    	let td0;
    	let t1;
    	let td1;
    	let dispose;

    	return {
    		c() {
    			td0 = element("td");
    			td0.textContent = "↑";
    			t1 = space();
    			td1 = element("td");
    			td1.textContent = "↓";
    			attr(td0, "class", "action svelte-1svw7vf");
    			attr(td1, "class", "action svelte-1svw7vf");
    		},
    		m(target, anchor, remount) {
    			insert(target, td0, anchor);
    			insert(target, t1, anchor);
    			insert(target, td1, anchor);
    			if (remount) run_all(dispose);
    			dispose = [listen(td0, "click", /*inc*/ ctx[6]), listen(td1, "click", /*dec*/ ctx[7])];
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(td0);
    			if (detaching) detach(t1);
    			if (detaching) detach(td1);
    			run_all(dispose);
    		}
    	};
    }

    // (101:1) {#each playerOrder as player}
    function create_each_block$3(ctx) {
    	let tr;
    	let td;
    	let t0_value = /*players*/ ctx[1][/*player*/ ctx[9]] + "";
    	let t0;
    	let t1;
    	let t2;
    	let tr_class_value;
    	let if_block = /*player*/ ctx[9] != /*userIndex*/ ctx[3] && create_if_block$1(ctx);

    	return {
    		c() {
    			tr = element("tr");
    			td = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			attr(td, "class", "name svelte-1svw7vf");

    			attr(tr, "class", tr_class_value = "" + (null_to_empty("player-" + /*player*/ ctx[9] + " " + (/*losers*/ ctx[0].indexOf(/*player*/ ctx[9]) != -1
    			? "loser "
    			: "") + (/*userIndex*/ ctx[3] === /*player*/ ctx[9]
    			? "self "
    			: "")) + " svelte-1svw7vf"));
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td);
    			append(td, t0);
    			append(tr, t1);
    			if (if_block) if_block.m(tr, null);
    			append(tr, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*players, playerOrder*/ 18 && t0_value !== (t0_value = /*players*/ ctx[1][/*player*/ ctx[9]] + "")) set_data(t0, t0_value);

    			if (/*player*/ ctx[9] != /*userIndex*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(tr, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*playerOrder, losers, userIndex*/ 25 && tr_class_value !== (tr_class_value = "" + (null_to_empty("player-" + /*player*/ ctx[9] + " " + (/*losers*/ ctx[0].indexOf(/*player*/ ctx[9]) != -1
    			? "loser "
    			: "") + (/*userIndex*/ ctx[3] === /*player*/ ctx[9]
    			? "self "
    			: "")) + " svelte-1svw7vf"))) {
    				attr(tr, "class", tr_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let table;
    	let each_value = /*playerOrder*/ ctx[4];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	return {
    		c() {
    			table = element("table");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(table, "class", "svelte-1svw7vf");
    		},
    		m(target, anchor) {
    			insert(target, table, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*playerOrder, losers, userIndex, dec, inc, RELATIONSHIP_SYMBOLS, relationships, players*/ 255) {
    				each_value = /*playerOrder*/ ctx[4];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(table);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { players = [] } = $$props;
    	let { losers = [] } = $$props;
    	let { relationships = [] } = $$props;
    	let { userIndex } = $$props;
    	const dispatch = createEventDispatcher();
    	let playerOrder = players;
    	const RELATIONSHIP_SYMBOLS = { "-1": "E", "0": "N", "1": "C", "2": "A" };

    	function inc(evt) {
    		let i = evt.target.parentNode.className.indexOf("player-") + ("player-").length;
    		let player = evt.target.parentNode.className[i];
    		dispatch("status", { player, action: "upgrade" });
    	}

    	function dec(evt) {
    		let i = evt.target.parentNode.className.indexOf("player-") + ("player-").length;
    		let player = evt.target.parentNode.className[i];
    		dispatch("status", { player, action: "downgrade" });
    	}

    	$$self.$set = $$props => {
    		if ("players" in $$props) $$invalidate(1, players = $$props.players);
    		if ("losers" in $$props) $$invalidate(0, losers = $$props.losers);
    		if ("relationships" in $$props) $$invalidate(2, relationships = $$props.relationships);
    		if ("userIndex" in $$props) $$invalidate(3, userIndex = $$props.userIndex);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*losers, players, playerOrder*/ 19) {
    			 {
    				$$invalidate(4, playerOrder = []);
    				if (losers == null) $$invalidate(0, losers = []);

    				for (let i = 0; i < players.length; i++) {
    					if (losers.indexOf(i) == -1) {
    						playerOrder.push(i);
    					}
    				}

    				$$invalidate(4, playerOrder = playerOrder.concat(losers));
    				(($$invalidate(4, playerOrder), $$invalidate(0, losers)), $$invalidate(1, players));
    			}
    		}
    	};

    	return [
    		losers,
    		players,
    		relationships,
    		userIndex,
    		playerOrder,
    		RELATIONSHIP_SYMBOLS,
    		inc,
    		dec
    	];
    }

    class Players extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			players: 1,
    			losers: 0,
    			relationships: 2,
    			userIndex: 3
    		});
    	}
    }

    /* svelte/Tutorial.svelte generated by Svelte v3.20.1 */

    function create_if_block$2(ctx) {
    	let button;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Next";
    			attr(button, "class", "svelte-1sja3mo");
    		},
    		m(target, anchor, remount) {
    			insert(target, button, anchor);
    			if (remount) dispose();
    			dispose = listen(button, "click", /*click_handler*/ ctx[13]);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let div;
    	let html_tag;
    	let t;
    	let if_block = /*canSkip*/ ctx[2][/*stage*/ ctx[0]] && create_if_block$2(ctx);

    	return {
    		c() {
    			div = element("div");
    			t = space();
    			if (if_block) if_block.c();
    			html_tag = new HtmlTag(/*text*/ ctx[1], t);
    			attr(div, "class", "svelte-1sja3mo");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			html_tag.m(div);
    			append(div, t);
    			if (if_block) if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*text*/ 2) html_tag.p(/*text*/ ctx[1]);

    			if (/*canSkip*/ ctx[2][/*stage*/ ctx[0]]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { selected = new Set() } = $$props;
    	let { userIndex } = $$props;
    	let { planet } = $$props;
    	let { deposits } = $$props;
    	let { armies } = $$props;
    	let { terrain } = $$props;
    	let { territory } = $$props;
    	let { tiletypes } = $$props;
    	const canSkip = { 2: true, 5: true, 9: true };
    	let selectedTile;
    	let stage = 0;
    	let text;
    	let stageInfo = [];
    	const click_handler = () => $$invalidate(0, stage += 1);

    	$$self.$set = $$props => {
    		if ("selected" in $$props) $$invalidate(3, selected = $$props.selected);
    		if ("userIndex" in $$props) $$invalidate(4, userIndex = $$props.userIndex);
    		if ("planet" in $$props) $$invalidate(5, planet = $$props.planet);
    		if ("deposits" in $$props) $$invalidate(6, deposits = $$props.deposits);
    		if ("armies" in $$props) $$invalidate(7, armies = $$props.armies);
    		if ("terrain" in $$props) $$invalidate(8, terrain = $$props.terrain);
    		if ("territory" in $$props) $$invalidate(9, territory = $$props.territory);
    		if ("tiletypes" in $$props) $$invalidate(10, tiletypes = $$props.tiletypes);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*selected*/ 8) {
    			 {
    				$$invalidate(11, selectedTile = selected.values().next().value);
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, selectedTile, territory, userIndex, stageInfo*/ 7697) {
    			 if (stage == 0) {
    				if (tiletypes[selectedTile] == "core" && territory[selectedTile] == userIndex) {
    					$$invalidate(12, stageInfo[0] = true, stageInfo);
    				}

    				if (tiletypes[selectedTile] != "core" && stageInfo[0]) {
    					$$invalidate(0, stage += 1);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 1) {
    				let count = 0;

    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "kiln" && territory[tile] == userIndex) count += 1;
    				}

    				if (count >= 2) {
    					$$invalidate(0, stage += 1);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 3) {
    				let count = 0;

    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "kiln" && territory[tile] == userIndex) count += 1;
    				}

    				if (count >= 5) {
    					$$invalidate(0, stage += 1);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 4) {
    				let count = 0;

    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "camp" && territory[tile] == userIndex) count += 1;
    				}

    				if (count >= 3) {
    					$$invalidate(0, stage = 5);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 6) {
    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "mine1" && territory[tile] == userIndex) {
    						$$invalidate(0, stage = 7);
    						break;
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 7) {
    				let count = 0;

    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "mine1" && territory[tile] == userIndex) {
    						count++;
    						break;
    					}
    				}

    				if (count >= 4) {
    					$$invalidate(0, stage = 8);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, deposits, territory, userIndex*/ 1617) {
    			 if (stage == 8) {
    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "mine2" && deposits[tile] == "iron" && territory[tile] == userIndex) {
    						$$invalidate(0, stage = 8);
    						break;
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 10) {
    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "mine3" && territory[tile] == userIndex) {
    						$$invalidate(0, stage = 10);
    						break;
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 11) {
    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "launcher" && territory[tile] == userIndex) {
    						$$invalidate(0, stage = 11);
    						break;
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, planet*/ 33) {
    			 if (stage == 12) {
    				if (planet == "mars") {
    					$$invalidate(0, stage = 12);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 13) {
    				for (let tile = sizes.earth * sizes.earth; tile < sizes.earth * sizes.earth + sizes.mars * sizes.mars; tile++) {
    					if (tiletypes[tile] == "mine2" && territory[tile] == userIndex) {
    						$$invalidate(0, stage = 13);
    						break;
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage, tiletypes, territory, userIndex*/ 1553) {
    			 if (stage == 14) {
    				for (let tile = 0; tile < sizes.earth * sizes.earth; tile++) {
    					if (tiletypes[tile] == "cleaner" && territory[tile] == userIndex) {
    						$$invalidate(0, stage = 14);
    						break;
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*stage*/ 1) {
    			 {
    				$$invalidate(1, text = ({
    					0: "Welcome to worlds! To start out, select your <b>Core</b>, which is the tile that currently has 15 army. Then, move your army around by pressing WASD.",
    					1: "We need more bricks! Move to an empty tile adjacent to your core and press <kbd>3</kbd> to build a <b>Kiln</b>. You may have to wait a while.",
    					2: "That just cost 20 bricks. But don't worry! Each <b>Kiln</b> will give you 1 brick per turn.<br><br>" + "The costs of any building is shown in the <b>bottom-left corner</b>. To see how much material you have, see the <b>top-left corner</b>.",
    					3: "A Village consists of a core and the 8 tiles around it. Kilns must be located inside of a Village.<br><br>Build 3 more Kilns, for a total of 5.",
    					4: "Good! Now, use the remaining 3 spots in your Village to build Camps by pressing <kbd>2</kbd>. Camps generate 1 army every 5 turns; having a large army is important for success later on.",
    					5: "After you build up an army, use it to explore your island a bit.",
    					6: "See those little brown squares? Those are copper deposits. Copper is an important resource that is required for many buildings. A <b>Mine v1</b> can be used to get copper.<br><br>Go to a copper deposit and build a Mine on top of it by pressing <kbd>4</kbd>.",
    					7: "Build 3 more copper mines.",
    					8: "Good! Our next step is to build a Mine v2 over an iron deposit (the little silver squares). While you're waiting, it might be a good idea to build some more copper mines.<br><br>Gather copper and build a Mine v2 over an iron deposit by pressing <kbd>5</kbd>.",
    					9: "In addition to iron, Mine v2 can also mine copper and uranium.<br><br>Build some more iron & copper mines.",
    					10: "Next, we have to mine some gold, which we need to build a Launcher to get to Mars. Only the Mine v3 can mine gold.<br><br>Find a gold deposit (small yellow squares). You'll have to cross the ocean. Build a Mine v3 on top of the deposit by pressing <kbd>6</kbd>.",
    					11: "Hooray! Now it's time to build a Launcher, which will get us to Mars. Launchers can be located anywhere on land.",
    					12: "Let's go to Mars! Select your Launcher and press <kbd>L</kbd>.",
    					13: "Alright! Move to a uranium deposit (the little purple squares) and build a Mine v2.",
    					14: "It's time to talk about pollution. Pollution is generated by Kilns and Mine v1s located on Earth. Once a pollution reaches 50000, all of Earth is wiped out. The only way to undo pollution is to build Cleaners on Earth, which subtract one per turn.<br><br>Move back to Earth and build a Cleaner.",
    					15: "Alright! You've reached the end of this tutorial. A couple of things about combat to note:<br><ul><li>Pressing <kbd>N</kbd> will nuke the currently selected tile and all tiles in a 5x5 radius around it. Each nuke adds 2000 pollution.</li><li>Walls are a barrier; an army cannot pass through it unless it has more soldiers than the wall's strength. Iron walls are stronger than copper walls which are stronger than brick walls.</li><li>If you lose all of your Cores, you die, so keep your Cores protected!</li></ul>"
    				})[stage]);
    			}
    		}
    	};

    	return [
    		stage,
    		text,
    		canSkip,
    		selected,
    		userIndex,
    		planet,
    		deposits,
    		armies,
    		terrain,
    		territory,
    		tiletypes,
    		selectedTile,
    		stageInfo,
    		click_handler
    	];
    }

    class Tutorial extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			selected: 3,
    			userIndex: 4,
    			planet: 5,
    			deposits: 6,
    			armies: 7,
    			terrain: 8,
    			territory: 9,
    			tiletypes: 10
    		});
    	}
    }

    /* svelte/History.svelte generated by Svelte v3.20.1 */

    function create_if_block_9(ctx) {
    	let p0;
    	let t1;
    	let p1;

    	return {
    		c() {
    			p0 = element("p");
    			p0.textContent = "I created this in order to warn future civilizations about the plight of this one.";
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "The future rests on your hands - whoever you may be - and whether you choose to\ncooperate with each other or not.";
    			attr(p0, "class", "svelte-1j12y0u");
    			attr(p1, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, p0, anchor);
    			insert(target, t1, anchor);
    			insert(target, p1, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(p0);
    			if (detaching) detach(t1);
    			if (detaching) detach(p1);
    		}
    	};
    }

    // (123:24) 
    function create_if_block_8(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "Switzerland to Rennovate Bunker System";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "June 29, 2139";
    			t3 = space();
    			p = element("p");

    			p.innerHTML = `<b>BERN</b> - Switzerland recently launched a new initiative
to rennovate its existing bunker system, designed to house millions
of citizens in the case of war.`;

    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    		}
    	};
    }

    // (115:24) 
    function create_if_block_7(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "NASA Announces Venture to Colonize Mars";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "June 2, 2139";
    			t3 = space();
    			p = element("p");

    			p.innerHTML = `<b>WASHINGTON, D.C.</b> - NASA recently announced that it would be sending 10 astronauts on a rocket
headed for Mars. &quot;We hope to establish a self-sufficient colony on Mars by
using a combination of solar and nuclear energy to power the base and grow
crops that have been bio-engineered to grow in the environment on Mars,&quot; a
spokesperson said.`;

    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    		}
    	};
    }

    // (103:25) 
    function create_if_block_6(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p0;
    	let t6;
    	let p1;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "China Arrests Scientist for \"Disrupting the Harmonious Balance of Society\"";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "May 15, 2139";
    			t3 = space();
    			p0 = element("p");

    			p0.innerHTML = `<b>TAIEPEI</b> - Li Bao, a climate scientist, had been urging the Chinese goverment to take actions
against climate change on his Weibo account, warning that if no action is taken, millions
of people would drown. Last Monday, he disappeared, with no comment from the goverment
as to his whereabouts. On Wednesday, the Chinese government formally announced that he had
been sentenced to five years in prison for &quot;disrupting the harmonious balance of society&quot; and causing
unnecessary panic.`;

    			t6 = space();
    			p1 = element("p");
    			p1.textContent = "The Chinese government has repeatedly offered assurances that the damage\nthat climate change will inflict will be mitigated, despite warnings\nfrom scientists.";
    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p0, "class", "svelte-1j12y0u");
    			attr(p1, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p0, anchor);
    			insert(target, t6, anchor);
    			insert(target, p1, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p0);
    			if (detaching) detach(t6);
    			if (detaching) detach(p1);
    		}
    	};
    }

    // (94:25) 
    function create_if_block_5(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "Unrest in Santo Dominigo as Evacuation Order Announced";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "May 12, 2139";
    			t3 = space();
    			p = element("p");

    			p.innerHTML = `<b>SANTIAGO</b> - The Dominican government has ordered all residents of
Santo Dominigo to evacuate within 1 month. Protests have begun around all parts
of the city, which protesters chanting slogans like &quot;Rather die than leave.&quot;
Protesters are accusing the president of causing unnecessary panic and
profiting off of it. He has close ties with the CEO of Memorias, a company
that specializes in creating small items that supposedly stop the rising of the sea.`;

    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    		}
    	};
    }

    // (84:25) 
    function create_if_block_4(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "United States and China Blame Each Other for Natural Disasters";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "May 6, 2139";
    			t3 = space();
    			p = element("p");

    			p.innerHTML = `<b>WASHINGTON, D.C.</b> - The United States and China have been throwing attacks at
each other for the past few days. China accuses the U.S. of laxly enforcing
its climate regulations. &quot;We believe that all countries must do their part,
including the United States&quot;, a spokesperson for the Chinese government said.
The United States, on the other hand, has pointed to China&#39;s numerous
factory farms, which China repeatedly denies.
`;

    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    		}
    	};
    }

    // (76:25) 
    function create_if_block_3(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "Scientist Publicly Challenges Darwinism";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "May 4, 2139";
    			t3 = space();
    			p = element("p");

    			p.innerHTML = `<b>BEIJING</b> - Scientist Liao Shi blamed scientists&#39; acceptance of Darwin&#39;s theory of evolution
for the recent natural disasters that have occurred, which have included two consecutive hurricanes hitting the
United States&#39; east coast, a tsunami affecting Japan and China, and twenty-three tornadoes hitting the The Midwest, all within the span of two months.
&quot;The heavens are not happy with our acceptance of blasphemous
theories,&quot; he said at a conference last Friday.`;

    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    		}
    	};
    }

    // (68:0) {#if document === 1}
    function create_if_block_2(ctx) {
    	let h3;
    	let t1;
    	let h4;
    	let t3;
    	let p;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "Sea Level Rise Worries Amsterdam Officials";
    			t1 = space();
    			h4 = element("h4");
    			h4.textContent = "March 15, 2139";
    			t3 = space();
    			p = element("p");

    			p.innerHTML = `<b>AMSTERDAM</b> - A recent report that came out last Wednesday
found that sea levels were rising at an alarming 1cm per day, much higher than previous estimates.
City officials in Amsterdam are worried that the city&#39;s complex sea-resistance system is not going to hold up
against this alarming rate. &quot;We did not forsee that this system would need to resist sea levels this high,&quot; an architect said
who wished to remain anonymous.`;

    			attr(h3, "class", "svelte-1j12y0u");
    			attr(h4, "class", "svelte-1j12y0u");
    			attr(p, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    		}
    	};
    }

    // (136:0) {#if document != 1}
    function create_if_block_1$2(ctx) {
    	let button;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "<";
    			set_style(button, "left", "16px");
    			attr(button, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor, remount) {
    			insert(target, button, anchor);
    			if (remount) dispose();
    			dispose = listen(button, "click", /*click_handler*/ ctx[4]);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    // (139:0) {#if document < documentcount}
    function create_if_block$3(ctx) {
    	let button;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = ">";
    			set_style(button, "right", "16px");
    			attr(button, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor, remount) {
    			insert(target, button, anchor);
    			if (remount) dispose();
    			dispose = listen(button, "click", /*click_handler_1*/ ctx[5]);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let div;
    	let t0;
    	let span;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let div_style_value;

    	function select_block_type(ctx, dirty) {
    		if (/*document*/ ctx[2] === 1) return create_if_block_2;
    		if (/*document*/ ctx[2] === 2) return create_if_block_3;
    		if (/*document*/ ctx[2] === 3) return create_if_block_4;
    		if (/*document*/ ctx[2] === 4) return create_if_block_5;
    		if (/*document*/ ctx[2] === 5) return create_if_block_6;
    		if (/*document*/ ctx[2] == 6) return create_if_block_7;
    		if (/*document*/ ctx[2] == 7) return create_if_block_8;
    		if (/*document*/ ctx[2] === 15) return create_if_block_9;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = /*document*/ ctx[2] != 1 && create_if_block_1$2(ctx);
    	let if_block2 = /*document*/ ctx[2] < /*documentcount*/ ctx[1] && create_if_block$3(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			span = element("span");
    			t1 = text(/*document*/ ctx[2]);
    			t2 = text(" / ");
    			t3 = text(/*documentcount*/ ctx[1]);
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			attr(span, "class", "page svelte-1j12y0u");
    			attr(div, "style", div_style_value = "display:" + (/*show*/ ctx[0] ? "block" : "none"));
    			attr(div, "class", "svelte-1j12y0u");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t0);
    			append(div, span);
    			append(span, t1);
    			append(span, t2);
    			append(span, t3);
    			append(div, t4);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t5);
    			if (if_block2) if_block2.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			}

    			if (dirty & /*document*/ 4) set_data(t1, /*document*/ ctx[2]);
    			if (dirty & /*documentcount*/ 2) set_data(t3, /*documentcount*/ ctx[1]);

    			if (/*document*/ ctx[2] != 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$2(ctx);
    					if_block1.c();
    					if_block1.m(div, t5);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*document*/ ctx[2] < /*documentcount*/ ctx[1]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$3(ctx);
    					if_block2.c();
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*show*/ 1 && div_style_value !== (div_style_value = "display:" + (/*show*/ ctx[0] ? "block" : "none"))) {
    				attr(div, "style", div_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    const maxDocuments = 15;

    function instance$6($$self, $$props, $$invalidate) {
    	let { documents } = $$props;
    	let { show } = $$props;
    	let documentcount;
    	let document = 1;
    	const click_handler = () => $$invalidate(2, document -= 1);
    	const click_handler_1 = () => $$invalidate(2, document += 1);

    	$$self.$set = $$props => {
    		if ("documents" in $$props) $$invalidate(3, documents = $$props.documents);
    		if ("show" in $$props) $$invalidate(0, show = $$props.show);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*documents*/ 8) {
    			 $$invalidate(1, documentcount = Math.min(documents, maxDocuments));
    		}
    	};

    	return [show, documentcount, document, documents, click_handler, click_handler_1];
    }

    class History extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { documents: 3, show: 0 });
    	}
    }

    /* svelte/App.svelte generated by Svelte v3.20.1 */

    function create_if_block_1$3(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let button;
    	let t4;
    	let t5_value = (/*planet*/ ctx[15] == "earth" ? "Mars" : "Earth") + "";
    	let t5;
    	let button_style_value;
    	let current;
    	let dispose;

    	const stats0 = new Stats({
    			props: {
    				stats: /*stats*/ ctx[14],
    				labels: /*statsLabels*/ ctx[20],
    				x: "16",
    				y: "16"
    			}
    		});

    	const stats1 = new Stats({
    			props: {
    				stats: /*materials*/ ctx[12],
    				labels: /*materialLabels*/ ctx[13],
    				x: "16",
    				y: "88"
    			}
    		});

    	let if_block = /*tileInfos*/ ctx[17].length == 11 && create_if_block_2$1(ctx);

    	const players_1 = new Players({
    			props: {
    				players: /*players*/ ctx[6],
    				losers: /*losers*/ ctx[7],
    				userIndex: /*userIndex*/ ctx[16],
    				relationships: /*relationships*/ ctx[5]
    			}
    		});

    	players_1.$on("status", /*relationshipUpdate*/ ctx[26]);

    	return {
    		c() {
    			create_component(stats0.$$.fragment);
    			t0 = space();
    			create_component(stats1.$$.fragment);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			create_component(players_1.$$.fragment);
    			t3 = space();
    			button = element("button");
    			t4 = text("To ");
    			t5 = text(t5_value);
    			attr(button, "style", button_style_value = "z-index:5;top:300px;left:16px;position:fixed;display:" + (/*launched*/ ctx[9] ? "block" : "none"));
    		},
    		m(target, anchor, remount) {
    			mount_component(stats0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(stats1, target, anchor);
    			insert(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t2, anchor);
    			mount_component(players_1, target, anchor);
    			insert(target, t3, anchor);
    			insert(target, button, anchor);
    			append(button, t4);
    			append(button, t5);
    			current = true;
    			if (remount) dispose();
    			dispose = listen(button, "click", /*click_handler*/ ctx[30]);
    		},
    		p(ctx, dirty) {
    			const stats0_changes = {};
    			if (dirty & /*stats*/ 16384) stats0_changes.stats = /*stats*/ ctx[14];
    			stats0.$set(stats0_changes);
    			const stats1_changes = {};
    			if (dirty & /*materials*/ 4096) stats1_changes.stats = /*materials*/ ctx[12];
    			if (dirty & /*materialLabels*/ 8192) stats1_changes.labels = /*materialLabels*/ ctx[13];
    			stats1.$set(stats1_changes);

    			if (/*tileInfos*/ ctx[17].length == 11) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block_2$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t2.parentNode, t2);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const players_1_changes = {};
    			if (dirty & /*players*/ 64) players_1_changes.players = /*players*/ ctx[6];
    			if (dirty & /*losers*/ 128) players_1_changes.losers = /*losers*/ ctx[7];
    			if (dirty & /*userIndex*/ 65536) players_1_changes.userIndex = /*userIndex*/ ctx[16];
    			if (dirty & /*relationships*/ 32) players_1_changes.relationships = /*relationships*/ ctx[5];
    			players_1.$set(players_1_changes);
    			if ((!current || dirty & /*planet*/ 32768) && t5_value !== (t5_value = (/*planet*/ ctx[15] == "earth" ? "Mars" : "Earth") + "")) set_data(t5, t5_value);

    			if (!current || dirty & /*launched*/ 512 && button_style_value !== (button_style_value = "z-index:5;top:300px;left:16px;position:fixed;display:" + (/*launched*/ ctx[9] ? "block" : "none"))) {
    				attr(button, "style", button_style_value);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(stats0.$$.fragment, local);
    			transition_in(stats1.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(players_1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(stats0.$$.fragment, local);
    			transition_out(stats1.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(players_1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(stats0, detaching);
    			if (detaching) detach(t0);
    			destroy_component(stats1, detaching);
    			if (detaching) detach(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(t2);
    			destroy_component(players_1, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    // (196:0) {#if tileInfos.length == 11}
    function create_if_block_2$1(ctx) {
    	let current;

    	const tileinfos = new TileInfos({
    			props: {
    				infos: /*tileInfos*/ ctx[17],
    				minimized: /*minimized*/ ctx[11]
    			}
    		});

    	return {
    		c() {
    			create_component(tileinfos.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(tileinfos, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const tileinfos_changes = {};
    			if (dirty & /*tileInfos*/ 131072) tileinfos_changes.infos = /*tileInfos*/ ctx[17];
    			if (dirty & /*minimized*/ 2048) tileinfos_changes.minimized = /*minimized*/ ctx[11];
    			tileinfos.$set(tileinfos_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(tileinfos.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(tileinfos.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(tileinfos, detaching);
    		}
    	};
    }

    // (207:0) {#if isTutorial}
    function create_if_block$4(ctx) {
    	let current;

    	const tutorial = new Tutorial({
    			props: {
    				armies: /*armies*/ ctx[0],
    				terrain: /*terrain*/ ctx[1],
    				territory: /*territory*/ ctx[2],
    				deposits: /*deposits*/ ctx[3],
    				tiletypes: /*tiletypes*/ ctx[4],
    				selected: /*selected*/ ctx[8],
    				userIndex: /*userIndex*/ ctx[16],
    				planet: /*planet*/ ctx[15]
    			}
    		});

    	return {
    		c() {
    			create_component(tutorial.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(tutorial, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const tutorial_changes = {};
    			if (dirty & /*armies*/ 1) tutorial_changes.armies = /*armies*/ ctx[0];
    			if (dirty & /*terrain*/ 2) tutorial_changes.terrain = /*terrain*/ ctx[1];
    			if (dirty & /*territory*/ 4) tutorial_changes.territory = /*territory*/ ctx[2];
    			if (dirty & /*deposits*/ 8) tutorial_changes.deposits = /*deposits*/ ctx[3];
    			if (dirty & /*tiletypes*/ 16) tutorial_changes.tiletypes = /*tiletypes*/ ctx[4];
    			if (dirty & /*selected*/ 256) tutorial_changes.selected = /*selected*/ ctx[8];
    			if (dirty & /*userIndex*/ 65536) tutorial_changes.userIndex = /*userIndex*/ ctx[16];
    			if (dirty & /*planet*/ 32768) tutorial_changes.planet = /*planet*/ ctx[15];
    			tutorial.$set(tutorial_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(tutorial.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(tutorial.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(tutorial, detaching);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let updating_selected;
    	let t0;
    	let t1;
    	let t2;
    	let if_block1_anchor;
    	let current;

    	function map_selected_binding(value) {
    		/*map_selected_binding*/ ctx[29].call(null, value);
    	}

    	let map_props = {
    		planet: /*planet*/ ctx[15],
    		armies: /*armies*/ ctx[0],
    		terrain: /*terrain*/ ctx[1],
    		territory: /*territory*/ ctx[2],
    		deposits: /*deposits*/ ctx[3],
    		tiletypes: /*tiletypes*/ ctx[4]
    	};

    	if (/*selected*/ ctx[8] !== void 0) {
    		map_props.selected = /*selected*/ ctx[8];
    	}

    	const map = new Map$1({ props: map_props });
    	binding_callbacks.push(() => bind(map, "selected", map_selected_binding));
    	map.$on("move", /*move*/ ctx[22]);
    	map.$on("make", /*make*/ ctx[23]);
    	map.$on("launch", /*launch*/ ctx[24]);
    	map.$on("nuke", /*nuke*/ ctx[25]);
    	let if_block0 = !/*hide*/ ctx[10] && create_if_block_1$3(ctx);

    	const history = new History({
    			props: {
    				documents: /*greenhouses*/ ctx[18],
    				show: /*showHistory*/ ctx[19]
    			}
    		});

    	let if_block1 = /*isTutorial*/ ctx[21] && create_if_block$4(ctx);

    	return {
    		c() {
    			create_component(map.$$.fragment);
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			create_component(history.$$.fragment);
    			t2 = text("ni\n\n");
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			mount_component(map, target, anchor);
    			insert(target, t0, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t1, anchor);
    			mount_component(history, target, anchor);
    			insert(target, t2, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const map_changes = {};
    			if (dirty & /*planet*/ 32768) map_changes.planet = /*planet*/ ctx[15];
    			if (dirty & /*armies*/ 1) map_changes.armies = /*armies*/ ctx[0];
    			if (dirty & /*terrain*/ 2) map_changes.terrain = /*terrain*/ ctx[1];
    			if (dirty & /*territory*/ 4) map_changes.territory = /*territory*/ ctx[2];
    			if (dirty & /*deposits*/ 8) map_changes.deposits = /*deposits*/ ctx[3];
    			if (dirty & /*tiletypes*/ 16) map_changes.tiletypes = /*tiletypes*/ ctx[4];

    			if (!updating_selected && dirty & /*selected*/ 256) {
    				updating_selected = true;
    				map_changes.selected = /*selected*/ ctx[8];
    				add_flush_callback(() => updating_selected = false);
    			}

    			map.$set(map_changes);

    			if (!/*hide*/ ctx[10]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_1$3(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t1.parentNode, t1);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			const history_changes = {};
    			if (dirty & /*greenhouses*/ 262144) history_changes.documents = /*greenhouses*/ ctx[18];
    			if (dirty & /*showHistory*/ 524288) history_changes.show = /*showHistory*/ ctx[19];
    			history.$set(history_changes);
    			if (/*isTutorial*/ ctx[21]) if_block1.p(ctx, dirty);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(map.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(history.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(map.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(history.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(map, detaching);
    			if (detaching) detach(t0);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t1);
    			destroy_component(history, detaching);
    			if (detaching) detach(t2);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let armies = [];
    	let terrain = [];
    	let territory = [];
    	let deposits = [];
    	let tiletypes = [];
    	let relationships = [];
    	let players = [];
    	let losers = [];

    	// Set: the currently selected tiles
    	let selected = new Set();

    	let launched = false;
    	let hide = false;
    	let minimized = false;
    	let materials = {};

    	let materialLabels = [
    		["Brk", "brick", "text-brick"],
    		["Cu", "copper", "text-copper"],
    		["Fe", "iron", "text-iron"],
    		["Au", "gold", "text-gold"],
    		["U", "uranium", "text-uranium"]
    	];

    	let stats = {};
    	const statsLabels = [["Turn", "turn"], ["Pollution", "pollution"]];
    	let planet = "earth";
    	const isTutorial = location.hash.endsWith(":tutorial");
    	const roomId = location.pathname.split("/")[1];
    	const userKey = location.hash.slice(1).split(":")[0];
    	let userIndex;

    	{
    		let xhr = new XMLHttpRequest();

    		xhr.onload = function () {
    			$$invalidate(16, userIndex = xhr.responseText | 0);
    		};

    		xhr.open("POST", "/api/" + roomId + "/join?key=" + userKey);
    		xhr.send();
    	}

    	let tileInfos = [];

    	{
    		let i = 0;

    		for (let kbd of tileKeys) {
    			let type = tileTypes[kbd];
    			let xhr = new XMLHttpRequest();
    			let j = i;

    			xhr.onload = function () {
    				let info = JSON.parse(xhr.responseText);
    				info.key = kbd;
    				$$invalidate(17, tileInfos[j] = info, tileInfos);
    				$$invalidate(17, tileInfos);
    			};

    			xhr.open("GET", "/api/tileinfo?type=" + type);
    			xhr.send();
    			i += 1;
    		}
    	}

    	setInterval(
    		function () {
    			var xhr = new XMLHttpRequest();

    			xhr.onload = function () {
    				var json = JSON.parse(xhr.responseText);
    				$$invalidate(0, armies = json.armies);
    				$$invalidate(1, terrain = json.terrain);
    				$$invalidate(2, territory = json.territory);
    				$$invalidate(3, deposits = json.deposits);
    				$$invalidate(4, tiletypes = json.tiletypes);
    				$$invalidate(12, materials = json.stats[userIndex].materials);
    				$$invalidate(14, stats.pollution = json.pollution, stats);
    				$$invalidate(14, stats.turn = json.turn, stats);
    				$$invalidate(14, stats);
    				$$invalidate(6, players = json.players);
    				$$invalidate(7, losers = json.losers);
    				$$invalidate(5, relationships = json.relationships);
    			};

    			xhr.open("GET", "/api/" + roomId + "/data.json?key=" + userKey);
    			xhr.send();
    		},
    		500
    	);

    	function move(evt) {
    		var xhr = new XMLHttpRequest();
    		xhr.open("POST", "/api/" + roomId + "/move?from=" + evt.detail.from + "&to=" + evt.detail.to + "&key=" + userKey);
    		xhr.send();
    	}

    	function make(evt) {
    		var xhr = new XMLHttpRequest();
    		xhr.open("POST", "/api/" + roomId + "/make?tile=" + evt.detail.tile + "&type=" + evt.detail.type + "&key=" + userKey);
    		xhr.send();
    	}

    	function launch(evt) {
    		var xhr = new XMLHttpRequest();

    		xhr.onload = function () {
    			if (xhr.status == 200) {
    				$$invalidate(15, planet = "mars");
    				$$invalidate(9, launched = true);
    			}
    		};

    		xhr.open("POST", "/api/" + roomId + "/launch?tile=" + evt.detail.tile + "&key=" + userKey);
    		xhr.send();
    	}

    	function nuke(evt) {
    		var xhr = new XMLHttpRequest();
    		xhr.open("POST", "/api/" + roomId + "/nuke?tile=" + evt.detail.tile + "&key=" + userKey);
    		xhr.send();
    	}

    	let greenhouses = 0;
    	let showHistory = false;

    	window.addEventListener("keydown", function (e) {
    		if (e.key == "h") $$invalidate(10, hide = !hide);
    		if (e.key == "m") $$invalidate(11, minimized = !minimized);

    		if (e.key == "r") {
    			if (greenhouses != 0) {
    				$$invalidate(19, showHistory = !showHistory);
    			} else {
    				$$invalidate(19, showHistory = false);
    			}
    		}
    	});

    	function relationshipUpdate(evt) {
    		var xhr = new XMLHttpRequest();
    		xhr.open("POST", "/api/" + roomId + "/relationship?action=" + evt.detail.action + "&player=" + evt.detail.player + "&key=" + userKey);
    		xhr.send();
    	}

    	function map_selected_binding(value) {
    		selected = value;
    		$$invalidate(8, selected);
    	}

    	const click_handler = () => {
    		$$invalidate(15, planet = planet == "earth" ? "mars" : "earth");
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*materials*/ 4096) {
    			 if (materials.green) {
    				$$invalidate(13, materialLabels[5] = ["G", "green", "text-green"], materialLabels);
    			} else {
    				$$invalidate(13, materialLabels.length = 5, materialLabels);
    			}
    		}

    		if ($$self.$$.dirty & /*planet*/ 32768) {
    			 {
    				if (planet == "earth") {
    					document.title = "worlds • earth";
    					document.body.style.background = "#3F6ABF";
    				} else {
    					document.title = "worlds • mars";
    					document.body.style.background = "#993354";
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*territory, userIndex, tiletypes, greenhouses*/ 327700) {
    			 {
    				$$invalidate(18, greenhouses = 0);

    				for (let i = 0; i < territory.length; i++) {
    					if (territory[i] == userIndex & tiletypes[i] == "greenhouse") {
    						$$invalidate(18, greenhouses += 1);
    					}
    				}
    			}
    		}
    	};

    	return [
    		armies,
    		terrain,
    		territory,
    		deposits,
    		tiletypes,
    		relationships,
    		players,
    		losers,
    		selected,
    		launched,
    		hide,
    		minimized,
    		materials,
    		materialLabels,
    		stats,
    		planet,
    		userIndex,
    		tileInfos,
    		greenhouses,
    		showHistory,
    		statsLabels,
    		isTutorial,
    		move,
    		make,
    		launch,
    		nuke,
    		relationshipUpdate,
    		roomId,
    		userKey,
    		map_selected_binding,
    		click_handler
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=game.js.map
