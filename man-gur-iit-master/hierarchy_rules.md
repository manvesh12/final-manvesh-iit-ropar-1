# Role Hierarchy and Permission Rules

This document outlines the clear, strict hierarchy and permission rules implemented in the Smart DSR Automation Portal for different user roles: **Officer (Report Coordinator)**, **Reviewer (Section Reviewer)**, and **Admin (System Administrator)**.

---

## 1. Role Capabilities

### 🟢 Officer (Report Coordinator / DEO)
* **Write Access**: FULL. Can initialize projects, edit text fields, modify all tables, update graphs, and upload frontmatter/chapters/plates.
* **Review Access**: NONE. Cannot comment, return, or approve reports.
* **Audit Logs & Users**: NONE. Cannot access admin panels.
* **Mandatory Reply Policy**: If a report is returned by a reviewer, the Officer **must** reply to the reviewer comments on the dashboard banner before they are allowed to submit the report for review.

### 🟡 Reviewer (Section Reviewer)
* **Write Access**: NONE (Read-Only). All tables, editable inputs, text areas, and upload actions are disabled or hidden.
* **Review Access**: FULL. Can add review comments on sections via floating notes and return/approve reports using the reviewer action bar.
* **Audit Logs & Users**: NONE. Cannot access admin panels.

### 🔴 Admin (System Administrator)
* **Officer Capabilities**: FULL (Write access to all tables, graphs, uploads, and project initialization).
* **Reviewer Capabilities**: FULL (Can add review comments, approve reports, and return reports).
* **Admin Capabilities**: FULL (Full access to User Management and System Audit Logs dashboards).

---

## 2. Session Reset (Fresh Login Behavior)
* On logout and login, the system clears all active project selections, state snapshots, and caches.
* Every login starts completely fresh on the Dashboard, preventing cross-user state persistence.
