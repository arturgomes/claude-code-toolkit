# Pre-write secret scrub

Mandatory before **every** write that leaves this machine's working memory: a vault note, a PR body, a
ledger row, a Jira comment, a gate receipt, a captured output tail. Runs first, before the write, never
after.

## What to scrub

Scan the content about to be written and replace with the redaction marker `[REDACTED]`:

- API keys, access keys, secret keys, bearer / auth tokens, session tokens
- passwords, connection strings (`postgres://…`, `mongodb+srv://…`), private keys
- `.env` file contents, or any `KEY=value` line sourced from an env file
- third-party service or vendor names that would leak an internal integration

## Executable predicate

Must return no hits, or the offending text must be `[REDACTED]` before the write proceeds:

```bash
grep -nEi '(api[_-]?key|secret|token|password|passwd|BEGIN [A-Z ]*PRIVATE KEY|[a-z]+://[^ ]*:[^ ]*@|\.env|AKIA[0-9A-Z]{16})' <<<"$CONTENT" \
  && echo "SCRUB REQUIRED: redact to [REDACTED] before write" || echo "scrub clean"
```

## Captured command output is the high-risk case

Gate receipts, loop ledgers, and failure reports all quote command output, and command output is where
credentials actually appear — a failing DB test prints its connection string, a failing deploy prints
its token. **Scrub the tail before it is recorded**, and record only the redacted tail. Quote the
shortest decisive line rather than a whole log; a smaller quote is a smaller leak.

**Never transmit captured output — logs, env dumps, raw command output — to any external service.** The
scrub runs locally; redacted values never leave the machine and never reach the vault un-redacted.
