# Code City

An idle pixel-art city for [Claude Code](https://claude.com/claude-code). It lives in a side pane and grows while you work: every prompt brings new citizens, every edit and command earns bricks, and the tokens you use buy landmarks, all the way up to an orbital ring.

Each project gets its own city. Run several sessions in one project and they share it; open the map to see every city you've built as an island in the same sea.

## Install

In a Claude Code terminal session:

```
/plugin install code-city --marketplace verdantran/claude-city
```

Answer `y` to add the marketplace, then pick a scope (user scope makes it available in every project). The pane opens by itself in wide terminals; anywhere else, type `/city`.

## Using it

| Command or key | What it does |
| --- | --- |
| `/city` | Open the pane and show the city's size and balance |
| `/city shop` | Open the shop under the city |
| `/city buy <item>` | Buy by exact name or a unique prefix of 3+ letters, e.g. `/city buy ferris` |
| `/city map` | Switch between the street and the isometric map of all your cities |
| `s` / `v` / `z` | Shop, map, and zoom: these work once the pane has the keyboard (click it, or `ctrl+x tab`) |

### How the city grows

- **Prompts** bring citizens. **Edits and new files** earn bricks. **Shell commands** earn power, which builds factories.
- **Passing tests** plant a park and bring a rainbow. **A failed command** brings a brief shower. **A commit** sets off fireworks.
- **Subagents** fly over the city as drones while they work, and pay bricks when they land.
- The city keeps building on its own between your actions: cranes, new lots, taller towers, and a subway once it reaches Town size.
- **Tokens** used in the project become a balance to spend in the shop on street trees, a Ferris wheel, a stadium, a space elevator and more. Cache reads count a tenth, matching how they're billed.

Weather, day and night, pedestrians and seasons come along for free.

## What it stores, and where

Nothing is ever written inside your projects. Everything lives under your home folder:

| Path | Contents |
| --- | --- |
| `~/.claude/code-city/cities/<project-path>--<hash>/` | Each project's city: buildings, counters and token totals, plus a small lock file and one earnings file per session (numbers only) |
| `~/.claude/code-city/presence/<session-id>.json` | Each running session's project name, city size and the types of any running subagents, so sessions can see each other. Blanked when the session ends. |
| `~/.claude/plugins/store/code-city_*.json` | A private backup of each city, keyed by project path |

No prompts, code, commands, file contents or subagent task descriptions are written to disk. Folder names do include each project's path. On a Mac shared with other accounts, `chmod 700 ~/.claude/code-city` keeps the shared files private to you.

## Safety

The plugin was reviewed for security over several passes. In short:

- It never alters your prompts, Claude's tool calls or results, or the model's replies, and its bookkeeping runs after each hook returns, so it can't slow your work.
- It makes no shell, network or model calls.
- Everything it reads from disk is validated and size-limited, text from outside is stripped of control characters before it reaches your terminal, and it writes only inside `~/.claude/code-city`, refusing links and files it didn't create.
- The game state is shared through plain files, so anything already running as you could fake it. That can only affect the game.

## Uninstall

From a terminal:

```sh
claude plugin uninstall code-city
```

To remove its data as well, delete `~/.claude/code-city` and `~/.claude/plugins/store/code-city_*.json`.

## Development

The plugin is a hooks module (`hooks/register.tsx`) with plain TypeScript helpers alongside it. To run a working copy:

```sh
git clone https://github.com/verdantran/claude-city.git
claude --plugin-dir ./claude-city
```

Claude Code writes the API type declarations into `.claude-plugin/types/` when it loads the plugin, after which `tsc -p .` type-checks it.

```sh
claude plugin validate .
claude plugin test .
```

## License

MIT, see [LICENSE](LICENSE).
