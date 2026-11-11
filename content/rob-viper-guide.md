---
title: "ROB Viper user manual and RedAgent inventory guide"
url: "/products/rob-viper/guide/"
description: "ROB Viper 0.8.1: scanner updates, platform CVEs, affected-product lookup, public test and patch reading, and the full RedAgent installed-app inventory."
draft: false
---

Updated November 10, 2026 for **ROB Viper 0.8.1 (18)**. The **RedAgent 0.3.0 pilot downloads** now include the inventory workflow described here and the new Cloud Fleet controls. The Viper app remains a development preview with a public production installer pending. Install the current [RedAgent development pilot](/r/#inventory) and open its **Installed apps** tab to follow these steps.

[Download the illustrated user manual (35 pages)](/downloads/rob-viper/manual/ROB-Viper-User-Manual-0.8.1.pdf) · [Manual SHA-256](/downloads/rob-viper/manual/SHA256SUMS.txt) · [Security Operations Handbook, PDF and EPUB](/books/rob-viper-security-operations/)

## What changed

- **Tool updates at launch:** Viper compares ClamAV, Trivy and YARA-X with Homebrew stable versions and package revisions. **Review tool updates** opens Threat Center → **Tools & databases**. **Check for updates** repeats the check. Upgrades remain manual; **Refresh databases** updates detection data separately. Unavailable checks do not mean current.
- **Background schedules:** the per-user scan agent runs saved schedules after Viper and its menu helper close. The Mac must be awake and the account logged in. Check registration, Login Items approval, heartbeat and the last completed report. Manual remains the default.
- **Saved-policy recovery:** **Start monitoring** retries a blocked saved-policy read without resetting rules. **Update extension** installs a newer bundled service when offered. Recheck actual service state afterward.
- **Platform CVE library:** Command-Shift-V opens macOS, Linux and Windows records. Select 7, 30 or 90 days of modified records, distribution/release groups, reported-version text, severity and source filters.
- **Affected-product index:** search names, vendors, packages and aliases. Inspect reported ranges, mapped/unmapped coverage and original CVEs; export the selected scope or prepare a pinned RedAgent test.
- **Public tests and patches:** browse supported files referenced by the CVE as text, view per-file diffs or a full source file at its referenced commit, and save a copy with source/time/hash evidence. Browsing executes no tests and applies no patches.

## Run the local inventory test

1. In Viper, open **Vulnerabilities → Applications**. Choose the target platform, time window and any release group. Review mapping coverage.
2. Choose **Prepare RedAgent test**. Keep `plan.json`, `application-index.json` and `README.txt` together in the new test folder. Copy that folder to the intended host if needed.
3. Open a compatible RedAgent build **on that host**. Choose a private evidence folder, then **Installed apps → Choose test**. Select the folder containing `plan.json`.
4. Verify **Expected hostname**. An IP entered in Network tests is unrelated to local installed-app inventory.
5. Choose **Preview inventory test** and review the platform, scope and pinned index. Then choose **Run inventory test** for the reviewed host.
6. Read the outcome and coverage gaps. The unique evidence case contains inventory, report, pinned inputs and a SHA-256 receipt. Keep it together.
7. After restarting, choose **Open saved result** and select the case’s `report.json`.

The collector reads macOS bundle/OS metadata, Linux dpkg/rpm package databases or Windows uninstall registry entries using ordinary user access. It does not launch inventoried apps, run CVE tests, probe network targets, install software, apply patches or upload the inventory. Missing metadata and unsupported locations remain coverage limits.

## See the full application list

Choose **Show → All applications**. A findings count is not the inventory count. Search names, aliases, versions, publishers, paths or CVE IDs; combine **Show** and **Source** filters. Click column headings to sort, and use **Clear filters** to restore the full list. Enlarge the window to expand the list and details.

| Status | Meaning |
| --- | --- |
| Potential match | The installed name matched the pinned catalog. Review vendor, product, version and advisory conditions. |
| No index match | No name candidate was found in this catalog. This does not establish safety. |
| Not assessed | The entry remains visible without a completed assessment. Review report coverage. |

Catalog aliases are grouped into one row per installed entry. Separate installations remain separate rows. Saved results verify the sibling inventory against the recorded hash. If that file is missing or changed, RedAgent explicitly falls back to retained candidate entries; it cannot reconstruct the missing full list.

## Resolve common errors

- **Missing `plan.json`:** choose the exact exported folder again. Check date suffixes and avoid selecting its parent. Do not create an empty replacement plan.
- **Hash mismatch:** restore the original test package or prepare a fresh one. Do not change the expected digest to suppress the error.
- **Wrong host or platform:** review where the collector is running and which platform the plan declares.
- **Only a few results:** clear filters and select All applications. Compare the displayed count with the case’s inventory total. Candidate products are a smaller set.
- **Completed with gaps:** inspect missing metadata, access limits, unsupported collectors or cancellation. A completed result is not a clean security verdict.

## Interpret the evidence

The application index hashes normalized identity keys; it is not an executable-hash catalog. Keyword CVE feeds are not exhaustive. Reported OS version filtering matches source text, not numeric ranges. RedAgent retains installed versions but does not decide whether they fall inside affected ranges. A match requires review, and absence of a match never proves the host safe.

[Product and release status](/products/rob-viper/) · [Privacy and security scope](/products/rob-viper/privacy/) · [Free handbook](/books/rob-viper-security-operations/)
