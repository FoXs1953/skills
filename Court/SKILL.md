---
name: court
description: >-
  Put an idea on trial in front of a jury of 12 Claudes. A prosecutor Claude
  argues it fails, a defense Claude argues it works, they rebut each other,
  12 juror Claudes with different backgrounds vote on their own, and a judge
  Claude reads the verdict and the conditions that would flip it. Use when the
  user wants honest pushback instead of agreement, says Claude just agrees with
  everything, asks "is this a good idea", wants an idea, plan, pitch or claim
  stress-tested, or says "court" or "put it on trial".
  Also supports OpenAI models in Codex with the same trial workflow, including
  requests that ChatGPT just agrees with everything.
argument-hint: "[--jury N | --quick] [--seed S] <the idea, plan or claim>"
license: MIT
metadata:
  author: "FoXs1953"
  homepage: "https://chen.media"
  source: "https://github.com/alexyc9381/court-skill"
  version: "1.0.0"
---

# court

## Codex / OpenAI compatibility

In Codex, apply this section when the original instructions below refer to Claude Code tools,
paths or interface controls. In Claude Code, follow the original instructions below as before.
The trial roles, juror lenses, flags, phases, retry rules and vote counting stay the same.

### Invocation and file paths

- In Codex CLI or the IDE, invoke the installed skill as `$court`, for example
  `$court --quick Should I launch this idea?`, or select it from `/skills`.
  Read the case and flags from the actual user request: `$ARGUMENTS` is a Claude Code placeholder,
  not a variable that Codex must expand. Keep the original conversation fallback for a blank case.
- Keep `SKILL.md`, `court.py` and `jurors.json` together in one skill directory. For local Codex
  discovery, that directory can be `.agents/skills/court/` in a project or
  `~/.agents/skills/court/` for the user. These are placement instructions, not an instruction to
  install files or change configuration during a trial.
- Resolve the absolute directory of the `SKILL.md` that was actually loaded. Do not assume that
  `CLAUDE_SKILL_DIR` exists. In Codex, `COURT` below means `python3` followed by the absolute path
  to `court.py` beside that file, for example:

  ```bash
  python3 "/absolute/path/to/court/court.py" plan --quick
  ```

  Replace the example path with the resolved path. Use it for every command, including the short
  `python3 court.py ...` commands printed by the script. Run all bookkeeping commands from the
  same working directory so they share `.court/LATEST`; do not change into the skill directory.
  The script uses Python 3's standard library and does not call a model API itself.

### Independent agents in Codex

When running a trial, explicitly delegate each opening, rebuttal, juror and judge job to a separate
Codex sub-agent. Here, "Claude" and "Claudes" in the original workflow mean the corresponding
OpenAI agents; preserve the original author credit and the script's output. Use the user's chosen
OpenAI model and reasoning settings where the client supports them; otherwise keep the existing
sub-agent defaults. Do not invent model identifiers or switch providers.

Map Step 4's Claude Code `Agent` / `Task` calls to the native sub-agent tools actually available in
the Codex session (such as `spawn_agent` and the corresponding wait/status tools). Use their
declared schemas, not Claude's `subagent_type` or `description` fields. Select a general-purpose
agent with file write access where an agent type is offered, and identify it by phase and job id.

- Start each job in a fresh context without inheriting the parent conversation. If the tool
  exposes `fork_turns`, use `"none"`; otherwise use the client's documented fresh-context option
  or default. Never reuse an agent for a different job or juror.
- Pass the absolute brief path as the job prompt/message: `Read <brief path> and follow it
  exactly. It is your whole brief.` Also instruct the agent to use only that brief and its named
  trial files as evidence, write only the required output file, and not delegate further or run
  bookkeeping commands. Jurors must not read other jurors' briefs, votes or agent messages.
- The script prints waves of at most six jobs. If Codex has fewer available slots, split a wave
  into smaller batches, even one job at a time. Wait for all jobs in the current batch to finish
  before the next batch, and finish the whole wave before the next wave. Release completed agents
  if the client requires it to free slots. A timeout is not completion.
- Agents share the trial's working directory and files. Verify their output files, then use
  `COURT next` and the original missing-output retry rules. Keep tallying and rendering in the
  parent clerk; never write arguments, votes or the judgment on behalf of an agent.

