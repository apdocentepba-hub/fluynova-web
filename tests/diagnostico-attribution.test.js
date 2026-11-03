"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { buildLeadUrl } = require("../static/diagnostico/attribution.js");
const landing = fs.readFileSync(path.join(__dirname, "../static/diagnostico/index.html"), "utf8");
const homeScript = fs.readFileSync(path.join(__dirname, "../static/main.js"), "utf8");
const homeHtml = fs.readFileSync(path.join(__dirname, "../static/index.html"), "utf8");

test("sin parámetros preserva el origen tradicional diagnóstico", () => {
  assert.equal(buildLeadUrl(""),
    "/?utm_source=diagnostico&utm_medium=landing&utm_campaign=primera_evaluacion#contacto");
});

test("conserva los cuatro parámetros de una campaña Instagram", () => {
  const href = buildLeadUrl("?utm_source=instagram&utm_medium=organic-social&utm_campaign=fluynova_tiempo_20261110&utm_content=carrusel_3p");
  assert.equal(href,
    "/?utm_source=instagram&utm_medium=organic-social&utm_campaign=fluynova_tiempo_20261110&utm_content=carrusel_3p#contacto");
});

test("conserva origen parcial pero no inventa otro medio/campaña", () => {
  const url = new URL(buildLeadUrl("?utm_source=instagram"), "https://fluynova-web.onrender.com");
  assert.equal(url.searchParams.get("utm_source"), "instagram");
  assert.equal(url.searchParams.get("utm_medium"), "landing");
  assert.equal(url.searchParams.get("utm_campaign"), "primera_evaluacion");
});

test("descarta URLs, datos personales y parámetros ajenos a UTM", () => {
  const href = buildLeadUrl("?utm_source=instagram&email=persona%40ejemplo.com&name=Persona&next=https%3A%2F%2Fevil.example%2F&guardian_funciones=stock");
  assert.ok(!href.includes("persona"));
  assert.ok(!href.includes("next"));
  assert.ok(!href.includes("guardian"));
  assert.ok(!href.includes("evil"));
  assert.ok(href.startsWith("/?"));
  assert.ok(href.endsWith("#contacto"));
});

test("descarta caracteres de inyección en origen y campaña", () => {
  const href = buildLeadUrl("?utm_source=instagram%0Aalert&" +
    "utm_campaign=%3Cscript%3E&" +
    "utm_medium=organic-social");
  const dest = new URL(href, "https://fluynova-web.onrender.com");
  assert.equal(dest.searchParams.get("utm_source"), "diagnostico");
  assert.equal(dest.searchParams.get("utm_campaign"), "primera_evaluacion");
  assert.equal(dest.searchParams.get("utm_medium"), "organic-social");
});

test("descarta UTMs demasiado largos", () => {
  const href = buildLeadUrl("?utm_content=" + "a".repeat(91) + "&utm_source=instagram");
  assert.equal(new URL(href, "https://fluynova-web.onrender.com").searchParams.has("utm_content"), false);
});

test("no pierde valores al viajar desde diagnóstico hacia portada", () => {
  const href = buildLeadUrl("?utm_source=instagram&utm_medium=organic-social&utm_campaign=fluynova_tiempo_20261110&utm_content=carrusel_3p");
  const landing = new URL(href, "https://fluynova-web.onrender.com");
  const search = landing.searchParams;
  assert.equal(search.get("utm_source"), "instagram");
  assert.equal(search.get("utm_content"), "carrusel_3p");
  assert.equal(landing.hash, "#contacto");
});

test("los dos CTA usan el helper y conservan alternativa sin JS", () => {
  const markers = [...landing.matchAll(/data-diagnostic-cta/g)];
  assert.equal(markers.length, 2);
  assert.ok(landing.includes('<script defer src="/diagnostico/attribution.js"></script>'));
  assert.equal([...landing.matchAll(/href="\/\?utm_source=diagnostico/g)].length, 2);
});

test("la portada recibe los 4 parámetros en campos ocultos al enviar", () => {
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    assert.ok(homeScript.includes("cleanCampaignParam('" + k + "'"));
  }
  for (const k of ["origen_fuente", "origen_canal", "origen_campania", "origen_mensaje"]) {
    assert.ok(homeHtml.includes('name="' + k + '"'));
  }
});

test("sin píxeles, cookies, localStorage ni envío independiente", () => {
  const js = fs.readFileSync(path.join(__dirname, "../static/diagnostico/attribution.js"), "utf8");
  assert.ok(!js.includes("fetch("));
  assert.ok(!js.includes("localStorage."));
  assert.ok(!js.includes("document.cookie"));
  assert.ok(!js.includes("sendBeacon("));
});
