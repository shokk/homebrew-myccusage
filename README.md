# homebrew-myccusage

Homebrew tap for **MyCcusage** — a local web dashboard for [`ccusage`](https://www.npmjs.com/package/ccusage) usage data. Shows daily/weekly/monthly AI agent usage (cost, tokens, cache) with filtering and sorting, auto-refreshing every minute.

![MyCcusage screenshot](docs/screenshot.png)

## Install

```bash
brew tap shokk/myccusage
brew trust shokk/myccusage
brew install myccusage
```

`brew trust` is a one-time step Homebrew requires for any third-party tap the first time you use it (not specific to this formula) — without it, `brew install` will fail with "Refusing to load formula ... from untrusted tap."

## Requirements

MyCcusage reads data through the [`ccusage`](https://formulae.brew.sh/formula/ccusage) CLI. It's a Homebrew dependency of this formula, so `brew install myccusage` installs it automatically — no separate step needed.

## Usage

```bash
myccusage
```

Starts a local server at `http://127.0.0.1:4318` (localhost only by default) and prints the URL. Open it in a browser.

```
Usage: myccusage [options]

Options:
  -p, --port <number>   Port to listen on (default: 4318, or $PORT)
      --host <address>  Address to bind to (default: 127.0.0.1, localhost-only).
                         Pass --host 0.0.0.0 to allow other devices on your
                         network to reach this dashboard.
  -v, --version          Print the version and exit
  -h, --help             Print this help and exit
```

By default nothing is exposed beyond this machine. If you want to check usage from another device on your network, run `myccusage --host 0.0.0.0` — be aware this makes your cost/token data reachable to anyone on that network, with no authentication.

### Run it as a background service

Running `myccusage` directly ties up that terminal (it's a foreground process, same as any local server). To run it persistently in the background instead — survives closing your terminal, restarts automatically if it crashes, and can auto-start on login — use Homebrew Services:

```bash
brew services start myccusage   # start now + register for every login
brew services run myccusage     # start now only, no login registration
brew services stop myccusage    # stop it
brew services restart myccusage # e.g. after upgrading
brew services info myccusage    # check status
```

Logs go to `/opt/homebrew/var/log/myccusage.log` (or the equivalent under your Homebrew prefix).

`brew services` doesn't accept extra CLI flags, so to change the port or host for the background service, set them via an env file instead:

```bash
mkdir -p ~/.homebrew/services
echo 'HOST=0.0.0.0' >> ~/.homebrew/services/myccusage.env
echo 'PORT=4318' >> ~/.homebrew/services/myccusage.env
brew services restart myccusage
```

### What the dashboard gives you

- **Granularity**: daily, weekly, or monthly, matching `ccusage`'s own grouping
- **Date range filter**: native calendar picker (from/to), passed straight through to `ccusage --since`/`--until`
- **Agent and model filters**: dropdowns populated from whatever agents/models actually appear in your data (Claude, Codex, Gemini, Grok, etc. — whatever `ccusage` detects)
- **Sortable columns**: click any column header to sort by it, click again to reverse. Period defaults to most-recent-first.
- **Summary cards**: total cost and token breakdown (input/output/cache create/cache read) for the current filter
- **Light / dark / system theme**, remembered across visits
- **Auto-refresh**: polls every 60 seconds; a "Refresh now" button forces an immediate reload

Nothing is cached or stored server-side — every request runs `ccusage` fresh, and nothing leaves your machine.

## How it works

The formula installs `server.js` and `public/` (a small dependency-free Node app — no `npm install` step, no bundler) into `libexec`, and writes a `myccusage` wrapper script into `bin` that runs it with Homebrew's own `node`. That wrapper also resolves `ccusage`'s exact installed path and passes it via `CCUSAGE_BIN`, rather than relying on `ccusage` being found on `PATH` at runtime — this matters because `brew services` (launchd/systemd) runs with a minimal `PATH` that doesn't include Homebrew's `bin` directory. The server shells out to `ccusage <daily|weekly|monthly> --json --by-agent [--since --until]` on each request and serves the result as JSON; the frontend is static HTML/CSS/JS that polls that endpoint.

## Uninstall

If you started it with `brew services`, stop it first (uninstalling doesn't do this for you):

```bash
brew services stop myccusage
brew uninstall myccusage
brew untap shokk/myccusage
```

## License

MIT
