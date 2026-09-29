//#region src/js/utils/mime-type-match.js
function e(e, t) {
	if (!e || !t) return !1;
	if (e === "*/*" || e === t) return !0;
	let [n, r] = e.split("/"), [i, a] = t.split("/");
	return n === i && (r === "*" || r === a);
}
//#endregion
//#region src/js/utils/detect-topo.js
var t = [
	"points",
	"edges",
	"rings",
	"faces",
	"shells",
	"solids"
];
function n(e) {
	return Array.isArray(e?.features) || e?.type === "Feature";
}
function r(e) {
	return Array.isArray(e?.features) ? e.features : [e];
}
function i(e) {
	return !e || typeof e != "object" || Array.isArray(e) ? !1 : t.some((t) => Array.isArray(e[t]) && e[t].some(n));
}
function a(e) {
	if (e?.type !== "Point" || !Array.isArray(e.coordinates)) return !1;
	let [t, n, r] = e.coordinates;
	return Number.isFinite(t) && Number.isFinite(n) && Math.abs(t) <= 180 && Math.abs(n) <= 90 && (r === void 0 || Number.isFinite(r));
}
function o(e) {
	return Array.isArray(e?.points) ? e.points.some((e) => r(e).some((e) => a(e?.geometry))) : !1;
}
function s(e) {
	return i(e) && o(e);
}
//#endregion
//#region src/js/utils/cesium-version.js
var c = "1.145.0", l = `https://cdn.jsdelivr.net/npm/cesium@${c}/Build/Cesium/`, ee = `${l}index.js`, te = `${l}Widgets/widgets.css`, u = "bblocks-cesium-viewer-widgets-css", d = (e) => import(
	/* @vite-ignore */
	e
);
function ne(e = d) {
	return globalThis.CESIUM_BASE_URL ??= l, e(ee);
}
function re(e, t = d) {
	let n = () => ne(t);
	return e?.depResolver ? e.depResolver.resolve({
		name: "cesium",
		range: `~${c}`,
		version: c,
		load: n
	}) : n();
}
function ie(e = globalThis.document) {
	if (!e || e.getElementById(u)) return;
	let t = e.createElement("link");
	t.id = u, t.rel = "stylesheet", t.href = te, e.head.appendChild(t);
}
//#endregion
//#region src/js/utils/viewer-options.js
var ae = "https://tile.openstreetmap.org/", oe = "© OpenStreetMap contributors";
function se(e, t = "") {
	e.Ion.defaultAccessToken = t;
}
function f(e) {
	return new e.ImageryLayer(new e.OpenStreetMapImageryProvider({
		url: ae,
		credit: oe,
		maximumLevel: 19
	}));
}
function ce(e, t) {
	return t === "ion" ? e.ImageryLayer.fromWorldImagery() : t && typeof t == "object" ? new e.ImageryLayer(new e.UrlTemplateImageryProvider({
		url: t.url,
		credit: t.credit,
		maximumLevel: t.maximumLevel
	})) : f(e);
}
function le(e, { basemap: t = "osm", terrain: n = "ellipsoid" } = {}) {
	return {
		baseLayer: ce(e, t),
		...n === "ion" ? { terrain: e.Terrain.fromWorldTerrain() } : { terrainProvider: new e.EllipsoidTerrainProvider() },
		baseLayerPicker: !1,
		geocoder: !1,
		timeline: !1,
		animation: !1,
		homeButton: !1,
		sceneModePicker: !1,
		projectionPicker: !1,
		navigationHelpButton: !1,
		fullscreenButton: !1,
		vrButton: !1,
		infoBox: !1,
		selectionIndicator: !1,
		requestRenderMode: !0,
		maximumRenderTimeChange: Infinity
	};
}
function ue(e, t, n, r) {
	let { terrain: i, baseLayer: a } = n;
	i?.errorEvent?.addEventListener((n) => {
		r(`ion terrain failed to load (${n?.message ?? n}); using the ellipsoid`), !t.isDestroyed() && (t.terrainProvider = new e.EllipsoidTerrainProvider(), t.scene.requestRender());
	}), a?.errorEvent?.addEventListener((n) => {
		r(`ion imagery failed to load (${n?.message ?? n}); using OpenStreetMap`), !t.isDestroyed() && (t.imageryLayers.remove(a), t.imageryLayers.add(f(e), 0), t.scene.requestRender());
	});
}
//#endregion
//#region src/js/utils/curie.js
function de(e, t = {}) {
	if (typeof e != "string") return e;
	let n = e.indexOf(":");
	if (n === -1) return e;
	let r = t[e.slice(0, n)];
	return typeof r == "string" ? r + e.slice(n + 1) : e;
}
function fe(e, t, n = {}) {
	if (e == null) return !1;
	let r = (Array.isArray(e) ? e : [e]).map((e) => de(e, n));
	return t.some((e) => r.includes(de(e, n)));
}
//#endregion
//#region src/js/utils/rules.js
function pe(e) {
	return Array.isArray(e?.features) ? e.features : [e];
}
function me(e, t) {
	let n = e?.[t];
	return Array.isArray(n) ? n.flatMap(pe) : [];
}
function p(e, t) {
	return t.split(".").reduce((e, t) => e?.[t], e);
}
function he(e) {
	if (e != null && e !== "") return typeof e == "object" ? typeof e.label == "string" ? e.label : void 0 : String(e);
}
function ge(e, t = {}) {
	let n = t.properties || [];
	for (let t of n) {
		let n = he(p(e, t));
		if (n !== void 0) return n;
	}
	return he(p(e, t.fallback || "id")) ?? String(e.id);
}
function _e(e, t, n) {
	return !t.match || fe(p(e, t.match.property), t.match.values || [], n);
}
function ve(e, t, n = e?.["@context"] || {}) {
	let r = t?.rules || [], i = [...new Set(r.map((e) => e.source))], a = [];
	return i.forEach((i) => {
		let o = r.filter((e) => e.source === i);
		me(e, i).forEach((e) => {
			let r = o.find((t) => _e(e, t, n));
			r && a.push({
				feature: e,
				source: i,
				kind: r.kind,
				group: r.group || r.kind,
				kindLabel: r.kindLabel,
				geometry: r.geometry,
				label: ge(e, r.label),
				style: {
					...t?.defaults?.style,
					...r.style
				},
				initiallyVisible: r.initiallyVisible ?? !0,
				elevation: r.elevation || t?.defaults?.elevation || "preserve"
			});
		});
	}), a;
}
function ye(e) {
	return e === "flatten" ? 0 : e && typeof e == "object" && typeof e.flattenTo == "number" ? e.flattenTo : null;
}
//#endregion
//#region src/js/utils/default-config.js
var m = {
	properties: [
		"properties.appellation.label",
		"properties.appellation",
		"properties.description",
		"properties.name"
	],
	fallback: "id"
};
function be(e, t) {
	let { solidCount: n = 0, openShellCount: r = 0, parcelCount: i = 0, faceCount: a = 0, ringCount: o = 0 } = e, s = n > 0 || r > 0 || i > 0, c = [];
	return s ? (n > 0 && c.push({
		source: "solids",
		kind: "solid",
		geometry: "solid",
		label: m,
		style: { opacity: t.solid }
	}), c.push({
		source: "surfaces",
		kind: "surface",
		geometry: "open-shell",
		label: m,
		style: { opacity: t.surface }
	}), c.push({
		source: "parcels",
		kind: "parcel",
		geometry: "polygon",
		label: m,
		style: { opacity: t.parcel }
	})) : a > 0 ? c.push({
		source: "faces",
		kind: "face",
		geometry: "face",
		label: m,
		style: { opacity: t.face }
	}) : o > 0 && c.push({
		source: "rings",
		kind: "ring",
		geometry: "ring",
		label: m,
		style: { opacity: t.ring }
	}), { rules: c };
}
//#endregion
//#region src/js/utils/topo-geometry.js
var xe = "-", h = "Face", g = "Shell", Se = "SubtendedAngle", _ = 16;
function v(e = []) {
	return (Array.isArray(e) ? e : []).flatMap(r);
}
function Ce(e = []) {
	return (Array.isArray(e) ? e : []).filter((e) => e?.featureType !== Se);
}
function y(e, t = (e) => e) {
	let n = /* @__PURE__ */ new Map();
	return v(e).forEach((e) => {
		if (e?.id == null) return;
		let r = t(e);
		r != null && n.set(e.id, r);
	}), n;
}
function b(e) {
	return {
		pointMap: y(e?.points, (e) => {
			if (!a(e.geometry)) return null;
			let [t, n, r = 0] = e.geometry.coordinates;
			return [
				t,
				n,
				r
			];
		}),
		edgeMap: y(Ce(e?.edges), (e) => {
			let t = e.topology?.references;
			return Array.isArray(t) && t.length === 2 ? t : null;
		}),
		ringMap: y(e?.rings),
		faceMap: y(e?.faces),
		shellMap: y(e?.shells)
	};
}
function x(e) {
	let t = e?.topology?.directed_references;
	return Array.isArray(t) ? t : [];
}
function we(e, t) {
	let n = t.edgeMap.get(e);
	if (!n) return null;
	let r = t.pointMap.get(n[0]), i = t.pointMap.get(n[1]);
	return r && i ? [r, i] : null;
}
function S(e, t) {
	let n = [];
	for (let r of x(e)) {
		let e = t.edgeMap.get(r.ref), i = e && t.pointMap.get(e[+(r.orientation === xe)]);
		if (!i) return null;
		n.push(i);
	}
	return n.length >= 3 ? n : null;
}
function C(e, t) {
	let [n, ...r] = x(e), i = S(t.ringMap.get(n?.ref), t);
	return i ? {
		outer: i,
		holes: r.map((e) => S(t.ringMap.get(e.ref), t)).filter(Boolean)
	} : null;
}
function Te(e, t) {
	let n = S(e, t);
	return n ? {
		outer: n,
		holes: []
	} : null;
}
function w(e, t) {
	return [...e].map((e) => we(e, t)).filter(Boolean);
}
function T(e) {
	return x(e).map((e) => e.ref);
}
function E(e, t) {
	return x(e).flatMap((e) => T(t.ringMap.get(e.ref)));
}
function D(e, t) {
	let n = t.faceMap.get(e);
	if (n && n.topology?.type !== g) return {
		kind: h,
		feature: n
	};
	let r = t.shellMap.get(e);
	return r ? {
		kind: g,
		feature: r
	} : null;
}
function O(e, t, n = /* @__PURE__ */ new Set([e?.id]), r = 0) {
	return r > _ ? [] : x(e).flatMap((e) => {
		let i = D(e.ref, t);
		return i ? i.kind === h ? [i.feature] : n.has(e.ref) ? [] : O(i.feature, t, new Set(n).add(e.ref), r + 1) : [];
	});
}
function Ee(e, t) {
	let n = /* @__PURE__ */ new Set(), r = (e, i) => {
		i > _ || x(e).forEach((e) => {
			let a = D(e.ref, t);
			a?.kind !== g || n.has(e.ref) || (n.add(e.ref), r(a.feature, i + 1));
		});
	};
	return e.forEach((e) => r(e, 0)), n;
}
function k(e, t) {
	let n = Ee(v(e?.solids), t);
	return v(e?.shells).filter((e) => !n.has(e.id));
}
function A(e, t) {
	let n = O(e, t), r = new Set(n.flatMap((e) => E(e, t)));
	return {
		polygons: n.map((e) => C(e, t)).filter(Boolean),
		segments: w(r, t)
	};
}
function De(e, t) {
	let n = /* @__PURE__ */ new Map(), r = null, i = (e, t) => {
		n.has(e) || n.set(e, /* @__PURE__ */ new Set()), n.get(e).add(t);
	};
	if (e.forEach((e) => {
		let n = t.edgeMap.get(e);
		n && t.pointMap.has(n[0]) && t.pointMap.has(n[1]) && (r ??= n[0], i(n[0], n[1]), i(n[1], n[0]));
	}), r == null) return [];
	let a = [r], o = new Set(a), s = null, c = r;
	for (let e = 0; e < n.size + 1; e++) {
		let e = [...n.get(c) ?? []], t = e.find((e) => e !== s) ?? e[0];
		if (t == null || t === r && a.length > 2 || o.has(t)) break;
		a.push(t), o.add(t), s = c, c = t;
	}
	return a.map((e) => t.pointMap.get(e));
}
function j(e) {
	let t = e?.topology?.references;
	return !Array.isArray(t) || !t.length ? [] : Array.isArray(t[0]) ? t : [t];
}
function Oe(e, t) {
	let n = j(e).map((e) => De(e, t)).filter((e) => e.length >= 3);
	if (!n.length) return {
		polygons: [],
		segments: []
	};
	let [r, ...i] = n;
	return {
		polygons: [{
			outer: r,
			holes: i
		}],
		segments: w(new Set(j(e).flat()), t)
	};
}
var ke = {
	solid: A,
	"open-shell": A,
	polygon: Oe,
	face: (e, t) => ({
		polygons: [C(e, t)].filter(Boolean),
		segments: w(new Set(E(e, t)), t)
	}),
	ring: (e, t) => ({
		polygons: [Te(e, t)].filter(Boolean),
		segments: w(new Set(T(e)), t)
	})
};
function Ae(e) {
	return v(e?.faces).some((e) => x(e).length > 1) || v(e?.solids).some((e) => x(e).length > 1);
}
var M = {
	solid: 1,
	face: 1,
	ring: 1,
	surface: .55,
	parcel: .35
}, je = .85;
function N(e) {
	let t = b(e), n = Ae(e) ? je : M.solid;
	return be({
		solidCount: v(e?.solids).length,
		openShellCount: k(e, t).length,
		parcelCount: v(e?.parcels).length,
		faceCount: v(e?.faces).length,
		ringCount: v(e?.rings).length
	}, {
		...M,
		solid: n,
		face: n
	});
}
var P = 9, F = .001, I = 110574, Me = 111320, L = ([e, t]) => `${e.toFixed(P)},${t.toFixed(P)}`;
function R(e) {
	let t = Me * Math.cos(e[0][1] * Math.PI / 180), n = 0;
	for (let r = 0; r < e.length; r++) {
		let [i, a] = e[r], [o, s] = e[(r + 1) % e.length];
		n += i * t * (s * I) - o * t * (a * I);
	}
	return Math.abs(n) / 2;
}
function Ne(e, t) {
	let n = ye(t);
	if (n === null) return {
		...e,
		clampToGround: !1
	};
	let r = (e) => e.map(([e, t]) => [
		e,
		t,
		n
	]), i = /* @__PURE__ */ new Set(), a = e.polygons.map((e) => ({
		outer: r(e.outer),
		holes: e.holes.map(r)
	})).filter((e) => {
		if (R(e.outer) < F) return !1;
		let t = e.outer.map(L).sort().join(";");
		return !i.has(t) && (i.add(t), !0);
	}).map((e) => ({
		...e,
		holes: e.holes.filter((e) => R(e) >= F)
	})), o = /* @__PURE__ */ new Set();
	return {
		polygons: a,
		segments: e.segments.map(r).filter(([e, t]) => {
			let n = [L(e), L(t)];
			if (n[0] === n[1]) return !1;
			let r = n.sort().join("|");
			return !o.has(r) && (o.add(r), !0);
		}),
		clampToGround: t === "flatten"
	};
}
function Pe(e, t = N(e)) {
	let n = b(e), r = t?.rules ?? [], i = [];
	if (r.length) {
		let r = ve({
			...e,
			surfaces: k(e, n)
		}, t);
		for (let e of r) {
			let t = ke[e.geometry];
			if (!t) continue;
			let r = Ne(t(e.feature, n), e.elevation);
			r.polygons.length && i.push({
				kind: e.kind,
				group: e.group,
				kindLabel: e.kindLabel,
				label: e.label,
				id: e.feature.id ?? null,
				feature: e.feature,
				style: e.style,
				visible: e.initiallyVisible,
				...r
			});
		}
	}
	let a = r.length === 0;
	return {
		renderables: i,
		edges: a ? w(n.edgeMap.keys(), n) : [],
		points: a ? [...n.pointMap.values()] : []
	};
}
function z({ renderables: e, edges: t, points: n }) {
	return [
		...e.flatMap((e) => [...e.polygons.flatMap((e) => [e.outer, ...e.holes].flat()), ...e.segments.flat()]),
		...t.flat(),
		...n
	];
}
function Fe(e) {
	let t = e.polygons.flatMap((e) => e.outer);
	return [
		t.reduce((e, t) => e + t[0], 0) / t.length,
		t.reduce((e, t) => e + t[1], 0) / t.length,
		Math.max(...t.map((e) => e[2]))
	];
}
//#endregion
//#region src/js/utils/config.js
var B = Object.freeze({
	rules: [],
	defaults: {},
	kindOrder: []
});
function V(e) {
	return {
		rules: Array.isArray(e?.rules) ? e.rules : [],
		defaults: e?.defaults && typeof e.defaults == "object" && !Array.isArray(e.defaults) ? e.defaults : {},
		kindOrder: Array.isArray(e?.kindOrder) ? e.kindOrder : []
	};
}
function Ie(e) {
	if (e == null) return { ...B };
	let t = e;
	if (typeof e == "string") try {
		t = JSON.parse(e);
	} catch {
		return { ...B };
	}
	return typeof t != "object" || Array.isArray(t) ? { ...B } : V(t);
}
function Le(e, t) {
	let n = V(e), r = V(t);
	return {
		rules: r.rules.length ? r.rules : n.rules,
		kindOrder: r.kindOrder.length ? r.kindOrder : n.kindOrder,
		defaults: {
			...n.defaults,
			...r.defaults,
			style: {
				...n.defaults.style,
				...r.defaults.style
			}
		}
	};
}
//#endregion
//#region src/js/utils/cesium-options.js
var H = Object.freeze({
	basemap: "osm",
	terrain: "ellipsoid",
	camera: null,
	ionToken: ""
}), Re = [
	"{z}",
	"{x}",
	"{y}"
], U = (e) => typeof e == "object" && !!e && !Array.isArray(e), W = (e, t, n) => Number.isFinite(e) && e >= t && e <= n;
function ze(e, t) {
	if (e === void 0) return H.basemap;
	if (e === "osm" || e === "ion") return e;
	if (U(e) && typeof e.url == "string") {
		let t;
		try {
			t = new URL(e.url.replace(/[{}]/g, ""));
		} catch {
			t = null;
		}
		let n = Re.every((t) => e.url.includes(t));
		if (t?.protocol === "https:" && n) {
			let t = { url: e.url };
			return typeof e.credit == "string" && (t.credit = e.credit), Number.isInteger(e.maximumLevel) && e.maximumLevel >= 0 && (t.maximumLevel = e.maximumLevel), t;
		}
	}
	return t.push(`cesium.basemap ${JSON.stringify(e)} is not "osm", "ion" or { "url": "https://…/{z}/{x}/{y}…" }; using OpenStreetMap`), H.basemap;
}
function Be(e, t) {
	return e === void 0 ? H.terrain : e === "ellipsoid" || e === "ion" ? e : (t.push(`cesium.terrain ${JSON.stringify(e)} is not "ellipsoid" or "ion"; using the ellipsoid`), H.terrain);
}
function Ve(e, t) {
	if (e === void 0) return null;
	let { longitude: n, latitude: r, height: i, heading: a = 0, pitch: o = -45, roll: s = 0 } = U(e) ? e : {};
	return U(e) && W(n, -180, 180) && W(r, -90, 90) && Number.isFinite(i) && Number.isFinite(a) && W(o, -90, 90) && Number.isFinite(s) ? {
		longitude: n,
		latitude: r,
		height: i,
		heading: a,
		pitch: o,
		roll: s
	} : (t.push("cesium.camera needs numeric longitude (-180..180), latitude (-90..90) and height, and optional heading, pitch (-90..90) and roll in degrees; framing the data instead"), null);
}
function G(e) {
	let t = [];
	if (e !== void 0 && !U(e)) return t.push("cesium must be an object; using the defaults"), {
		options: { ...H },
		warnings: t
	};
	let n = e ?? {}, r = typeof n.ionToken == "string" ? n.ionToken.trim() : "";
	n.ionToken !== void 0 && typeof n.ionToken != "string" && t.push("cesium.ionToken must be a string; ignoring it");
	let i = {
		basemap: ze(n.basemap, t),
		terrain: Be(n.terrain, t),
		camera: Ve(n.camera, t),
		ionToken: r
	};
	return r || (i.basemap === "ion" && (t.push("cesium.basemap \"ion\" needs an ion token; using OpenStreetMap"), i.basemap = H.basemap), i.terrain === "ion" && (t.push("cesium.terrain \"ion\" needs an ion token; using the ellipsoid"), i.terrain = H.terrain)), {
		options: i,
		warnings: t
	};
}
function He(e) {
	let t = Array.isArray(e?.resources) ? e.resources : [];
	return t.find((e) => e?.role === "https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config" && e.ref) ?? t.find((e) => e?.role === "https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config" && e.ref) ?? null;
}
async function Ue(e, t) {
	try {
		let n = await t(e);
		return n.ok ? {
			json: JSON.parse(await n.text()),
			warning: null
		} : {
			json: null,
			warning: `config ${e} returned HTTP ${n.status}`
		};
	} catch (t) {
		return {
			json: null,
			warning: `config ${e} could not be loaded (${t.message})`
		};
	}
}
async function We(e, t, n = globalThis.fetch) {
	let r = He(e?.bblock);
	if (!r) {
		let { options: e, warnings: n } = G(void 0);
		return {
			config: V(t),
			cesium: e,
			warnings: n,
			ref: null
		};
	}
	let { json: i, warning: a } = await Ue(r.ref, n), o = typeof i == "object" && !!i && !Array.isArray(i), s = a ? [a] : [];
	i != null && !o && s.push(`config ${r.ref} is not a JSON object; using the defaults`);
	let { options: c, warnings: l } = G(o ? i.cesium : void 0);
	return {
		config: o ? Le(t, Ie(i)) : V(t),
		cesium: c,
		warnings: [...s, ...l],
		ref: r.ref
	};
}
//#endregion
//#region src/js/cesium-scene.js
var Ge = [
	"#3388ff",
	"#ff8833",
	"#33ff88",
	"#ff3388",
	"#8833ff",
	"#33ffff",
	"#ffff33",
	"#ff33ff",
	"#88ff33",
	"#3388aa"
], Ke = "#ffffff", qe = 2, Je = 16, Ye = "#ffff00", Xe = 8, Ze = "13px sans-serif", Qe = -35, $e = 3.5, et = 150, tt = .8, K = (e, [t, n, r]) => e.Cartesian3.fromDegrees(t, n, r);
function nt(e, t, n) {
	return typeof t == "string" && e.Color.fromCssColorString(t) || e.Color.fromCssColorString(n);
}
function rt(e, t, n) {
	let r = Number.isFinite(t?.opacity) ? Math.min(Math.max(t.opacity, 0), 1) : 1;
	return nt(e, t?.color, Ge[n % Ge.length]).withAlpha(r);
}
function it(e, { outer: t, holes: n }) {
	return new e.PolygonHierarchy(t.map((t) => K(e, t)), n.map((t) => new e.PolygonHierarchy(t.map((t) => K(e, t)))));
}
function at(e, t, n) {
	let r = () => ({ color: e.ColorGeometryInstanceAttribute.fromColor(n) }), i = new e.PerInstanceColorAppearance({
		translucent: n.alpha < 1,
		closed: !1,
		flat: t.clampToGround
	});
	return t.clampToGround ? new e.GroundPrimitive({
		geometryInstances: t.polygons.map((n) => new e.GeometryInstance({
			geometry: new e.PolygonGeometry({ polygonHierarchy: it(e, n) }),
			id: t.id,
			attributes: r()
		})),
		appearance: i,
		classificationType: e.ClassificationType.BOTH,
		show: t.visible
	}) : new e.Primitive({
		geometryInstances: t.polygons.map((n) => new e.GeometryInstance({
			geometry: new e.CoplanarPolygonGeometry({
				polygonHierarchy: it(e, n),
				vertexFormat: e.PerInstanceColorAppearance.VERTEX_FORMAT
			}),
			id: t.id,
			attributes: r()
		})),
		appearance: i,
		show: t.visible
	});
}
function ot(e, t) {
	let n = nt(e, t?.lineColor, Ke), r = t?.lineStyle === "dashed" ? e.Material.fromType("PolylineDash", {
		color: n,
		dashLength: Je
	}) : e.Material.fromType("Color", { color: n });
	return new e.PolylineMaterialAppearance({
		material: r,
		translucent: n.alpha < 1
	});
}
function st(e, t, { id: n, style: r, clampToGround: i = !1, visible: a = !0 }) {
	let o = ot(e, r);
	return i ? new e.GroundPolylinePrimitive({
		geometryInstances: t.map((t) => new e.GeometryInstance({
			geometry: new e.GroundPolylineGeometry({
				positions: t.map((t) => K(e, t)),
				width: qe
			}),
			id: n
		})),
		appearance: o,
		classificationType: e.ClassificationType.BOTH,
		show: a
	}) : new e.Primitive({
		geometryInstances: t.map((t) => new e.GeometryInstance({
			geometry: new e.PolylineGeometry({
				positions: t.map((t) => K(e, t)),
				width: qe,
				arcType: e.ArcType.NONE,
				vertexFormat: e.PolylineMaterialAppearance.VERTEX_FORMAT
			}),
			id: n
		})),
		appearance: o,
		show: a
	});
}
function ct(e, t) {
	let n = new e.PointPrimitiveCollection(), r = e.Color.fromCssColorString(Ye);
	return t.forEach((t) => n.add({
		position: K(e, t),
		color: r,
		pixelSize: Xe,
		outlineColor: e.Color.BLACK,
		outlineWidth: 1
	})), n;
}
function lt(e, t, n) {
	return t.add({
		position: K(e, Fe(n)),
		text: String(n.label ?? n.id ?? ""),
		font: Ze,
		fillColor: e.Color.WHITE,
		outlineColor: e.Color.BLACK,
		outlineWidth: 3,
		style: e.LabelStyle.FILL_AND_OUTLINE,
		verticalOrigin: e.VerticalOrigin.BOTTOM,
		pixelOffset: new e.Cartesian2(0, -6),
		disableDepthTestDistance: Infinity,
		show: !1
	});
}
function ut(e, t) {
	let n = t.renderables.length ? new e.LabelCollection() : null, r = t.renderables.map((t, r) => ({
		kind: t.kind,
		group: t.group,
		kindLabel: t.kindLabel,
		label: t.label,
		id: t.id,
		visible: t.visible,
		fill: at(e, t, rt(e, t.style, r)),
		outline: t.segments.length ? st(e, t.segments, t) : null,
		labelGraphic: lt(e, n, t),
		positions: z({
			renderables: [t],
			edges: [],
			points: []
		}).map((t) => K(e, t))
	})), i = r.flatMap((e) => [e.fill, e.outline].filter(Boolean));
	return n && i.push(n), t.edges.length && i.push(st(e, t.edges, { id: "edges" })), t.points.length && i.push(ct(e, t.points)), {
		records: r,
		primitives: i,
		positions: z(t).map((t) => K(e, t))
	};
}
function dt(e, t) {
	t.forEach((t) => e.scene.primitives.add(t)), e.scene.requestRender();
}
function q(e, t, n, { animate: r = !1 } = {}) {
	if (!n.length) return;
	let i = e.BoundingSphere.fromPoints(n), a = Math.max(i.radius * $e, et), o = new e.HeadingPitchRange(0, e.Math.toRadians(Qe), a);
	r ? t.camera.flyToBoundingSphere(i, {
		offset: o,
		duration: tt
	}) : (t.camera.viewBoundingSphere(i, o), t.camera.lookAtTransform(e.Matrix4.IDENTITY)), t.scene.requestRender();
}
function ft(e, t, { longitude: n, latitude: r, height: i, heading: a, pitch: o, roll: s }) {
	t.camera.setView({
		destination: e.Cartesian3.fromDegrees(n, r, i),
		orientation: {
			heading: e.Math.toRadians(a),
			pitch: e.Math.toRadians(o),
			roll: e.Math.toRadians(s)
		}
	}), t.scene.requestRender();
}
//#endregion
//#region src/js/ui/icons.js
var J = (e, t = "fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"") => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${t}>${e}</svg>`, pt = {
	extent: J("<path d=\"M4 9V4h5\"/><path d=\"M20 9V4h-5\"/><path d=\"M4 15v5h5\"/><path d=\"M20 15v5h-5\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/>"),
	labels: J("<path d=\"M3 7V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2\"/><path d=\"M12 4v16\"/><path d=\"M9 20h6\"/>"),
	edges: J("<circle cx=\"5\" cy=\"19\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"5\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/><line x1=\"6.5\" y1=\"17.5\" x2=\"17.5\" y2=\"6.5\"/>"),
	layers: J("<path d=\"M12 3 2 8l10 5 10-5Z\"/><path d=\"m2 13 10 5 10-5\"/>"),
	parcels: J("<path d=\"M12 3 20 9l-3 10H7L4 9Z\"/>"),
	surfaces: J("<path d=\"M12 3 21 8l-9 5-9-5Z\"/>"),
	solids: J("<path d=\"M12 2 21 7v10l-9 5-9-5V7z\" opacity=\"0.35\"/><path d=\"M12 2 21 7 12 12 3 7z\"/>", "fill=\"currentColor\" stroke=\"none\""),
	zoomTo: J("<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"m20 20-4.35-4.35\"/>"),
	fullscreen: J("<path d=\"M9 3H5a2 2 0 0 0-2 2v4\"/><path d=\"M15 3h4a2 2 0 0 1 2 2v4\"/><path d=\"M9 21H5a2 2 0 0 1-2-2v-4\"/><path d=\"M15 21h4a2 2 0 0 0 2-2v-4\"/>"),
	fullscreenExit: J("<path d=\"M4 9V5a2 2 0 0 1 2-2h4\"/><path d=\"M20 9V5a2 2 0 0 0-2-2h-4\"/><path d=\"M4 15v4a2 2 0 0 0 2 2h4\"/><path d=\"M20 15v4a2 2 0 0 1-2 2h-4\"/>")
}, Y = {
	parcel: {
		icon: "parcels",
		inlineLabel: "parcels",
		panelLabel: "Parcels"
	},
	surface: {
		icon: "surfaces",
		inlineLabel: "surfaces",
		panelLabel: "Surfaces"
	},
	solid: {
		icon: "solids",
		inlineLabel: "solids",
		panelLabel: "Solids"
	},
	face: { panelLabel: "Faces" },
	ring: { panelLabel: "Rings" }
}, mt = [
	"parcel",
	"surface",
	"solid"
];
function ht(e) {
	let t = String(e).replace(/[-_]+/g, " ").trim();
	return t ? t.charAt(0).toUpperCase() + t.slice(1) : String(e);
}
var X = (e) => [...new Set(e)];
function Z(e, t, n, r) {
	let i = e.createElement(t);
	return n && (i.className = n), r !== void 0 && (i.textContent = r), i;
}
var gt = class {
	constructor(e, { records: t, actions: n, initial: r = {} }) {
		this.root = e, this.doc = e.ownerDocument, this.records = t, this.actions = n, this.labelsShown = r.labelsShown ?? !1, this.edgesShown = r.edgesShown ?? !0, this.panelOpen = !1, this.buttons = {}, this.groupButtons = [], this._build(), this.applyViewMode();
	}
	get expanded() {
		return this.root.clientHeight >= 400;
	}
	_button(e, t) {
		let n = Z(this.doc, "button", "bcv-button");
		return n.type = "button", n.addEventListener("click", () => {
			t(), this.refresh();
		}), this.buttons[e] = n, n;
	}
	_build() {
		let e = Z(this.doc, "div", "bcv-toolbar");
		e.setAttribute("role", "toolbar"), e.setAttribute("aria-label", "Globe view controls");
		let t = this.records.length > 0;
		if (e.appendChild(this._button("extent", () => this.actions.zoomToExtent())), t) {
			e.appendChild(this._button("labels", () => {
				this.labelsShown = !this.labelsShown, this.actions.setLabelsShown(this.labelsShown);
			})), e.appendChild(this._button("edges", () => {
				this.edgesShown = !this.edgesShown, this.actions.setEdgesShown(this.edgesShown);
			}));
			let t = Z(this.doc, "div", "bcv-toolbar-group"), n = X(this.records.map((e) => e.group));
			this.groupButtons = mt.filter((e) => n.includes(e)).map((e) => {
				let n = this._button(`group:${e}`, () => this._setVisible(this._groupRecords(e), !this._allVisible(this._groupRecords(e))));
				return n.dataset.group = e, t.appendChild(n), {
					group: e,
					btn: n
				};
			}), this.groupButtons.length && e.appendChild(t), e.appendChild(this._button("layers", () => {
				this.panelOpen = !this.panelOpen, this.applyViewMode();
			}));
		}
		e.appendChild(this._button("fullscreen", () => this.actions.toggleFullscreen())), this.toolbar = e, this.root.appendChild(e), t && (this.panel = Z(this.doc, "div", "bcv-panel"), this.panel.id = `bcv-panel-${Math.random().toString(36).slice(2, 10)}`, this.panel.setAttribute("role", "region"), this.panel.setAttribute("aria-label", "Layers"), this.buttons.layers.setAttribute("aria-controls", this.panel.id), this.root.appendChild(this.panel)), this.refresh();
	}
	_groupRecords(e) {
		return this.records.filter((t) => t.group === e);
	}
	_allVisible(e) {
		return e.length > 0 && e.every((e) => e.visible);
	}
	_setVisible(e, t) {
		this.actions.setVisible(e, t), this.refresh();
	}
	refresh() {
		let e = (e, t, n, r) => {
			let i = this.buttons[e];
			i && (i.innerHTML = pt[t], i.title = n, i.setAttribute("aria-label", n), r !== void 0 && i.setAttribute("aria-pressed", String(r)));
		}, t = this.actions.isFullscreen();
		e("extent", "extent", "Zoom to extent"), e("labels", "labels", this.labelsShown ? "Hide labels" : "Show labels", this.labelsShown), e("edges", "edges", this.edgesShown ? "Hide edges" : "Show edges", this.edgesShown), e("layers", "layers", this.panelOpen ? "Hide layers" : "Layers", this.panelOpen), e("fullscreen", t ? "fullscreenExit" : "fullscreen", t ? "Exit fullscreen" : "Fullscreen", t), this.groupButtons.forEach(({ group: t, btn: n }) => {
			let { icon: r, inlineLabel: i } = Y[t], a = this._allVisible(this._groupRecords(t));
			e(`group:${t}`, r, `${a ? "Hide" : "Show"} ${i}`, a), n.dataset.group = t;
		}), this.buttons.layers?.setAttribute("aria-expanded", String(this.expanded || this.panelOpen)), this._renderPanel();
	}
	applyViewMode() {
		let e = this.expanded;
		this.groupButtons.forEach(({ btn: t }) => {
			t.hidden = e;
		}), this.buttons.layers && (this.buttons.layers.hidden = e), this.panel && (this.panel.hidden = !(e || this.panelOpen)), this.refresh();
	}
	_selectAll(e, t, n) {
		let r = this.doc.createElement("input");
		return r.type = "checkbox", r.dataset.key = n, r.checked = e.every((e) => e.visible), r.indeterminate = !r.checked && e.some((e) => e.visible), r.setAttribute("aria-label", `Show all ${t}`), r.addEventListener("click", (e) => e.stopPropagation()), r.addEventListener("change", () => this._setVisible(e, r.checked)), r;
	}
	_featureRow(e) {
		let t = Z(this.doc, "div", "bcv-feature"), n = this.doc.createElement("label"), r = this.doc.createElement("input");
		r.type = "checkbox", r.dataset.key = `feature:${this.records.indexOf(e)}`, r.checked = e.visible, r.addEventListener("change", () => this._setVisible([e], r.checked));
		let i = Z(this.doc, "span", "bcv-feature-name", e.label);
		i.title = e.label, n.append(r, i);
		let a = Z(this.doc, "button", "bcv-zoom-to");
		return a.type = "button", a.innerHTML = pt.zoomTo, a.title = `Zoom to ${e.label}`, a.setAttribute("aria-label", a.title), a.addEventListener("click", () => this.actions.zoomTo(e)), t.append(n, a), t;
	}
	_renderPanel() {
		if (!this.panel) return;
		let e = this.doc.activeElement?.dataset?.key, t = new Set([...this.panel.children ?? []].filter((e) => e.tagName === "DETAILS" && !e.open).map((e) => e.dataset.group));
		this.panel.replaceChildren(Z(this.doc, "h2", "bcv-panel-title", "Layers")), X(this.records.map((e) => e.group)).forEach((e) => {
			let n = this._groupRecords(e), r = Y[e]?.panelLabel ?? ht(e), i = Z(this.doc, "details", "bcv-group");
			i.dataset.group = e, i.open = !t.has(e);
			let a = this.doc.createElement("summary");
			a.append(this._selectAll(n, r, `group:${e}`), Z(this.doc, "span", "", `${r} (${n.length})`));
			let o = Z(this.doc, "div", "bcv-group-body"), s = X(n.map((e) => e.kind));
			s.length > 1 ? s.forEach((t) => {
				let r = n.filter((e) => e.kind === t), i = r[0].kindLabel ?? Y[t]?.panelLabel ?? ht(t), a = Z(this.doc, "div", "bcv-kind"), s = Z(this.doc, "label", "bcv-kind-header");
				s.append(this._selectAll(r, i, `kind:${e}:${t}`), Z(this.doc, "span", "", `${i} (${r.length})`));
				let c = Z(this.doc, "div", "bcv-kind-body");
				r.forEach((e) => c.appendChild(this._featureRow(e))), a.append(s, c), o.appendChild(a);
			}) : n.forEach((e) => o.appendChild(this._featureRow(e))), i.append(a, o), this.panel.appendChild(i);
		}), e && this.panel.querySelector(`[data-key="${CSS.escape(e)}"]`)?.focus();
	}
	destroy() {
		this.toolbar?.remove(), this.panel?.remove(), this.toolbar = null, this.panel = null, this.buttons = {}, this.groupButtons = [];
	}
}, _t = "/* TopoFeatureCesiumPlugin UI. Plain CSS, no host framework: the plugin runs outside the host's\n   component tree. Everything is scoped under .bcv-root, the plugin's own wrapper element. */\n\n.bcv-root {\n  position: absolute;\n  inset: 0;\n  overflow: hidden;\n  font: 12px/1.4 system-ui, sans-serif;\n  color: #222;\n}\n\n.bcv-root:fullscreen {\n  background: #000;\n}\n\n.bcv-viewer {\n  position: absolute;\n  inset: 0;\n}\n\n/* ─── Toolbar ─────────────────────────────────────────────────────────────────── */\n\n.bcv-toolbar {\n  position: absolute;\n  top: 8px;\n  left: 8px;\n  z-index: 10;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.bcv-toolbar-group {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.bcv-button {\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border: none;\n  border-radius: 4px;\n  background: #fff;\n  color: #333;\n  cursor: pointer;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\n}\n\n.bcv-button:hover {\n  background: #e8eef7;\n}\n\n.bcv-button[aria-pressed=\"true\"] {\n  background: #1976d2;\n  color: #fff;\n}\n\n.bcv-button:focus-visible,\n.bcv-panel button:focus-visible,\n.bcv-panel input:focus-visible {\n  outline: 2px solid #1976d2;\n  outline-offset: 2px;\n}\n\n.bcv-button svg {\n  width: 16px;\n  height: 16px;\n}\n\n.bcv-root [hidden] {\n  display: none !important;\n}\n\n/* ─── Layers panel ────────────────────────────────────────────────────────────── */\n\n.bcv-panel {\n  position: absolute;\n  top: 8px;\n  right: 8px;\n  z-index: 10;\n  width: max-content;\n  min-width: 160px;\n  max-width: min(280px, calc(100% - 60px));\n  max-height: calc(100% - 16px);\n  box-sizing: border-box;\n  overflow-y: auto;\n  padding: 8px 10px;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.95);\n  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);\n}\n\n.bcv-panel-title {\n  margin: 0 0 6px;\n  font-size: 12px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n  color: #555;\n}\n\n.bcv-group {\n  margin-bottom: 6px;\n}\n\n.bcv-group > summary {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  cursor: pointer;\n  font-weight: 600;\n}\n\n.bcv-group-body {\n  padding-left: 20px;\n  margin-top: 2px;\n}\n\n.bcv-kind {\n  margin-bottom: 4px;\n}\n\n.bcv-kind-header {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.bcv-kind-body {\n  padding-left: 20px;\n}\n\n.bcv-feature {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  margin: 1px 0;\n}\n\n.bcv-feature label {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  flex: 1;\n  min-width: 0;\n  cursor: pointer;\n}\n\n.bcv-feature-name {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.bcv-zoom-to {\n  flex: none;\n  width: 20px;\n  height: 20px;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border: none;\n  border-radius: 3px;\n  background: transparent;\n  color: #1976d2;\n  cursor: pointer;\n}\n\n.bcv-zoom-to:hover {\n  background: #e8eef7;\n}\n\n.bcv-zoom-to svg {\n  width: 14px;\n  height: 14px;\n}\n\n/* ─── Error banner ────────────────────────────────────────────────────────────── */\n\n.bcv-error {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  padding: 16px;\n  box-sizing: border-box;\n  text-align: center;\n  color: #b00020;\n  font: 14px/1.4 system-ui, sans-serif;\n}\n\n.bcv-error-hint {\n  margin-top: 12px;\n}\n", Q = "bblocks-cesium-viewer-css";
function vt(e = globalThis.document) {
	if (!e || e.getElementById(Q)) return;
	let t = e.createElement("style");
	t.id = Q, t.textContent = _t, e.head.appendChild(t);
}
//#endregion
//#region src/js/topo-feature-cesium-plugin.js
var $ = [
	"application/geo+json",
	"application/json",
	"application/ld+json"
], yt = class {
	static supportedTypes = $;
	static viewName = "Globe";
	static icon = "mdi-earth";
	constructor(e, t = {}) {
		this.candidates = e ?? [], this._context = t ?? {}, this._candidate = void 0, this._data = null, this._el = null, this._root = null, this._viewer = null, this._Cesium = null, this._records = [], this._positions = [], this._config = null, this._controls = null, this._resizeObserver = null, this._fullscreenHandler = null, this._showLabels = !1, this._showEdges = !0;
	}
	matches() {
		return !!this._pickCandidate();
	}
	_pickCandidate() {
		if (this._candidate !== void 0) return this._candidate;
		let t = this.candidates.find((t) => {
			if (!t?.type || !t.content || !$.some((n) => e(n, t.type))) return !1;
			try {
				let e = JSON.parse(t.content);
				return s(e) ? (this._data = e, !0) : !1;
			} catch {
				return !1;
			}
		});
		return this._candidate = t ?? null, this._candidate;
	}
	_loadCesium() {
		return re(this._context);
	}
	_loadConfig() {
		return We(this._context, N(this._data));
	}
	render(e) {
		return this._el && this.destroy(this._el), this._el = e, e.style.position = "relative", this._mount(e).catch((t) => {
			console.error("TopoFeatureCesiumPlugin: failed to render", t), this._el === e && this._showError(e, `Failed to render the globe view (${t.message}).`);
		});
	}
	async _mount(e) {
		if (!this._pickCandidate()) return;
		ie(), vt();
		let [t, n] = await Promise.all([this._loadCesium(), this._loadConfig()]);
		if (this._el !== e) return;
		this._Cesium = t, this._config = n, n.warnings.forEach((e) => console.warn(`TopoFeatureCesiumPlugin: ${e}`)), se(t, n.cesium.ionToken);
		let r = document.createElement("div");
		r.className = "bcv-root";
		let i = document.createElement("div");
		i.className = "bcv-viewer", r.appendChild(i), e.appendChild(r), this._root = r;
		let a = le(t, n.cesium);
		this._viewer = new t.Viewer(i, a), ue(t, this._viewer, a, (e) => console.warn(`TopoFeatureCesiumPlugin: ${e}`));
		let { records: o, primitives: s, positions: c } = ut(t, Pe(this._data, n.config));
		this._records = o, this._positions = c, o.forEach((e) => this._applyVisibility(e)), dt(this._viewer, s), n.cesium.camera ? ft(t, this._viewer, n.cesium.camera) : q(t, this._viewer, c), this._controls = new gt(r, {
			records: o,
			initial: {
				labelsShown: this._showLabels,
				edgesShown: this._showEdges
			},
			actions: {
				setVisible: (e, t) => {
					e.forEach((e) => {
						e.visible = t, this._applyVisibility(e);
					}), this._requestRender();
				},
				setLabelsShown: (e) => this._setOverlay("_showLabels", e),
				setEdgesShown: (e) => this._setOverlay("_showEdges", e),
				zoomToExtent: () => this.zoomToExtent(),
				zoomTo: (e) => q(t, this._viewer, e.positions, { animate: !0 }),
				toggleFullscreen: () => this._toggleFullscreen(),
				isFullscreen: () => this._isFullscreen()
			}
		}), this._watchLayout(r);
	}
	_applyVisibility(e) {
		e.fill.show = e.visible, e.outline && (e.outline.show = e.visible && this._showEdges), e.labelGraphic && (e.labelGraphic.show = e.visible && this._showLabels);
	}
	_setOverlay(e, t) {
		this[e] = t, this._records.forEach((e) => this._applyVisibility(e)), this._requestRender();
	}
	_requestRender() {
		this._viewer && !this._viewer.isDestroyed() && this._viewer.scene.requestRender();
	}
	zoomToExtent() {
		if (!this._viewer) return;
		let e = this._records.filter((e) => e.visible).flatMap((e) => e.positions);
		q(this._Cesium, this._viewer, e.length ? e : this._positions, { animate: !0 });
	}
	_isFullscreen() {
		return !!this._root && document.fullscreenElement === this._root;
	}
	_toggleFullscreen() {
		this._isFullscreen() ? document.exitFullscreen?.() : this._root?.requestFullscreen?.();
	}
	_watchLayout(e) {
		let t = () => {
			this._root === e && this._controls?.applyViewMode();
		};
		typeof ResizeObserver < "u" && (this._resizeObserver = new ResizeObserver(t), this._resizeObserver.observe(e)), this._fullscreenHandler = t, document.addEventListener("fullscreenchange", t);
	}
	_showError(e, t) {
		this.destroy(e);
		let n = document.createElement("div");
		n.className = "bcv-error", n.setAttribute("role", "alert");
		let r = document.createElement("div");
		r.textContent = t;
		let i = document.createElement("div");
		i.className = "bcv-error-hint", i.textContent = "See the browser console for details.", n.append(r, i), e.appendChild(n);
	}
	destroy(e) {
		this._el = null, this._resizeObserver?.disconnect(), this._resizeObserver = null, this._fullscreenHandler && document.removeEventListener("fullscreenchange", this._fullscreenHandler), this._fullscreenHandler = null, this._isFullscreen() && document.exitFullscreen?.(), this._controls?.destroy(), this._controls = null, this._viewer && !this._viewer.isDestroyed() && this._viewer.destroy(), this._viewer = null, this._Cesium = null, this._records = [], this._positions = [], this._config = null, this._root?.remove(), this._root = null, e?.replaceChildren();
	}
};
//#endregion
export { yt as TopoFeatureCesiumPlugin };
