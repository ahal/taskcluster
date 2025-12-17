# GitHub Service

The GitHub service monitors all of the repositories associated with an organization for changes and schedules Taskcluster tasks for any repository which contains a `.taskcluster.yml` configuration file.

## Components

### API Server
Listens for WebHooks and, if they are valid, forwards them to a pulse exchange.

### Handlers
Listen for WebHook-triggered pulse messages and attempts to schedule Taskcluster tasks for any events related to a repository which contains a `.taskcluster.yml` file.

## Configuration

### Custom Pulse Messages

The `.taskcluster.yml` file (v1 only) supports an optional top-level `messages` field that allows you to publish custom messages to a dedicated pulse exchange after the config is processed.

**Exchange:** `exchange/taskcluster-github/v1/custom`

**Routing Key Format:** `primary.<organization>.<repository>.<topic>.<event>`
- `<organization>`: GitHub organization
- `<repository>`: GitHub repository
- `<topic>`: User-defined topic from your config
- `<event>`: Event type with `github-` prefix stripped (e.g., `push`, `pull-request`, `release`)

**Features:**
- Messages are rendered with JSON-e, giving you access to `event`, `tasks_for`, `taskcluster_root_url`, and `as_slugid`
- Published after `.taskcluster.yml` is processed, regardless of whether tasks are created
- Useful for triggering external workflows, notifications, or integrations

**Example:**
```yaml
version: 1
messages:
  - topic: build-status
    context:
      environment: production
      buildType: release
      commitSha: {$eval: event.after}
      branch: {$eval: event.ref}
      pusher: {$eval: event.pusher.email}
  - topic: deployment-ready
    context:
      timestamp: {$eval: now}
      repository: {$eval: event.repository.full_name}
tasks:
  - $if: 'tasks_for == "github-push"'
    then:
      taskId: {$eval: 'as_slugid("test")'}
      provisionerId: my-provisioner
      workerType: my-worker
      # ... rest of task definition
```

**Listening to custom messages:**

Subscribe to the exchange with routing key patterns using AMQP wildcards:
- `*` (star) - matches exactly one word
- `#` (hash) - matches zero or more words

Examples:
- `primary.myorg.myrepo.build-status.#` - All build-status from myorg/myrepo (any event)
- `primary.#.build-status.push` - All build-status messages on push events (any org/repo)
- `primary.myorg.#.deployment-ready.#` - All deployment-ready from myorg (any repo/event)
- `primary.myorg.myrepo.#` - All messages from myorg/myrepo (any topic/event)
- `primary.#` - All custom messages

**Message payload:**

Each custom message includes:
- `event` - The full GitHub webhook event body (repository, pusher, commits, etc.)
- `context` - Your custom context defined in `.taskcluster.yml`
- `organization`, `repository`, `topic` - Metadata about the message
- `installationId`, `eventId`, `tasks_for` - Additional GitHub context
- `taskGroupId` - The task group ID associated with this GitHub event (always present)

In a Taskcluster hook template, access these as:
- `${payload.event.repository.name}` - GitHub repository name
- `${payload.event.pusher.email}` - Pusher email
- `${payload.context.trustDomain}` - Your custom context values
- `${payload.taskGroupId}` - Task group ID (always available)

**Note:** Topics can contain dots (e.g., `build.status`), which will be treated as part of the topic word, not as routing key separators.

#### Reporting Hook-Triggered Tasks to GitHub Checks

Hooks triggered by custom messages can create tasks that appear in the GitHub Checks UI by using the same `taskGroupId` as the GitHub event.

**Hook Task Configuration:**

Create hook tasks in the same task group as the GitHub event. The `taskGroupId` is always available in custom messages, even when `.taskcluster.yml` doesn't define any tasks.

```json
{
  "taskGroupId": "${payload.taskGroupId}",
  "schedulerId": "taskcluster-github",
  "routes": ["checks"],
  "metadata": {
    "name": "Hook-triggered Task",
    "description": "Task triggered by custom pulse message",
    "owner": "${payload.event.pusher.email}",
    "source": "${payload.event.repository.url}"
  },
  ...
}
```

**How it works:**
- GitHub service generates a `taskGroupId` for every GitHub event
- This ID is stored in the database and passed to custom messages
- Hook tasks using this `taskGroupId` automatically appear in the GitHub Checks UI
- All tasks with the same `taskGroupId` are grouped together in GitHub

**Example Hook Configuration:**

```json
{
  "hookGroupId": "project-myproject",
  "hookId": "post-build-analysis",
  "bindings": [{
    "exchange": "exchange/taskcluster-github/v1/custom",
    "routingKeyPattern": "primary.myorg.myrepo.build-status.#"
  }],
  "task": {
    "taskGroupId": "${payload.taskGroupId}",
    "schedulerId": "taskcluster-github",
    "routes": ["checks"],
    "provisionerId": "my-provisioner",
    "workerType": "my-worker",
    "metadata": {
      "name": "Post-build Analysis",
      "description": "Analyze build results for ${payload.event.repository.full_name}@${payload.event.after}",
      "owner": "${payload.event.pusher.email}",
      "source": "${payload.event.repository.url}"
    },
    "payload": {
      "image": "my-image:latest",
      "command": ["analyze", "${payload.context.commitSha}"]
    }
  }
}
```

**Note:** The `taskGroupId` is available in json-e templates within `.taskcluster.yml` as well, accessible via `${taskGroupId}`.

## Contributing

### Run Tests
No special configuration is required for development.

Run `yarn workspace @taskcluster/github test` to run the tests. Some of the tests will be skipped without additional credentials, but it is fine to make a pull request as long as no tests fail.

To run all of the tests, you'll first need to set up your credentials based on how they are in `user-config-example.yml`. Ask a Taskcluster team member for the AWS keys, etc.

Run `yarn install` and `yarn workspace @taskcluster/github test`.

To test the components separately, run:
- server: `<set the environment variables> node services/github/src/main.js server`
- handlers: `<set the environment variables> node services/github/src/main.js worker`

## Copyright notes

Emoji fonts for this project were taken from:
- [Mozilla Firefox OS Emojis](https://github.com/mozilla/fxemoji)
- [Google Internationalization (i18n)](https://github.com/googlei18n/noto-emoji) (provided under the [SIL Open Font License, version 1.1](https://github.com/googlei18n/noto-emoji/blob/master/fonts/LICENSE))
- [EmojiOne](http://emojione.com/) (provided under the [Creative Commons License](http://emojione.com/licensing/))
