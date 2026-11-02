# Production deployment

- Public URL: https://diff-equa.vercel.app
- Alternate project URL: https://diff-equa-planglou-3415.vercel.app
- Status: READY / production
- Project: diff-equa (`prj_emMHeea1qO9rse9NBZxZPCoeziCA`)
- Owner scope: planglou-3415
- Deployment: `dpl_EhuuC35GtejKLH8XtY6o3JNxjBRS`
- Source commit: `1ec2a1644872ff67141b325bd6df493f4b2ca612`
- Framework: React/Vite static build; Node.js 24.x
- Build duration: about 19.4 seconds

## Deployment method

The Vercel account did not have a GitHub Login Connection. The source was pushed to `planglou-oss/diff-equa`, then the tested frontend source was uploaded through the authenticated Vercel plugin to the project above.

For the API upload, a build-only helper downloads all 854 public PNGs from the immutable source commit above and verifies each SHA-256 filename. The helper and a build-command override are included in that deployment's source; they are transport support rather than changes to the app. The actual served site includes the images locally under `/study/media/` and does not fetch GitHub images at runtime. The source content is the same reviewed public snapshot. No private database or API key was uploaded.

GitHub automatic deployment is **not connected yet**. To enable it, connect the intended GitHub account in Vercel and attach this project to `planglou-oss/diff-equa`. The repository's original `vercel.json` uses the complete committed public assets, so Git deployments can run `npm run build:static --prefix frontend` without the transport helper. Keep Root Directory at the repository root.

Production aliases are public. Vercel Standard Protection (`prod_deployment_urls_and_all_previews`) remains enabled for generated deployment URLs and preview deployments.

## Verification

A fresh unauthenticated Chrome session against the public production URL passed direct links/refresh, year sorting and topic tags, full LaTeX rendering, persistent notes/status/favorites, local issue-note download, choice grading, practice resume after reload and completed scoring, formulas, and mobile layout (390x844). No browser page errors, HTTP failures, or `/api` requests occurred.

The served data SHA-256 matches its manifest; all 427 questions and 10 choice keys are present, chatbot availability is false, and the latest 123 authored explanations are included.

- Runtime error/fatal scan: no matching logs in the last 10 minutes after deployment. A 1-hour query exceeded the Hobby retention boundary; the narrower query succeeded.
- Drains: none configured.
- Monitoring: build logs and browser verification completed; no continuous external monitoring configured. The deployment is static and has no application backend functions.

Proof screenshots: [desktop](vercel-production-preview.png), [mobile](vercel-production-mobile.png).
