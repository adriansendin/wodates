# Security policy

## Supported versions

Security fixes are applied to the **default branch** (`main`) when practical. Older tags may not receive backports unless explicitly maintained.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security vulnerabilities.

Instead:

1. Open a **private security advisory** on GitHub (Repository → **Security** → **Report a vulnerability**), or  
2. Contact the repository maintainers through a private channel if one is published on the repository or organization profile.

Include:

- A short description of the issue and its impact  
- Steps to reproduce (proof-of-concept if possible)  
- Affected components (e.g. `backend-api`, `mobile-app`, `ai-service`)  
- Any suggested fix (optional)

We will acknowledge receipt as soon as we can and coordinate disclosure and patching.

## Scope notes

- Treat **Supabase service role keys**, **database URLs**, and **third-party API keys** as highly sensitive. Never commit them to the repository.  
- Client apps may bundle public configuration; do not embed privileged server secrets in mobile or web builds.
