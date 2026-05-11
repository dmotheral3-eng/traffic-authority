import React, { useEffect, useState } from 'react';

/**
 * Traffic Authority — single-file React component
 *
 * Drop into a Vite/Next/CRA project. Mount <TrafficAuthority /> at root.
 * Self-contained: CSS embedded via <style>, Google Fonts via @import.
 * For best SEO, mirror the <title> / <meta> tags in the host index.html.
 *
 * Supabase wiring (P#22 logic-layer compliant — anon calls fn_submit_ta_lead RPC,
 * reads v_ta_opportunities_public view; never INSERTs or SELECTs raw tables):
 *   project: ulzyudbqkmjistymlqwg
 *   RPC:    fn_submit_ta_lead(p_form_type, p_email, p_contact_name, p_agency,
 *                              p_tmc_platform, p_opportunity_code, p_source_url,
 *                              p_user_agent, p_referrer, p_honeypot)
 *   view:   v_ta_opportunities_public
 *   table:  ta_site_leads (writes via RPC only)
 */

const TA_SUPABASE_URL = 'https://ulzyudbqkmjistymlqwg.supabase.co';
const TA_SUPABASE_KEY = 'sb_publishable_BrUeC0HYQJXMufuFrosudA_q2ni_r_C';

// ============ PostHog (mandatory in every Centripetal app) ============
// Loads from env at runtime — supports both Vite (VITE_*) and Next.js (NEXT_PUBLIC_*).
// PostHog frontend keys are project tokens — designed to be public.
// Set ONE of these in your build environment:
//   Vite:    VITE_POSTHOG_KEY,  VITE_POSTHOG_HOST  (default host: https://us.i.posthog.com)
//   Next.js: NEXT_PUBLIC_POSTHOG_KEY,  NEXT_PUBLIC_POSTHOG_HOST
// If neither is set, PostHog silently no-ops (zero runtime errors).
const TA_POSTHOG_FALLBACK_HOST = 'https://us.i.posthog.com';
function getPostHogConfig() {
  let key = '';
  let host = TA_POSTHOG_FALLBACK_HOST;
  try {
    // Vite-style env vars (import.meta.env)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_POSTHOG_KEY) key = import.meta.env.VITE_POSTHOG_KEY;
      if (import.meta.env.VITE_POSTHOG_HOST) host = import.meta.env.VITE_POSTHOG_HOST;
    }
  } catch (_) { /* import.meta unavailable in this build */ }
  try {
    // Next.js / CRA / Node-style env vars (process.env)
    if (typeof process !== 'undefined' && process.env) {
      if (!key && process.env.NEXT_PUBLIC_POSTHOG_KEY) key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (host === TA_POSTHOG_FALLBACK_HOST && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
        host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
      }
    }
  } catch (_) { /* process unavailable */ }
  return { key, host };
}