Before starting a trial, verify that Python, shared file access and fresh-context sub-agents are
available. If they are unavailable, explain what is missing instead of simulating independent
agents in one conversation. In Step 1, the Shift+Tab / accept-edits advice applies only to Claude
Code. In Codex, use its current permission settings and surface actual access failures; do not
change settings automatically or request approvals that the current environment does not need.

Host references: [Codex skills](https://learn.chatgpt.com/docs/build-skills) and
[Codex sub-agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

For when Claude agrees with everything you say. Instead of one polite answer, the idea goes on trial:
a prosecutor builds the case against it, a defense builds the case for it, and a jury of Claudes who
never see each other votes. You are the clerk of the court. You never argue, never vote, and never
soften the verdict.

What the user typed after `/court`: `$ARGUMENTS`

If that is blank, or still reads like a placeholder, take the case from the conversation: the idea,
plan or claim the user most recently wanted an opinion on.

## The tool

Every piece of bookkeeping goes through `court.py` in this skill's folder:

```bash
python3 "${CLAUDE_SKILL_DIR}/court.py" <command>
```

Below, `COURT` means exactly that command. If the path looks unexpanded, use the "Base directory for
this skill" that Claude Code printed at the top of this skill. The state lives in
`.court/<run>/state.json` in the current directory, and every command after `init` finds it through
`.court/LATEST`.

## Step 1: size it

Read the flags out of the request. Everything that is not a flag is the case.

| flag | meaning |
| --- | --- |
| `--jury N` | N jurors, 3 to 12. Default 12. |
| `--quick` | 6 jurors. |
| `--seed S` | Fixes which jurors sit on a smaller jury. Default: random, and recorded. |

Run `COURT plan` with the same flags and tell the user in one line how big the trial is, for example
"12 jurors, 17 sub-agent calls", then start. If this skill fired on its own (the user never asked for
a trial), ask once first and offer `--quick`.

Sub-agents write into `.court/` in the current directory. In the default permission mode that is one
approval per file. Suggest accept-edits mode (Shift+Tab) for the trial. Do not change the user's
settings yourself.

## Step 2: write the case file

**Sub-agents cannot see this conversation.** The prosecutor, the defense, every juror and the judge
know only what is in the case file, so write `.court/case.md` to stand on its own:

- First line: the case in one sentence, in the user's own words where you can ("Quit my job to sell
  candles on Etsy full time").
- Then everything the user told you that matters: numbers, audience, budget, timeline, what they have
  already tried, constraints.
- Do not add facts the user never gave, and do not write your own opinion of the idea into it. A case
  file that leans one way decides the trial before it starts.

## Step 3: open the trial

```bash
COURT init --case-file .court/case.md [--jury N | --quick] [--seed S]
```

## Step 4: the trial

Always drive it with `COURT next`. It reads the files on disk and tells you the next phase and the
exact command. The phases run in this order: `opening`, `rebuttal`, `jury`, `judge`.

Every phase works the same way:

1. `COURT prompts <phase>` writes one brief per job and lists the jobs still to run, in waves.
2. Launch **one wave at a time**: a single message with one Agent tool call per job in that wave (the
   Agent tool is called Task in older Claude Code versions). Each call is:
   - `subagent_type`: `general-purpose`
   - `description`: `court <job id>`
   - `prompt`: `Read <brief path> and follow it exactly. It is your whole brief.`

   Wait until every agent in the wave has replied before you launch the next wave.
3. After the last wave, run `COURT next`. If an output is missing it sends you back to the same phase,
   and `prompts` then lists only the missing jobs. Re-run those once. If a juror fails twice, write
   the single line `NO VOTE` into its file (`COURT check jury` lists it) and move on. Never write a
   vote, a statement or a judgment yourself.

## Step 5: the verdict

When `COURT next` says the trial is over:

```bash
COURT render
```

It counts the votes, writes `VERDICT.md` into the run folder and prints it. Show the user the verdict
line, the vote table and the judge's sections exactly as written. Then add at most two lines of your
own: the single condition for acquittal you would start with, and the path to the full trial.

Rules for you, the clerk:

- Never change, soften or re-count the verdict. A guilty verdict is useful information, not bad news
  to cushion.
- Never add praise the jury did not give.
- If the user disagrees with the verdict, offer a retrial with the changes from "Conditions for
  acquittal" written into a new case file. Do not argue for either side yourself.
