# Smart Diabetes Digital Twin and Personalised Health Management Platform

Swinburne University of Technology Sarawak Campus  
Supervisor: Ts. Dr. Vong Wan Tze

## Overview

A web platform that brings diabetes records, glucose monitoring, forecasting and account administration into connected workspaces for patients, doctors and administrators.

## Problem and objective

Diabetes follow-up involves information spread across clinical records and glucose readings. The project brings these records into one website so users can review trends and explore model forecasts alongside their source data.

## Website functions

**Patient workspace:** Home dashboard, personal profile, glucose monitoring and ambulatory glucose profile, My digital twin, saved prediction history under Lab results, reports, recommendations page and text-size settings. My digital twin offers 6-hour and 12-hour GRU glucose forecasts, baseline comparisons and what-if schedules. Saved results retain their model version. Lab results are saved model outputs, not measured laboratory tests.

**Doctor workspace:** Cohort overview, patient search and filtering, patient management, access to patient records, recorded reports and settings. Doctors can open an assigned patient's workspace for detailed review. The separate Doctor Digital twin menu and route have been removed; My digital twin remains in the patient workspace.

**Administrator workspace:** Account management, Doctor application review, patient-to-Doctor assignments, activity history, model retraining and settings. Retraining uses the latest Supabase CGM records; successful runs update online predictions. Browser and static models remain fixed snapshots.

## System workflow

Sign in → Role-specific workspace → Authorized patient records → Review glucose trends → Open the patient's My digital twin → Compare forecasts and scenarios → Save results and review reports.

## Implementation

React and TypeScript frontend; Flask API; Supabase authentication, clinical records and access policies; GRU glucose forecasting; Neo4j clinical knowledge graph integration. The knowledge graph is available to authorized doctors within the patient workspace; its recommendation review interface is a prototype.

## Project outcome

An integrated website with three user roles, recorded glucose charts, patient-specific forecasts, saved prediction snapshots and administrative controls. Measured, calculated, predicted and simulated values are distinguished in the interface. No clinical accuracy or patient-outcome claims are made.

## Future work

Evaluate forecasts on held-out patients, validate scenario responses, and complete clinician-reviewed recommendation delivery.

## Source and design notes

- Source repository: https://github.com/AA-4499/FYP-A-Sep-2026
- Remote main synchronized through commit `47c5948` into `TrainingModel`.
- Reference: user-provided `C:/Users/USER/Downloads/FYP_Poster.pptx`.
- Use an English, A0 portrait academic poster with white background, red headings, two-column structure and readable diagrams inspired by the reference.
- Do not reproduce template placeholder names, placeholder email, instructional text, sample charts or unverified quantitative results.
- No student name or email was supplied; omit them.