// Module-level reference so handleSubmit can capture events
let posthogRef = null;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Serif:ital,wght@0,400;0,500;1,400&display=swap');

  :root {
    --paper: #f4f1ea;
    --paper-2: #ecebe2;
    --ink: #0e0e10;
    --ink-2: #2a2a2b;
    --ink-soft: #585858;
    --rule: #1a1a1c;
    --rule-soft: #b9b6ac;
    --yellow: #ffd100;
    --yellow-deep: #e6bd00;
    --blue: #1d3557;
    --blue-soft: #34597d;
    --green: #1f6f3e;
    --orange: #c7521b;
    --grid: rgba(14,14,16,0.06);
  }
  .ta-root, .ta-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .ta-root {
    background: var(--paper);
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 56px 56px;
    background-position: -1px -1px;
    color: var(--ink);
    font-family: "IBM Plex Serif", Georgia, serif;
    font-size: 17px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    scroll-behavior: smooth;
  }
  .ta-root .wrap { max-width: 1180px; margin: 0 auto; padding: 0 36px; }
  .ta-root .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; }
  .ta-root .cond { font-family: "IBM Plex Sans Condensed", system-ui, sans-serif; }
  .ta-root a { color: inherit; text-decoration: none; }
  .ta-root a.link { border-bottom: 1px solid var(--ink); padding-bottom: 1px; }
  .ta-root a.link:hover { background: var(--yellow); }

  /* ============ NAV ============ */
  .ta-root nav.top {
    position: sticky; top: 0; z-index: 30;
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
  }
  .ta-root nav.top .inner {
    display: flex; align-items: center; justify-content: space-between;
    height: 64px;
  }
  .ta-root .brand {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 19px; letter-spacing: 0.04em;
    display: flex; align-items: center; gap: 12px;
  }
  .ta-root .brand .mark {
    width: 28px; height: 28px;
    background: var(--ink);
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--yellow); font-family: "IBM Plex Mono", monospace;
    font-weight: 600; font-size: 13px;
  }
  .ta-root .nav-links { display: flex; gap: 28px; }
  .ta-root .nav-links a {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-2); font-weight: 500;
  }
  .ta-root .nav-links a:hover { color: var(--ink); border-bottom: 1px solid var(--ink); padding-bottom: 1px; }
  .ta-root .nav-cta {
    background: var(--ink); color: var(--paper);
    padding: 9px 18px; font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 500;
  }
  .ta-root .nav-cta:hover { background: var(--yellow); color: var(--ink); }

  /* ============ HERO ============ */
  .ta-root .hero { padding: 96px 0 80px; position: relative; }
  .ta-root .hero .stamps {
    display: flex; gap: 18px; align-items: center; margin-bottom: 32px;
    flex-wrap: wrap;
  }
  .ta-root .stamp {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    padding: 5px 10px; border: 1px solid var(--rule);
  }
  .ta-root .stamp.fill { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .ta-root .stamp.yellow { background: var(--yellow); border-color: var(--ink); }
  .ta-root .hero h1 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: clamp(48px, 7.5vw, 96px);
    line-height: 0.96; letter-spacing: -0.015em;
    color: var(--ink);
    max-width: 16ch;
  }
  .ta-root .hero h1 .alt { color: var(--blue); display: block; }
  .ta-root .hero h1 .we { background: var(--yellow); padding: 0 0.18em; }
  .ta-root .hero .sub {
    margin-top: 36px; max-width: 60ch;
    font-size: 19px; line-height: 1.55; color: var(--ink-2);
    font-family: "IBM Plex Serif", serif;
  }
  .ta-root .hero .ctas { margin-top: 44px; display: flex; gap: 14px; flex-wrap: wrap; }
  .ta-root .btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 14px 22px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    font-weight: 500;
    border: 1px solid var(--ink);
    cursor: pointer;
  }
  .ta-root .btn.primary { background: var(--ink); color: var(--paper); }
  .ta-root .btn.primary:hover { background: var(--yellow); color: var(--ink); }
  .ta-root .btn.ghost { background: transparent; color: var(--ink); }
  .ta-root .btn.ghost:hover { background: var(--ink); color: var(--paper); }
  .ta-root .btn .arrow { display: inline-block; transform: translateY(0); }

  /* ============ SECTION ============ */
  .ta-root section.s {
    padding: 88px 0 96px;
    border-top: 1px solid var(--rule);
    position: relative;
  }
  .ta-root .sec-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 56px; gap: 48px; }
  .ta-root .sec-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--ink-2); font-weight: 500;
    border-bottom: 1px solid var(--ink); padding-bottom: 4px;
    min-width: 120px;
  }
  .ta-root .sec-title {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: clamp(32px, 4vw, 48px);
    line-height: 1; letter-spacing: -0.01em;
    flex: 1; max-width: 22ch;
  }
  .ta-root .sec-lede {
    font-family: "IBM Plex Serif", serif;
    font-size: 18px; line-height: 1.55; color: var(--ink-2);
    max-width: 44ch; flex: 1;
  }

  /* ============ THE GAP ============ */
  .ta-root .gap-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .ta-root .gap-col {
    padding: 36px 32px 44px;
    border-right: 1px solid var(--rule);
    display: flex; flex-direction: column;
  }
  .ta-root .gap-col:last-child { border-right: 0; }
  .ta-root .gap-col.featured {
    background: var(--ink); color: var(--paper);
    border-right: 0;
  }
  .ta-root .gap-col .label {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    font-weight: 500;
  }
  .ta-root .gap-col h3 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 28px; line-height: 1.1;
    margin: 14px 0 18px;
  }
  .ta-root .gap-col .meta {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.04em;
    color: var(--ink-soft);
    margin-bottom: 16px;
  }
  .ta-root .gap-col.featured .meta { color: var(--yellow); }
  .ta-root .gap-col p { font-size: 16px; line-height: 1.55; }
  .ta-root .gap-col .price {
    margin-top: auto; padding-top: 28px;
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 22px;
    border-top: 1px solid var(--rule);
  }
  .ta-root .gap-col.featured .price { border-top-color: rgba(244,241,234,0.25); color: var(--yellow); }

  /* ============ SOLUTION + FLOW DIAGRAM ============ */
  .ta-root .flow-wrap { border: 1px solid var(--rule); background: var(--paper); padding: 56px 40px 40px; }
  .ta-root .flow-svg { width: 100%; height: auto; max-width: 1080px; margin: 0 auto; display: block; }
  .ta-root .solution-bullets {
    margin-top: 40px; display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 0; border-top: 1px solid var(--rule);
  }
  .ta-root .solution-bullets .b {
    padding: 24px 20px;
    border-right: 1px solid var(--rule);
  }
  .ta-root .solution-bullets .b:last-child { border-right: 0; }
  .ta-root .solution-bullets .b .num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; color: var(--blue);
    text-transform: uppercase; font-weight: 600;
  }
  .ta-root .solution-bullets .b h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 19px; line-height: 1.15;
    margin: 8px 0 6px;
  }
  .ta-root .solution-bullets .b p { font-size: 14px; color: var(--ink-2); }

  /* ============ COVERAGE ============ */
  .ta-root .coverage-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 0;
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .ta-root .cov {
    padding: 32px 32px 36px;
    border-right: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    background: var(--paper);
  }
  .ta-root .cov:nth-child(2n) { border-right: 0; }
  .ta-root .cov:nth-child(3), .ta-root .cov:nth-child(4) { border-bottom: 0; }
  .ta-root .cov .cov-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--blue); font-weight: 600;
  }
  .ta-root .cov h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 24px; line-height: 1.1;
    margin: 8px 0 12px;
  }
  .ta-root .cov p { font-size: 15px; color: var(--ink-2); line-height: 1.55; }
  .ta-root .cov .cov-status {
    margin-top: 18px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--green); font-weight: 600;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .ta-root .cov .cov-status::before {
    content: ''; display: inline-block; width: 8px; height: 8px;
    background: var(--green); border-radius: 50%;
  }

  .ta-root .coverage-confirm {
    margin-top: 22px;
    background: var(--ink); color: var(--paper);
    padding: 32px 32px 36px;
    display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; align-items: center;
  }
  .ta-root .coverage-confirm .cc-eyebrow {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--yellow); font-weight: 600;
  }
  .ta-root .coverage-confirm h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 28px; line-height: 1.15;
    margin: 8px 0 10px;
  }
  .ta-root .coverage-confirm p { font-size: 15px; color: rgba(244,241,234,0.78); }
  .ta-root .coverage-confirm form {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .ta-root .coverage-confirm input {
    padding: 12px 14px;
    background: transparent; color: var(--paper);
    border: 1px solid rgba(244,241,234,0.35);
    font-family: "IBM Plex Mono", monospace; font-size: 13px;
  }
  .ta-root .coverage-confirm input.full { grid-column: 1 / -1; }
  .ta-root .coverage-confirm input::placeholder { color: rgba(244,241,234,0.45); }
  .ta-root .coverage-confirm input:focus { outline: none; border-color: var(--yellow); }
  .ta-root .coverage-confirm button {
    grid-column: 1 / -1;
    background: var(--yellow); color: var(--ink);
    border: 0; padding: 12px 20px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    font-weight: 600; cursor: pointer;
  }
  .ta-root .coverage-confirm button:hover { background: var(--paper); }
  .ta-root .coverage-confirm button:disabled { opacity: 0.7; cursor: default; }

  /* ============ PROCUREMENT VEHICLES ============ */
  .ta-root .vehicles {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }
  .ta-root .vehicle {
    border: 1px solid var(--rule); padding: 24px 24px 28px;
    background: var(--paper); position: relative;
  }
  .ta-root .vehicle.lead {
    border-color: var(--ink); border-width: 2px;
  }
  .ta-root .vehicle .v-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; color: var(--ink-soft);
  }
  .ta-root .vehicle h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 22px; margin: 6px 0 10px;
  }
  .ta-root .vehicle p { font-size: 14px; color: var(--ink-2); }
  .ta-root .vehicle .vstat {
    margin-top: 18px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--green); font-weight: 600;
  }
  .ta-root .vehicle .vstat.pending { color: var(--orange); }
  .ta-root .vehicle .vstat.live { color: var(--blue); }
  .ta-root .vehicle .vstat.roadmap { color: var(--ink-soft); }

  /* ============ CAPABILITY STATEMENT ============ */
  .ta-root .cap-grid {
    display: grid; grid-template-columns: 380px 1fr;
    gap: 0;
    border: 1px solid var(--rule); background: var(--paper);
  }
  .ta-root .cap-download {
    padding: 40px 36px;
    border-right: 1px solid var(--rule);
    background: var(--ink); color: var(--paper);
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .ta-root .cap-download .doc-icon {
    width: 56px; height: 72px;
    border: 2px solid var(--yellow);
    position: relative;
    margin-bottom: 20px;
  }
  .ta-root .cap-download .doc-icon::before {
    content: ''; position: absolute; top: 8px; left: 8px; right: 8px; height: 2px;
    background: var(--yellow);
  }
  .ta-root .cap-download .doc-icon::after {
    content: ''; position: absolute; top: 16px; left: 8px; right: 8px; height: 2px;
    background: var(--yellow); opacity: 0.6;
  }
  .ta-root .cap-download .doc-icon span {
    position: absolute; bottom: 8px; left: 8px; right: 8px; height: 2px;
    background: var(--yellow); opacity: 0.6; display: block;
  }
  .ta-root .cap-download h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 28px; line-height: 1.1;
    color: var(--paper);
  }
  .ta-root .cap-download p { margin-top: 14px; font-size: 14px; line-height: 1.55; color: rgba(244,241,234,0.78); }
  .ta-root .cap-download .doc-meta {
    margin-top: 20px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(244,241,234,0.55);
    line-height: 1.9;
  }
  .ta-root .cap-download .doc-meta .kv .k { color: var(--yellow); margin-right: 8px; }
  .ta-root .cap-download .btn-dl {
    margin-top: 28px;
    display: inline-flex; align-items: center; gap: 10px;
    padding: 14px 22px;
    background: var(--yellow); color: var(--ink); border: 0;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    font-weight: 600; cursor: pointer;
  }
  .ta-root .cap-download .btn-dl:hover { background: var(--paper); }

  .ta-root .cap-detail {
    padding: 36px 36px 40px;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 32px 40px;
  }
  .ta-root .cap-block .ctitle {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--blue); font-weight: 600;
    margin-bottom: 10px;
  }
  .ta-root .cap-block h5 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 18px; margin-bottom: 4px;
  }
  .ta-root .cap-block p, .ta-root .cap-block li { font-size: 14px; color: var(--ink-2); line-height: 1.55; }
  .ta-root .cap-block ul { margin-top: 4px; list-style: none; }
  .ta-root .cap-block li { padding-left: 16px; position: relative; padding-top: 3px; padding-bottom: 3px; }
  .ta-root .cap-block li::before { content: '▸'; position: absolute; left: 0; color: var(--blue); }
  .ta-root .cap-block .codes {
    margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;
  }
  .ta-root .cap-block .code-pill {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.06em;
    padding: 3px 8px; border: 1px solid var(--rule-soft);
    background: var(--paper-2); font-weight: 500;
  }

  /* ============ STRUCTURE ============ */
  .ta-root .team-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    border: 1px solid var(--rule);
  }
  .ta-root .team-col {
    padding: 40px 36px; background: var(--paper);
    border-right: 1px solid var(--rule);
  }
  .ta-root .team-col:last-child { border-right: 0; background: var(--paper-2); }
  .ta-root .team-col .role {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--blue); font-weight: 600;
  }
  .ta-root .team-col h3 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 32px; line-height: 1.1;
    margin: 10px 0 18px;
  }
  .ta-root .team-col p { font-size: 16px; color: var(--ink-2); margin-bottom: 14px; }
  .ta-root .team-col .creds {
    margin-top: 18px;
    display: flex; flex-wrap: wrap; gap: 6px;
  }
  .ta-root .cred {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    padding: 3px 8px; border: 1px solid var(--ink);
    background: var(--paper); font-weight: 500;
  }

  /* ============ CONTACT ============ */
  .ta-root .contact-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
    align-items: start;
  }
  .ta-root .contact-block { border: 1px solid var(--rule); padding: 30px 30px 34px; background: var(--paper); }
  .ta-root .contact-block .ctype {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-2); font-weight: 600;
  }
  .ta-root .contact-block h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 24px; margin: 8px 0 4px;
  }
  .ta-root .contact-block .cnote { font-size: 14px; color: var(--ink-soft); margin-bottom: 18px; }
  .ta-root .contact-block a.email {
    font-family: "IBM Plex Mono", monospace;
    font-size: 14px; border-bottom: 1px solid var(--ink);
  }
  .ta-root .contact-block a.email:hover { background: var(--yellow); }
  .ta-root .contact-block .phone {
    font-family: "IBM Plex Mono", monospace;
    font-size: 14px; margin-top: 6px;
  }

  .ta-root .cap-request {
    margin-top: 14px;
    border: 1px solid var(--rule); padding: 26px 30px 30px;
    background: var(--ink); color: var(--paper);
  }
  .ta-root .cap-request .ctype { color: var(--yellow); }
  .ta-root .cap-request h4 { color: var(--paper); }
  .ta-root .cap-request .cnote { color: rgba(244,241,234,0.75); }
  .ta-root .cap-request form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ta-root .cap-request input[type="email"], .ta-root .cap-request input[type="text"] {
    padding: 12px 14px;
    background: transparent; color: var(--paper);
    border: 1px solid rgba(244,241,234,0.35);
    font-family: "IBM Plex Mono", monospace; font-size: 13px;
  }
  .ta-root .cap-request input.full { grid-column: 1 / -1; }
  .ta-root .cap-request input::placeholder { color: rgba(244,241,234,0.45); }
  .ta-root .cap-request input:focus { outline: none; border-color: var(--yellow); }
  .ta-root .cap-request button {
    grid-column: 1 / -1;
    background: var(--yellow); color: var(--ink);
    border: 0; padding: 12px 20px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    font-weight: 600; cursor: pointer;
  }
  .ta-root .cap-request button:hover { background: var(--paper); }
  .ta-root .cap-request button:disabled { opacity: 0.7; cursor: default; }

  /* ============ FOOTER ============ */
  .ta-root footer {
    margin-top: 80px; padding: 56px 0 44px;
    border-top: 4px solid var(--ink);
    background: var(--paper);
  }
  .ta-root footer .row {
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px;
    align-items: flex-start;
  }
  .ta-root footer .legal {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.04em; line-height: 1.7;
    color: var(--ink-soft);
  }
  .ta-root footer .doc-id {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    text-align: right; color: var(--ink-soft);
  }
  .ta-root footer .doc-id .kv { display: block; }
  .ta-root footer .doc-id .k { color: var(--ink); }

  /* ============ WORKFLOW STRIP ============ */
  .ta-root .workflow-row {
    display: grid; grid-template-columns: repeat(5, 1fr);
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .ta-root .wf-step {
    padding: 28px 22px 26px;
    border-right: 1px solid var(--rule);
    display: flex; flex-direction: column;
    background: var(--paper);
    position: relative;
  }
  .ta-root .wf-step:last-child { border-right: 0; }
  .ta-root .wf-step.featured { background: var(--ink); color: var(--paper); }
  .ta-root .wf-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.18em; font-weight: 600;
    color: var(--blue);
    margin-bottom: 14px;
  }
  .ta-root .wf-step.featured .wf-num { color: var(--yellow); }
  .ta-root .wf-step h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 19px; line-height: 1.2;
    margin-bottom: 12px;
    color: var(--ink);
  }
  .ta-root .wf-step.featured h4 { color: var(--paper); }
  .ta-root .wf-step p {
    font-size: 13.5px; line-height: 1.55;
    color: var(--ink-2);
    flex: 1;
  }
  .ta-root .wf-step.featured p { color: rgba(244,241,234,0.85); }
  .ta-root .wf-step::after {
    content: '\u2192';
    position: absolute;
    right: -10px; top: 30px;
    width: 20px; height: 20px;
    background: var(--paper);
    color: var(--ink);
    font-family: "IBM Plex Mono", monospace;
    font-size: 14px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--rule);
    z-index: 2;
  }
  .ta-root .wf-step:last-child::after { display: none; }

  .ta-root .workflow-promises {
    margin-top: 22px;
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .ta-root .promise {
    padding: 22px 22px 24px;
    background: var(--paper-2);
    border-left: 3px solid var(--yellow);
    border-top: 1px solid var(--rule-soft);
    border-right: 1px solid var(--rule-soft);
    border-bottom: 1px solid var(--rule-soft);
  }
  .ta-root .promise .promise-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--blue); font-weight: 600;
    margin-bottom: 8px;
  }
  .ta-root .promise strong {
    display: block;
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 17px;
    color: var(--ink);
    margin-bottom: 6px;
  }
  .ta-root .promise p {
    font-size: 13.5px; line-height: 1.55;
    color: var(--ink-2);
  }

  .ta-root .workflow-closer {
    margin-top: 22px;
    padding: 22px 28px;
    background: var(--ink); color: var(--paper);
    display: flex; justify-content: space-between; align-items: center;
    gap: 24px; flex-wrap: wrap;
  }
  .ta-root .workflow-closer .closer-text {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 22px;
    color: var(--paper);
  }
  .ta-root .workflow-closer .closer-text .yellow { color: var(--yellow); }
  .ta-root .workflow-closer .closer-sub {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(244,241,234,0.75);
  }

  /* ============ OPPORTUNITIES ============ */
  .ta-root .opp-list-wrap { min-height: 200px; }
  .ta-root .opp-loading {
    padding: 40px 28px;
    border: 1px solid var(--rule); background: var(--paper);
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--ink-soft); text-align: center;
  }
  .ta-root .opp-empty {
    padding: 40px 36px;
    border: 1px solid var(--rule); background: var(--paper);
    font-family: "IBM Plex Serif", serif;
    font-size: 16px; line-height: 1.55; color: var(--ink-2);
  }
  .ta-root .opp-empty strong { color: var(--ink); font-weight: 500; }
  .ta-root .opp-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .ta-root .opp-card {
    background: var(--paper);
    border: 1px solid var(--rule);
    padding: 28px 28px 24px;
    display: flex; flex-direction: column;
    position: relative;
  }
  .ta-root .opp-card .opp-code {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--blue); font-weight: 600;
    display: flex; gap: 10px; align-items: center;
  }
  .ta-root .opp-card .opp-code .opp-stage {
    background: var(--yellow); color: var(--ink);
    padding: 2px 7px; font-weight: 600; letter-spacing: 0.1em;
  }
  .ta-root .opp-card h4 {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 22px; line-height: 1.2;
    margin: 12px 0 18px;
    color: var(--ink);
  }
  .ta-root .opp-card .opp-meta {
    border-top: 1px solid var(--rule-soft);
    padding-top: 14px;
    display: grid; gap: 6px;
    margin-bottom: 16px;
  }
  .ta-root .opp-card .opp-row {
    display: grid; grid-template-columns: 88px 1fr; gap: 12px;
    font-size: 14px; line-height: 1.5;
  }
  .ta-root .opp-card .opp-row .lbl {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink-soft); padding-top: 2px;
  }
  .ta-root .opp-card .opp-row span:last-child { color: var(--ink-2); }
  .ta-root .opp-card .opp-value {
    font-family: "IBM Plex Sans Condensed", sans-serif;
    font-weight: 700; font-size: 17px; color: var(--ink) !important;
  }
  .ta-root .opp-card .opp-deadline { font-weight: 500; color: var(--ink) !important; }
  .ta-root .opp-card .opp-deadline.soon { color: var(--orange) !important; }
  .ta-root .opp-card .opp-actions {
    margin-top: auto; padding-top: 18px;
    display: flex; gap: 10px; align-items: center;
    border-top: 1px solid var(--rule-soft);
  }
  .ta-root .opp-card .opp-link {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-2); border-bottom: 1px solid var(--ink-2);
    padding-bottom: 1px; font-weight: 500;
  }
  .ta-root .opp-card .opp-link:hover { background: var(--yellow); }
  .ta-root .opp-card .opp-plug-btn {
    margin-left: auto;
    background: var(--ink); color: var(--paper); border: 1px solid var(--ink);
    padding: 9px 16px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 500; cursor: pointer;
  }
  .ta-root .opp-card .opp-plug-btn:hover { background: var(--yellow); color: var(--ink); }
  .ta-root .opp-card .opp-form {
    display: none;
    margin-top: 16px; padding-top: 16px;
    border-top: 1px solid var(--rule-soft);
    grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .ta-root .opp-card.expanded .opp-form { display: grid; }
  .ta-root .opp-card .opp-form input[type="text"],
  .ta-root .opp-card .opp-form input[type="email"] {
    padding: 10px 12px;
    background: var(--paper);
    color: var(--ink);
    border: 1px solid var(--rule-soft);
    font-family: "IBM Plex Mono", monospace; font-size: 12px;
  }
  .ta-root .opp-card .opp-form input.full { grid-column: 1 / -1; }
  .ta-root .opp-card .opp-form input:focus { outline: none; border-color: var(--ink); }
  .ta-root .opp-card .opp-form button {
    grid-column: 1 / -1;
    background: var(--yellow); color: var(--ink); border: 0;
    padding: 10px 16px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 600; cursor: pointer;
  }
  .ta-root .opp-card .opp-form button:hover { background: var(--ink); color: var(--yellow); }
  .ta-root .opp-card .opp-form button:disabled { opacity: 0.7; cursor: default; }

  .ta-root .opp-footnote {
    margin-top: 22px;
    padding: 18px 24px;
    background: var(--paper-2); border: 1px solid var(--rule-soft);
    font-family: "IBM Plex Serif", serif;
    font-size: 14px; line-height: 1.55; color: var(--ink-2);
  }
  .ta-root .opp-footnote strong { font-weight: 500; color: var(--ink); }

  /* ============ REVEAL ANIMATION ============ */
  .ta-root .reveal { opacity: 0; transform: translateY(14px); transition: opacity .7s ease-out, transform .7s ease-out; }
  .ta-root .reveal.in { opacity: 1; transform: translateY(0); }

  /* ============ HONEYPOT ============ */
  .ta-root input[name="website"] {
    position: absolute; left: -9999px; opacity: 0;
    pointer-events: none; height: 0;
  }

  /* ============ MOBILE ============ */
  @media (max-width: 880px) {
    .ta-root .wrap { padding: 0 22px; }
    .ta-root .nav-links { display: none; }
    .ta-root .sec-head { flex-direction: column; gap: 12px; }
    .ta-root .gap-grid { grid-template-columns: 1fr; }
    .ta-root .gap-col { border-right: 0; border-bottom: 1px solid var(--rule); }
    .ta-root .gap-col:last-child { border-bottom: 0; }
    .ta-root .solution-bullets { grid-template-columns: 1fr 1fr; }
    .ta-root .solution-bullets .b:nth-child(2) { border-right: 0; }
    .ta-root .coverage-grid { grid-template-columns: 1fr; }
    .ta-root .cov { border-right: 0; }
    .ta-root .coverage-confirm { grid-template-columns: 1fr; }
    .ta-root .vehicles { grid-template-columns: 1fr; }
    .ta-root .workflow-row { grid-template-columns: 1fr; }
    .ta-root .wf-step { border-right: 0; border-bottom: 1px solid var(--rule); }
    .ta-root .wf-step:last-child { border-bottom: 0; }
    .ta-root .wf-step::after { display: none; }
    .ta-root .workflow-promises { grid-template-columns: 1fr; }
    .ta-root .workflow-closer { flex-direction: column; align-items: flex-start; text-align: left; }
    .ta-root .opp-grid { grid-template-columns: 1fr; }
    .ta-root .opp-card .opp-form { grid-template-columns: 1fr; }
    .ta-root .cap-grid { grid-template-columns: 1fr; }
    .ta-root .cap-download { border-right: 0; border-bottom: 1px solid var(--rule); }
    .ta-root .cap-detail { grid-template-columns: 1fr; }
    .ta-root .team-grid { grid-template-columns: 1fr; }
    .ta-root .team-col { border-right: 0; border-bottom: 1px solid var(--rule); }
    .ta-root .contact-grid { grid-template-columns: 1fr; }
    .ta-root .cap-request form { grid-template-columns: 1fr; }
  }
`;

function formatClosingDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((dt - today) / 86400000);
  if (diff < 0) return 'past due';
  if (diff === 0) return 'closes today';
  if (diff === 1) return '1 day';
  return diff + ' days';
}

function OpportunityCard({ opp, expanded, onToggle, formStatus, onSubmit, buttonText }) {
  const code = opp.opportunity_code || '—';
  const stage = opp.stage || '';
  const closingFmt = opp.closing_date ? formatClosingDate(opp.closing_date) : '';
  const days = opp.closing_date ? daysUntil(opp.closing_date) : '';
  const dayNum = parseInt(days, 10);
  const soonClass = days && !Number.isNaN(dayNum) && dayNum <= 14 ? ' soon' : (days === 'closes today' ? ' soon' : '');
  const statusKey = `opportunity_partnership:${code}`;
  const disabled = ['sending', 'sent'].includes(formStatus[statusKey]);

  return (
    <div className={`opp-card${expanded ? ' expanded' : ''}`}>
      <div className="opp-code">
        <span>{code}</span>
        {stage && <span className="opp-stage">{stage}</span>}
      </div>
      <h4>{opp.title || 'Active solicitation'}</h4>
      <div className="opp-meta">
        {opp.agency && (
          <div className="opp-row">
            <span className="lbl">Agency</span>
            <span>{opp.agency}{opp.sub_org ? ' — ' + opp.sub_org : ''}</span>
          </div>
        )}
        {opp.location && (
          <div className="opp-row">
            <span className="lbl">Location</span>
            <span>{opp.location}</span>
          </div>
        )}
        {opp.value_display && (
          <div className="opp-row">
            <span className="lbl">Value</span>
            <span className="opp-value">{opp.value_display}</span>
          </div>
        )}
        {closingFmt && (
          <div className="opp-row">
            <span className="lbl">Closes</span>
            <span className={`opp-deadline${soonClass}`}>{closingFmt} · {days}</span>
          </div>
        )}
        {opp.procurement_type && (
          <div className="opp-row">
            <span className="lbl">Type</span>
            <span>{opp.procurement_type}</span>
          </div>
        )}
      </div>
      <div className="opp-actions">
        {opp.bid_portal_url ? (
          <a href={opp.bid_portal_url} target="_blank" rel="noopener noreferrer" className="opp-link">View posting ↗</a>
        ) : <span />}
        <button className="opp-plug-btn" type="button" onClick={() => onToggle(code)}>
          {expanded ? 'Cancel' : 'Plug us in →'}
        </button>
      </div>
      <form className="opp-form" data-ta-form="opportunity_partnership" onSubmit={onSubmit}>
        <input type="hidden" name="opportunity_code" value={code} />
        <input type="text" name="contact_name" placeholder="Your name" />
        <input type="text" name="agency" placeholder="Your company / agency" required />
        <input type="email" name="email" className="full" placeholder="your.name@company.com" required />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" disabled={disabled}>
          {buttonText(statusKey, 'opportunity_partnership', 'Send partnership inquiry')}
        </button>
      </form>
    </div>
  );
}

export default function TrafficAuthority() {
  const [opportunities, setOpportunities] = useState(null); // null = loading; [] = empty; [...] = loaded; 'error'
  const [expandedOppCodes, setExpandedOppCodes] = useState(() => new Set());
  const [formStatus, setFormStatus] = useState({});

  // Load opportunities from public Supabase view
  useEffect(() => {
    let alive = true;
    fetch(
      `${TA_SUPABASE_URL}/rest/v1/v_ta_opportunities_public?select=*&order=closing_date.asc.nullslast&limit=50`,
      {
        headers: {
          apikey: TA_SUPABASE_KEY,
          Authorization: `Bearer ${TA_SUPABASE_KEY}`,
          Accept: 'application/json',
        },
      }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => { if (alive) setOpportunities(data); })
      .catch((err) => {
        console.error('opp load error', err);
        if (alive) setOpportunities('error');
      });
    return () => { alive = false; };
  }, []);

  // Initialize PostHog (dynamic import so the JSX runs without the dep installed)
  useEffect(() => {
    const { key, host } = getPostHogConfig();
    if (!key) {
      // No key configured — silent no-op
      if (typeof window !== 'undefined') {
        console.info('[PostHog] No key configured; tracking disabled. Set VITE_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_KEY to enable.');
      }
      return;
    }
    let cancelled = false;
    import('posthog-js')
      .then((mod) => {
        if (cancelled) return;
        const posthog = mod.default || mod;
        if (posthog.__loaded) {
          posthogRef = posthog;
          return;
        }
        posthog.init(key, {
          api_host: host,
          capture_pageview: true,
          autocapture: true,
          persistence: 'localStorage+cookie',
          loaded: (ph) => {
            posthogRef = ph;
            ph.capture('ta_site_loaded', {
              site: 'traffic-authority.com',
              doc_rev: '1.7',
            });
          },
        });
      })
      .catch((err) => {
        console.warn('[PostHog] posthog-js not installed or failed to load:', err.message);
      });
    return () => { cancelled = true; };
  }, []);

  // Reveal-on-scroll IntersectionObserver
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
    );
    document.querySelectorAll('.ta-root .reveal:not(.in)').forEach((el, i) => {
      el.style.transitionDelay = ((i % 4) * 80) + 'ms';
      io.observe(el);
    });
    return () => io.disconnect();
  }, [opportunities]); // re-observe newly-mounted opportunity cards

  const toggleOpp = (code) => {
    setExpandedOppCodes((prev) => {
      const next = new Set(prev);
      const isOpening = !next.has(code);
      if (next.has(code)) next.delete(code); else next.add(code);
      if (isOpening && posthogRef) {
        posthogRef.capture('ta_opportunity_expanded', { opportunity_code: code });
      }
      return next;
    });
  };

  function statusKeyForForm(form) {
    const ft = form.dataset.taForm;
    const oc = form.querySelector('[name="opportunity_code"]')?.value;
    return oc ? `${ft}:${oc}` : ft;
  }

  function buttonText(key, formType, defaultText) {
    const s = formStatus[key];
    if (s === 'sending') return 'Sending…';
    if (s === 'sent') {
      if (formType === 'capability_statement') return '✓ Request received';
      if (formType === 'coverage_confirmation') return '✓ Confirmation requested';
      if (formType === 'opportunity_partnership') return '✓ Inquiry sent';
      return '✓ Sent';
    }
    if (s === 'error') return 'Try again';
    return defaultText;
  }

  function isDisabled(key) {
    return ['sending', 'sent'].includes(formStatus[key]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const formType = form.dataset.taForm;
    const key = statusKeyForForm(form);

    setFormStatus((s) => ({ ...s, [key]: 'sending' }));

    const payload = {
      p_form_type: formType,
      p_email: (data.get('email') || '').toString(),
      p_contact_name: data.get('contact_name') || null,
      p_agency: data.get('agency') || null,
      p_tmc_platform: data.get('tmc_platform') || null,
      p_opportunity_code: data.get('opportunity_code') || null,
      p_source_url: window.location.href,
      p_user_agent: navigator.userAgent,
      p_referrer: document.referrer || null,
      p_honeypot: data.get('website') || null,
    };

    if (posthogRef) {
      posthogRef.capture('ta_lead_submit_started', {
        form_type: formType,
        opportunity_code: payload.p_opportunity_code,
      });
    }

    try {
      const res = await fetch(`${TA_SUPABASE_URL}/rest/v1/rpc/fn_submit_ta_lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: TA_SUPABASE_KEY,
          Authorization: `Bearer ${TA_SUPABASE_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('TA lead submit failed', res.status, errText);
        setFormStatus((s) => ({ ...s, [key]: 'error' }));
        if (posthogRef) {
          posthogRef.capture('ta_lead_submit_failed', {
            form_type: formType,
            opportunity_code: payload.p_opportunity_code,
            status_code: res.status,
          });
        }
        return;
      }
      setFormStatus((s) => ({ ...s, [key]: 'sent' }));
      if (posthogRef) {
        posthogRef.capture('ta_lead_submitted', {
          form_type: formType,
          opportunity_code: payload.p_opportunity_code,
          has_tmc_platform: !!payload.p_tmc_platform,
          has_agency: !!payload.p_agency,
        });
        // Light identify by email so we can stitch repeat visits later
        const emailLower = payload.p_email.toLowerCase();
        if (emailLower && posthogRef.identify) {
          posthogRef.identify(emailLower, { email: emailLower });
        }
      }
    } catch (err) {
      console.error('TA lead submit error', err);
      setFormStatus((s) => ({ ...s, [key]: 'error' }));
      if (posthogRef) {
        posthogRef.capture('ta_lead_submit_failed', {
          form_type: formType,
          opportunity_code: payload.p_opportunity_code,
          error: err.message,
        });
      }
    }
  }

  // ============ Opportunities render ============
  let oppList;
  if (opportunities === null) {
    oppList = <div className="opp-loading">Loading active opportunities…</div>;
  } else if (opportunities === 'error') {
    oppList = (
      <div className="opp-empty">
        Active opportunities feed temporarily unavailable. Reach out via the engineering desk for a same-day fit assessment on your solicitation.
      </div>
    );
  } else if (!opportunities.length) {
    oppList = (
      <div className="opp-empty">
        No translator-relevant solicitations open at the moment. <strong>This list refreshes as new bids hit our monitoring sources.</strong> If you are preparing a response right now and want a fit assessment on a specific solicitation, send the solicitation number to <a href="mailto:engineering@traffic-authority.com" className="link">engineering@traffic-authority.com</a>.
      </div>
    );
  } else {
    oppList = (
      <div className="opp-grid">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.opportunity_code}
            opp={opp}
            expanded={expandedOppCodes.has(opp.opportunity_code)}
            onToggle={toggleOpp}
            formStatus={formStatus}
            onSubmit={handleSubmit}
            buttonText={buttonText}
          />
        ))}
      </div>
    );
  }

  // Form status keys for the static (non-opportunity) forms
  const covKey = 'coverage_confirmation';
  const capKey = 'capability_statement';

  return (
    <div className="ta-root">
      <style>{CSS}</style>

      {/* ============ TOP NAV ============ */}
      <nav className="top">
        <div className="wrap inner">
          <div className="brand">
            <span className="mark">TA</span>
            <span>TRAFFIC AUTHORITY</span>
          </div>
          <div className="nav-links">
            <a href="#gap">The Gap</a>
            <a href="#workflow">Workflow</a>
            <a href="#solution">Approach</a>
            <a href="#coverage">Coverage</a>
            <a href="#procurement">Procurement</a>
            <a href="#opportunities">Opportunities</a>
            <a href="#math">Math</a>
            <a href="#capability">Capability</a>
          </div>
          <a href="#contact" className="nav-cta">Contact Procurement</a>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="wrap">
          <div className="stamps reveal">
            <span className="stamp fill">ITS Protocol Translation</span>
            <span className="stamp">Nationwide</span>
            <span className="stamp yellow">Prime — 8(a) · SDVOSB · DBE · HUB · NCTRCA</span>
          </div>
          <h1 className="reveal">
            Your sensors are on the pole.
            <span className="alt">They can't talk to the TMC.</span>
            <span className="we">We fix that.</span>
          </h1>
          <p className="sub reveal">
            Operational protocol translation between modern ITS sensor systems and state DOT, regional tollway, and federal-standard Traffic Management Centers. Delivered through a certified 8(a) / SDVOSB / DBE / HUB / NCTRCA prime on the procurement vehicles your agency already uses.
          </p>
          <div className="ctas reveal">
            <a href="#capability" className="btn primary">Request Capability Statement <span className="arrow">→</span></a>
            <a href="#coverage" className="btn ghost">Confirm Coverage</a>
          </div>
        </div>
      </header>

      {/* ============ § 01 THE GAP ============ */}
      <section className="s" id="gap">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 01 / The Gap</div>
            <h2 className="sec-title">Modern sensors. Legacy backends. Nothing in between.</h2>
            <p className="sec-lede">The sensors going up on US freeways today output modern, structured data. The Traffic Management Center backends they need to feed were specified a generation earlier. Without an operational translation layer, expensive field equipment delivers nothing the operator can use.</p>
          </div>

          <div className="gap-grid reveal">
            <div className="gap-col">
              <span className="label">Status quo</span>
              <h3>Sensors deployed.<br />TMC sees nothing.</h3>
              <div className="meta">Bespoke per corridor &nbsp;·&nbsp; Doesn't compound</div>
              <p>Field engineers have the data. The TMC backend can't read it. Each new corridor restarts the integration from zero. Each one runs the schedule and budget over again.</p>
              <div className="price">— Not solved natively at the sensor layer</div>
            </div>

            <div className="gap-col">
              <span className="label">Alternatives</span>
              <h3>GEC integration.<br />Or an IoT dev shop.</h3>
              <div className="meta">6 to 18 months &nbsp;·&nbsp; Per corridor</div>
              <p>General Engineering Consultants quote 200–400 hours at $200–$400/hour. IoT shops quote in the mid six figures. Both rebuild from scratch on the next corridor.</p>
              <div className="price">$40K–$355K per corridor</div>
            </div>

            <div className="gap-col featured">
              <span className="label">Traffic Authority</span>
              <h3>One operational<br />translation layer.</h3>
              <div className="meta">Weeks not months &nbsp;·&nbsp; Compounds across corridors</div>
              <p>Operational translation layer running on the ITS infrastructure your agency already procures. Purpose-built. Same district engineer interface. No new hardware. No new training. Quoted per corridor, delivered through a certified prime.</p>
              <div className="price">Per-corridor quote &nbsp;·&nbsp; Through certified prime</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ § 02 WORKFLOW ============ */}
      <section className="s" id="workflow">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 02 / Workflow</div>
            <h2 className="sec-title">Tell us the solicitation. We tell you how we plug in.</h2>
            <p className="sec-lede">Five steps. No NDA. No exposure. We never contact your buyer. We never pitch a competing prime on the same solicitation. We engage only if you win. The math works either way — you cannot lose by talking to us.</p>
          </div>

          <div className="workflow-row reveal">
            <div className="wf-step">
              <div className="wf-num">STEP 01</div>
              <h4>Send us the solicitation.</h4>
              <p>RFP number, agency, or scope summary. Email or the form on this page. No NDA required for the initial fit check.</p>
            </div>
            <div className="wf-step">
              <div className="wf-num">STEP 02</div>
              <h4>We confirm fit. Free.</h4>
              <p>Within one business day we tell you whether the translation slice fits, what protocols are in scope, and what the slice looks like inside your response. No charge for the fit assessment.</p>
            </div>
            <div className="wf-step">
              <div className="wf-num">STEP 03</div>
              <h4>You include us in your bid.</h4>
              <p>We provide scope language, integration architecture diagram, and a fixed-price line item you drop into your response. Capability statement and prime certifications attached.</p>
            </div>
            <div className="wf-step">
              <div className="wf-num">STEP 04</div>
              <h4>You submit your bid.</h4>
              <p>We do not contact the buyer. We do not pitch the translation slice to a competing prime on the same solicitation. Your competitive position stays yours.</p>
            </div>
            <div className="wf-step featured">
              <div className="wf-num">STEP 05</div>
              <h4>You win → we execute. You don't → we walk away.</h4>
              <p>If you win, we deliver the translation slice at the quoted fixed price. If you don't, we walk away from the solicitation and you owe us nothing.</p>
            </div>
          </div>

          <div className="workflow-promises reveal">
            <div className="promise">
              <div className="promise-num">Promise 01</div>
              <strong>We never contact your buyer.</strong>
              <p>Not before submission. Not during evaluation. Not after award. The agency hears about the translation slice from you, in your response, on your terms.</p>
            </div>
            <div className="promise">
              <div className="promise-num">Promise 02</div>
              <strong>One prime per solicitation.</strong>
              <p>When you bring us a bid, we will not provide the translation slice to a competing prime on that same procurement. Exclusivity is the rule, not the exception.</p>
            </div>
            <div className="promise">
              <div className="promise-num">Promise 03</div>
              <strong>Free until you win.</strong>
              <p>Fit assessment, scope language, integration diagram — no fees, no NDA. You pay only on execution after you win. If you don't win, we walk away with no further claim.</p>
            </div>
          </div>

          <div className="workflow-closer reveal">
            <div className="closer-text">You <span className="yellow">cannot lose</span> by telling us about the bid.</div>
            <div className="closer-sub">The market structure self-enforces. Our deal flow is primes. Poaching one prime costs us every other prime. The incentive is yours.</div>
          </div>
        </div>
      </section>

      {/* ============ § 03 APPROACH ============ */}
      <section className="s" id="solution">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 03 / Approach</div>
            <h2 className="sec-title">Field data in. TMC-native out. Operational.</h2>
            <p className="sec-lede">An operational translation layer that converts modern ITS sensor data into the protocols your Traffic Management Center already speaks. Purpose-built. Procurement-ready. Delivered through the vehicles your agency already buys through.</p>
          </div>

          <div className="flow-wrap reveal">
            <svg className="flow-svg" viewBox="0 0 1080 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Operational data flow diagram">
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#0e0e10" />
                </marker>
                <pattern id="grid-pat" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0e0e10" strokeOpacity="0.06" strokeWidth="1" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="1080" height="360" fill="url(#grid-pat)" />

              {/* Stage 1: Field sensors */}
              <g>
                <rect x="40" y="120" width="220" height="120" fill="#f4f1ea" stroke="#0e0e10" strokeWidth="1.5" />
                <text x="56" y="148" fontFamily="IBM Plex Mono, monospace" fontSize="11" letterSpacing="1.6" fill="#1d3557" fontWeight="600">FIELD</text>
                <text x="56" y="178" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="22" fontWeight="700" fill="#0e0e10">Modern ITS</text>
                <text x="56" y="200" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="22" fontWeight="700" fill="#0e0e10">sensor equipment</text>
                <text x="56" y="222" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#585858">structured field data</text>
              </g>

              {/* Arrow 1 */}
              <line x1="270" y1="180" x2="380" y2="180" stroke="#0e0e10" strokeWidth="2" markerEnd="url(#arr)" />
              <text x="290" y="170" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.4" fill="#585858">FIELD STREAM</text>

              {/* Stage 2: Translator layer */}
              <g>
                <rect x="390" y="80" width="300" height="200" fill="#0e0e10" />
                <rect x="394" y="84" width="292" height="192" fill="none" stroke="#ffd100" strokeWidth="2" />
                <text x="410" y="116" fontFamily="IBM Plex Mono, monospace" fontSize="11" letterSpacing="1.6" fill="#ffd100" fontWeight="600">TRAFFIC AUTHORITY</text>
                <text x="410" y="156" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="28" fontWeight="700" fill="#f4f1ea">Translation</text>
                <text x="410" y="184" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="22" fontWeight="500" fill="#f4f1ea">Layer</text>
                <text x="410" y="216" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="rgba(244,241,234,0.7)">runs on existing infrastructure</text>
                <text x="410" y="234" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="rgba(244,241,234,0.7)">audit-ready · versioned config</text>
                <text x="410" y="252" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="rgba(244,241,234,0.7)">fixed-price per corridor</text>
              </g>

              {/* Arrow 2 */}
              <line x1="700" y1="180" x2="810" y2="180" stroke="#0e0e10" strokeWidth="2" markerEnd="url(#arr)" />
              <text x="722" y="170" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.4" fill="#585858">TMC-NATIVE</text>

              {/* Stage 3: TMC backends */}
              <g>
                <rect x="820" y="60" width="220" height="56" fill="#f4f1ea" stroke="#0e0e10" strokeWidth="1.5" />
                <text x="834" y="82" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.4" fill="#1d3557" fontWeight="600">A</text>
                <text x="834" y="103" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="16" fontWeight="600" fill="#0e0e10">State DOT TMC</text>

                <rect x="820" y="124" width="220" height="56" fill="#f4f1ea" stroke="#0e0e10" strokeWidth="1.5" />
                <text x="834" y="146" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.4" fill="#1d3557" fontWeight="600">B</text>
                <text x="834" y="167" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="16" fontWeight="600" fill="#0e0e10">Tollway Authority</text>

                <rect x="820" y="188" width="220" height="56" fill="#f4f1ea" stroke="#0e0e10" strokeWidth="1.5" />
                <text x="834" y="210" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.4" fill="#1d3557" fontWeight="600">C</text>
                <text x="834" y="231" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="16" fontWeight="600" fill="#0e0e10">Federal Standards</text>

                <rect x="820" y="252" width="220" height="56" fill="#ffd100" stroke="#0e0e10" strokeWidth="1.5" />
                <text x="834" y="274" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.4" fill="#0e0e10" fontWeight="600">D</text>
                <text x="834" y="295" fontFamily="IBM Plex Sans Condensed, sans-serif" fontSize="16" fontWeight="700" fill="#0e0e10">Manufacturer-native</text>
              </g>
            </svg>
          </div>

          <div className="solution-bullets reveal">
            <div className="b">
              <div className="num">3.1</div>
              <h4>No new hardware</h4>
              <p>Runs on the ITS infrastructure your agency already procures. No additional capital line item. No new vendor evaluation.</p>
            </div>
            <div className="b">
              <div className="num">3.2</div>
              <h4>Audit-ready</h4>
              <p>Full operational logging, versioned configuration, reproducible builds. Suitable for certification documentation and procurement file inclusion.</p>
            </div>
            <div className="b">
              <div className="num">3.3</div>
              <h4>Purpose-built</h4>
              <p>Built specifically for the systems state DOTs, tollway authorities, and freeway operators run today. Not adapted from another industry.</p>
            </div>
            <div className="b">
              <div className="num">3.4</div>
              <h4>Fixed-price corridors</h4>
              <p>Per-corridor quote up front. No time-and-materials creep. No scope-change surprises mid-deployment.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ § 04 COVERAGE ============ */}
      <section className="s" id="coverage">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 04 / Coverage</div>
            <h2 className="sec-title">We cover the systems agencies actually run.</h2>
            <p className="sec-lede">Operational coverage across four categories — applicable to state DOT, tollway authority, and federally-standardized ITS systems in production deployment nationwide. Specific compatibility for your corridor or platform confirmed same-day on request.</p>
          </div>

          <div className="coverage-grid reveal">
            <div className="cov">
              <div className="cov-num">A · State DOT</div>
              <h4>State DOT TMC backends</h4>
              <p>The statewide Traffic Management Center platforms that state DOTs operate today, including the proprietary field-level encodings used by major state transportation departments.</p>
              <div className="cov-status">Operational</div>
            </div>
            <div className="cov">
              <div className="cov-num">B · Tollway</div>
              <h4>Regional tollway authority platforms</h4>
              <p>The operations and incident-routing platforms used by tollway authorities, including custom alert routing for wrong-way detection and camera systems.</p>
              <div className="cov-status">Operational</div>
            </div>
            <div className="cov">
              <div className="cov-num">C · Federal</div>
              <h4>Federal field-level standards</h4>
              <p>The federal field-protocol standards in production deployment across state and local agency ITS programs nationwide.</p>
              <div className="cov-status">Operational · Universal</div>
            </div>
            <div className="cov">
              <div className="cov-num">D · Sensor</div>
              <h4>Manufacturer-native sensor protocols</h4>
              <p>Wire-level compatibility with the major sensor manufacturers deployed across US freeway and arterial corridors.</p>
              <div className="cov-status">Operational · Multi-vendor</div>
            </div>
          </div>

          <div className="coverage-confirm reveal">
            <div className="cc-text">
              <div className="cc-eyebrow">Same-day confirmation</div>
              <h4>Tell us your TMC platform.</h4>
              <p>For specific platform, protocol, or corridor compatibility, send the system name and your agency. We confirm the same business day, in writing, suitable for procurement file inclusion.</p>
            </div>
            <form data-ta-form="coverage_confirmation" onSubmit={handleSubmit}>
              <input type="text" name="tmc_platform" placeholder="TMC / ATMS platform name" required />
              <input type="text" name="agency" placeholder="Agency" required />
              <input type="email" name="email" className="full" placeholder="your.name@agency.gov" required />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <button type="submit" disabled={isDisabled(covKey)}>
                {buttonText(covKey, 'coverage_confirmation', 'Request compatibility confirmation')}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ============ § 05 PROCUREMENT ============ */}
      <section className="s" id="procurement">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 05 / Procurement</div>
            <h2 className="sec-title">Bought through vehicles your agency already trusts.</h2>
            <p className="sec-lede">Traffic Authority is delivered as a prime through a certified GovCon procurement stack. Lead with cooperative purchasing contracts your agency already buys through. Federal and state-direct vehicles available alongside.</p>
          </div>

          <div className="vehicles reveal">
            <div className="vehicle lead">
              <div className="v-num">05.1 · LEAD</div>
              <h4>TIPS USA</h4>
              <p>Nationwide cooperative purchasing contract. Member agencies in all 50 states. First-priority add for direct cooperative procurement.</p>
              <div className="vstat pending">○ Queued — Q2 2026</div>
            </div>
            <div className="vehicle">
              <div className="v-num">05.2</div>
              <h4>Sourcewell — ITS</h4>
              <p>Nationwide cooperative purchasing contract for ITS equipment and services. Authorized-seller filing in process.</p>
              <div className="vstat pending">○ In Process</div>
            </div>
            <div className="vehicle">
              <div className="v-num">05.3</div>
              <h4>BuyBoard</h4>
              <p>Regional municipal and county cooperative used across multiple states for public agency procurement.</p>
              <div className="vstat pending">○ Queued</div>
            </div>
            <div className="vehicle">
              <div className="v-num">05.4</div>
              <h4>State-direct procurement</h4>
              <p>State agency cooperative and direct procurement vehicles, including state-operated IT and engineering schedules.</p>
              <div className="vstat pending">○ Research</div>
            </div>
            <div className="vehicle">
              <div className="v-num">05.5</div>
              <h4>Direct award / sole-source</h4>
              <p>For agencies with discretionary innovation programs or sole-source justification needs, direct contracting through the certified prime is supported today.</p>
              <div className="vstat live">● Available</div>
            </div>
            <div className="vehicle">
              <div className="v-num">05.6</div>
              <h4>GSA Schedule + SAM.gov</h4>
              <p>Federal procurement vehicles via the prime's existing federal contracting registration.</p>
              <div className="vstat live">● Active (SAM.gov) · Roadmap (GSA)</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ § 06 OPPORTUNITIES ============ */}
      <section className="s" id="opportunities">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 06 / Opportunities</div>
            <h2 className="sec-title">Active solicitations. Plug us in as your translation slice.</h2>
            <p className="sec-lede">We are not a competing bidder. We are the protocol translation layer that any winning prime adds to their response. Tap any open opportunity below if your team is preparing a response and the scope mentions modern sensors, LiDAR, ITS modernization, or DOT-protocol integration.</p>
          </div>

          <div className="opp-list-wrap reveal">
            {oppList}
          </div>

          <div className="opp-footnote reveal">
            <strong>Don't see your bid?</strong> We monitor SAM.gov, BidNet, TxDOT Letting, state portals, and major regional cooperatives. New translator-relevant solicitations post here as they hit. If you're preparing a response right now and don't see your bid yet, send the solicitation number to <a href="mailto:engineering@traffic-authority.com" className="link">engineering@traffic-authority.com</a> and we'll respond within one business day with a fit assessment.
          </div>
        </div>
      </section>

      {/* ============ § 07 MATH ============ */}
      <section className="s" id="math">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 07 / Math</div>
            <h2 className="sec-title">Our math works with your math. No matter what.</h2>
            <p className="sec-lede">Pricing is token-based — anchored to modern AI economics. There is a small operational floor of compute, deployment, and audit logging. Above the floor, cost is driven by the AI work performed on each translation slice, and that scales linearly with the contract. The practical result: whatever your contract math allows for a translation slice, our quote fits inside it. At any contract size.</p>
          </div>

          <div className="gap-grid reveal">
            <div className="gap-col">
              <span className="label">The floor</span>
              <h3>Small by design.</h3>
              <div className="meta">Compute &nbsp;·&nbsp; Deployment &nbsp;·&nbsp; Audit logging</div>
              <p>The operational minimum is set low so that even a sources-sought response or an innovation-pilot-scale contract can absorb the translation slice. No labor-hour floor. No staffing minimum that prices us out of smaller corridors.</p>
              <div className="price">Fits a $50K pilot</div>
            </div>

            <div className="gap-col">
              <span className="label">The scale</span>
              <h3>Linear with AI work.</h3>
              <div className="meta">More protocols &nbsp;·&nbsp; More corridors &nbsp;·&nbsp; More complexity</div>
              <p>Above the floor, cost tracks the AI work actually performed on the translation slice — token by token. A multi-corridor program pays proportionally more than a single-corridor pilot, and a higher-complexity protocol mix pays proportionally more than a clean one. The math is contract-shaped, not vendor-shaped.</p>
              <div className="price">Fits a $50M program</div>
            </div>

            <div className="gap-col featured">
              <span className="label">What you see</span>
              <h3>One fixed-price line.</h3>
              <div className="meta">Per corridor &nbsp;·&nbsp; Up front</div>
              <p>The token model is how we calculate internally. What your procurement file sees is a single fixed-price translation slice with integration scope and deliverables itemized. No time-and-materials. No surprise overruns. The same model holds at any contract size — so we never renegotiate when the program scales.</p>
              <div className="price">Our math works with yours. No matter what.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ § 08 CAPABILITY STATEMENT ============ */}
      <section className="s" id="capability">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 08 / Capability</div>
            <h2 className="sec-title">Capability statement. Sized for your procurement file.</h2>
            <p className="sec-lede">Single-page summary suitable for district engineer review, set-aside qualification, and capability file inclusion. Lists certifications, NAICS codes, past performance summary, and the engagement model. Per-corridor quote letter follows on request.</p>
          </div>

          <div className="cap-grid reveal">
            <div className="cap-download">
              <div>
                <div className="doc-icon"><span /></div>
                <h4>Traffic Authority Capability Statement</h4>
                <p>One-page PDF. Suitable for procurement file inclusion, sole-source justification packets, and set-aside qualification review.</p>

                <div className="doc-meta">
                  <span className="kv"><span className="k">DOC</span>TA-CS-1.2</span>
                  <span className="kv"><span className="k">ISSUED</span>MAY 2026</span>
                  <span className="kv"><span className="k">CLASS</span>PUBLIC</span>
                  <span className="kv"><span className="k">PAGES</span>1</span>
                </div>
              </div>
              <a href="#contact" className="btn-dl">Request PDF →</a>
            </div>

            <div className="cap-detail">
              <div className="cap-block">
                <div className="ctitle">Prime Certifications</div>
                <ul>
                  <li>SBA 8(a) Business Development Program</li>
                  <li>SDVOSB — Service-Disabled Veteran-Owned Small Business</li>
                  <li>DBE — Disadvantaged Business Enterprise</li>
                  <li>HUB — Historically Underutilized Business</li>
                  <li>NCTRCA — North Central Texas Regional Certification Agency</li>
                  <li>SAM.gov registered · active</li>
                </ul>
              </div>

              <div className="cap-block">
                <div className="ctitle">NAICS Codes</div>
                <div className="codes">
                  <span className="code-pill">541330 · Engineering services</span>
                  <span className="code-pill">541512 · Computer systems design</span>
                  <span className="code-pill">541519 · Other computer services</span>
                  <span className="code-pill">541618 · Other management consulting</span>
                  <span className="code-pill">237310 · Highway, street & bridge</span>
                </div>
              </div>

              <div className="cap-block">
                <div className="ctitle">Past Performance Highlights</div>
                <ul>
                  <li>Tier-1 defense prime contractor — multi-year contracting history</li>
                  <li>Department of Defense — overseas theater delivery</li>
                  <li>Federal and state government supply contracts</li>
                  <li>20+ years enterprise data integration leadership</li>
                </ul>
              </div>

              <div className="cap-block">
                <div className="ctitle">Engagement Model</div>
                <ul>
                  <li>Capability statement review &nbsp;·&nbsp; same-day</li>
                  <li>Coverage confirmation &nbsp;·&nbsp; same-day, in writing</li>
                  <li>Corridor scoping &nbsp;·&nbsp; 1–2 weeks</li>
                  <li>Fixed-price quote letter &nbsp;·&nbsp; 1 business day after scope</li>
                  <li>Deployment &nbsp;·&nbsp; weeks not months</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ § 09 STRUCTURE ============ */}
      <section className="s" id="structure">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 09 / Structure</div>
            <h2 className="sec-title">Two roles. Plug-in by design.</h2>
            <p className="sec-lede">A certified prime contracting wrapper handles all customer-facing procurement. The translation platform plugs in as a sub on any prime's response. The customer always knows who owns what, and the prime gets the certifications attached for free.</p>
          </div>

          <div className="team-grid reveal">
            <div className="team-col">
              <div className="role">Prime Wrapper · Procurement</div>
              <h3>Certified prime backing</h3>
              <p>An 8(a) / SDVOSB / DBE / HUB / NCTRCA prime carries all procurement, contracting, and delivery management. Tier-1 defense prime contractor past performance and Department of Defense overseas theater delivery. When you sub the translation platform onto your response, you also get the prime certifications attached.</p>
              <div className="creds">
                <span className="cred">8(a)</span>
                <span className="cred">SDVOSB</span>
                <span className="cred">DBE</span>
                <span className="cred">HUB</span>
                <span className="cred">NCTRCA</span>
                <span className="cred">SAM.gov</span>
              </div>
            </div>
            <div className="team-col">
              <div className="role">Translation Slice · Sub-Recruitment</div>
              <h3>Translation platform</h3>
              <p>The protocol translation layer itself — edge-local, containerized, audit-ready. Engineers all corridor-specific configuration. Generates the integration scope, capability fit, and technical proposal sections of your response.</p>
              <p>20+ years of enterprise data integration leadership. We don't compete with you for the prime spot. We plug in.</p>
              <div className="creds">
                <span className="cred">Edge-local</span>
                <span className="cred">Containerized</span>
                <span className="cred">Audit-ready</span>
                <span className="cred">Sub-position</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ § 10 CONTACT ============ */}
      <section className="s" id="contact">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-num">§ 10 / Contact</div>
            <h2 className="sec-title">Two routing paths. Pick the one that fits.</h2>
            <p className="sec-lede">For RFPs, IFBs, RFQs, capability statement requests, and procurement vehicle questions, route to procurement. For corridor-specific coverage confirmation and engineering discovery, route to engineering.</p>
          </div>

          <div className="contact-grid reveal">
            <div>
              <div className="contact-block">
                <div className="ctype">Procurement &amp; Contracting</div>
                <h4>Prime contracting desk</h4>
                <div className="cnote">RFPs, IFBs, RFQs, vehicle questions, capability statement detail, contract execution.</div>
                <a href="mailto:procurement@traffic-authority.com" className="email">procurement@traffic-authority.com</a>
              </div>

              <div className="cap-request">
                <div className="ctype">Capability statement request</div>
                <h4>One-page PDF, sent same business day.</h4>
                <p className="cnote">For procurement files, sole-source justification, set-aside qualification, or any first-touch with a state DOT or tollway authority.</p>
                <form data-ta-form="capability_statement" onSubmit={handleSubmit}>
                  <input type="text" name="contact_name" placeholder="Your name" required />
                  <input type="text" name="agency" placeholder="Agency / role" />
                  <input type="email" name="email" className="full" placeholder="your.name@agency.gov" required />
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  <button type="submit" disabled={isDisabled(capKey)}>
                    {buttonText(capKey, 'capability_statement', 'Request capability statement')}
                  </button>
                </form>
              </div>
            </div>

            <div className="contact-block">
              <div className="ctype">Engineering &amp; Coverage</div>
              <h4>Technical desk</h4>
              <div className="cnote">Corridor-specific coverage confirmation, engagement scoping, district engineer technical Q&amp;A, capability statement detail requests.</div>
              <a href="mailto:engineering@traffic-authority.com" className="email">engineering@traffic-authority.com</a>
              <div className="phone">+1 (415) 205-8585</div>
              <p style={{ marginTop: 18, fontSize: 14, color: 'var(--ink-2)' }}>
                Same-day response on coverage and protocol questions during business hours. Response by next business day on detailed corridor scoping requests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="wrap row">
          <div className="legal">
            <strong style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em' }}>TRAFFIC AUTHORITY</strong><br />
            ITS Protocol Translation · Operational Nationwide<br />
            Delivered through a certified 8(a) / SDVOSB / DBE / HUB / NCTRCA prime.<br />
            <span style={{ opacity: 0.7 }}>© 2026 Traffic Authority · All rights reserved · traffic-authority.com</span>
          </div>
          <div className="doc-id">
            <span className="kv"><span className="k">DOC-REV</span> · 1.8</span>
            <span className="kv"><span className="k">ISSUED</span> · MAY 2026</span>
            <span className="kv"><span className="k">SCOPE</span> · NATIONWIDE</span>
            <span className="kv"><span className="k">CLASSIFICATION</span> · PUBLIC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
