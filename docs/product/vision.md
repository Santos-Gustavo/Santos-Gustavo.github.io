# Product Vision

*Change this rarely. If it's changing often, it's not a vision, it's a roadmap item — put it in roadmap.md instead.*

## Direction

A simple app for Portuguese renovation companies to create professional quotes, document work, manage project evidence/photos, generate structured progress reports, and communicate clearly with clients.

## Target User

- Small empreiteiros / renovation companies, ~1–4 workers
- Operates primarily through WhatsApp
- Residential renovation: bathrooms, kitchens, painting, flooring, plumbing, electricity, repairs

## Standing Strategic Risk

The app already has real technical surface area (Supabase, Auth, RLS, Storage, PDFs, WhatsApp workflows, Playwright E2E). It is easy to spend months improving technically interesting software without proving contractors will pay for the added complexity. Every feature decision should be checked against this.

## The Four Standing Questions

- **Gemini:** Will an empreiteiro care/pay for this?
- **ChatGPT:** What exactly are we building, and how will we prove it works?
- **Claude:** What's the simplest reliable implementation?
- **Gustavo:** What evidence justifies the next hour/euro?
