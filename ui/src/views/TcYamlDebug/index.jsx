import React, { Component, Fragment } from 'react';
import { withApollo } from 'react-apollo';
import { withStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import { dump, load } from 'js-yaml';
import debounce from 'lodash.debounce';
import jsone from 'json-e';
import TextField from '../../components/TextField';
import CodeEditor from '../../components/CodeEditor';
import Dashboard from '../../components/Dashboard';
import Button from '../../components/Button';
import urls from '../../utils/urls';
import { siteSpecificVariable } from '../../utils/siteSpecific';
import ajv from '../../utils/ajv';
import fromNowJSON from '../../utils/fromNowJSON';
import * as testPayloads from './test-payload';
import scrollToHash from '../../utils/scrollToHash';

const prefetchSchema = async () => {
  ajv.addSchema(
    await (await fetch(urls.schema('common', 'metaschema.json'))).json()
  );
  ajv.addSchema(
    await (
      await fetch(urls.schema('github', 'v1/taskcluster-github-config.json'))
    ).json(),
    'github-v0'
  );
  ajv.addSchema(
    await (
      await fetch(urls.schema('github', 'v1/taskcluster-github-config.v1.json'))
    ).json(),
    'github-v1'
  );
};

prefetchSchema();

const isValidYamlUrl = url => {
  const urlRe = /(.*)\/\.taskcluster.yml$/;
  const parsed = new URL(url);
  const allowedHosts = ['raw.githubusercontent.com'];

  return allowedHosts.includes(parsed.hostname) && urlRe.test(parsed.pathname);
};

// we embed JSON-e here, which looks a lot like a template to eslint..
/* eslint-disable no-template-curly-in-string */

const getTaskDefinition = state => {
  const { commands, image, taskName, taskDescription } = state;
  const taskQueueId =
    siteSpecificVariable('tutorial_worker_pool_id') ||
    'proj-getting-started/tutorial';

  return dump({
    version: 1,
    reporting: 'checks-v1',
    policy: {
      pullRequests: 'public',
    },
    tasks: {
      $let: {
        head_rev: {
          $switch: {
            'tasks_for == "github-pull-request"':
              '${event.pull_request.head.sha}',
            'tasks_for == "github-push"': '${event.after}',
            $default: 'UNKNOWN',
          },
        },
        repository: {
          $if: 'tasks_for == "github-pull-request"',
          then: '${event.pull_request.head.repo.html_url}',
          else: '${event.repository.html_url}',
        },
      },
      in: {
        $match: {
          'tasks_for == "github-pull-request" && event["action"] in ["opened", "synchronize"]': {
            taskId: { $eval: 'as_slugid("test")' },
            deadline: { $fromNow: '1 day' },
            taskQueueId,
            metadata: {
              name: taskName,
              description: taskDescription,
              owner: '${event.sender.login}@users.noreply.github.com',
              source: '${event.repository.url}',
            },
            payload: {
              maxRunTime: 3600,
              image,
              command: commands,
            },
          },
        },
      },
    },
  });
};

const getCustomContext = () => {
  return dump({
    timestamp: Math.floor(new Date()),
    organization: 'test-org',
    repository: {
      url: 'url',
      project: 'project',
    },
    push: {
      branch: 'branch',
      revision: 'rev',
    },
    ownTaskId: 'own-task-id',
  });
};

const testJsoneEvent = (doc, extraContext, event, tasksFor, action) => {
  const cfg = { ...doc };

  if (cfg.version !== 1) {
    cfg.$fromNow = text => fromNowJSON(text);
  }

  const context = {
    event,
    tasks_for: tasksFor,
    action,

    // v1
    taskcluster_root_url: 'https://tc.root',
    ref: 'refs/heads/master',
    as_slugid: text => `${text.replace(/[^a-zA-Z0-9_-]/g, '_')}_slugid`,

    ...extraContext,
  };

  return jsone(cfg, context);
};

@withApollo
@withStyles(theme => ({
  separator: {
    padding: theme.spacing(2),
    paddingBottom: 0,
  },
  editorListItem: {
    paddingTop: 0,
  },
  checkIcon: {
    fill: theme.palette.success.main,
  },
  errorIcon: {
    fill: theme.palette.error.main,
  },
  errorPanels: {
    marginTop: theme.spacing(2),
  },
  iconContainer: {
    marginLeft: theme.spacing(1),
    marginTop: theme.spacing(2),
    flexBasis: '10%',
    display: 'flex',
    justifyContent: 'center',
  },
  mainHeading: {
    paddingLeft: theme.spacing(2),
  },
  codeEditor: {
    height: 480,
  },
  contextEditor: {
    height: 220,
  },
  findingsTable: {
    fontSize: 14,
    '& td, th': {
      margin: 0,
      padding: theme.spacing(0.5),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    '& tr': {
      verticalAlign: 'top',
    },
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    border: '1px solid #ccc',
    padding: theme.spacing(2),
  },
  textField: {
    width: '60%',
  },
}))
export default class TcYamlDebug extends Component {
  constructor(props) {
    super(props);

    const search = new URLSearchParams(this.props.location.search);

    this.state = {
      findings: [],
      taskclusterYmlUrl: search.get('url'),
      isValidUrl: true,
      validationMessage: '',
      urlChanged: false,
      editorValue: getTaskDefinition({}),
      extraContext: getCustomContext(),
    };
  }

  componentDidMount() {
    this.loadTaskclusterYml();
  }

  handleEditorChange = editorValue => {
    this.setState({
      editorValue,
    });
    this.analyzeLazy();
  };

  handleExtraContextChange = extraContext => {
    this.setState({
      extraContext,
    });
    this.analyzeLazy();
  };

  handleTaskclusterYmlUrlChange = e => {
    this.setState({
      taskclusterYmlUrl: e.target.value,
    });
    this.validateUrlDebounced();
  };

  validateUrlDebounced = debounce(() => this.validateUrl(), 1000);

  validateUrl() {
    const { history } = this.props;
    const isValidUrl = isValidYamlUrl(this.state.taskclusterYmlUrl);

    this.setState({
      isValidUrl,
      validationMessage: isValidUrl
        ? ''
        : 'Invalid URL: should be https://raw.githubusercontent/**/.taskcluster.yml file in a GitHub repository',
    });

    if (isValidUrl) {
      history.push({
        search: `?url=${encodeURIComponent(this.state.taskclusterYmlUrl)}`,
        hash: '#findings',
      });
      this.loadTaskclusterYml();
    }
  }

  analyzeLazy = debounce(() => this.handleAnalyze(), 1000);

  async loadTaskclusterYml() {
    const { taskclusterYmlUrl } = this.state;

    if (!isValidYamlUrl(taskclusterYmlUrl)) {
      return;
    }

    try {
      const data = await (await fetch(taskclusterYmlUrl)).text();

      this.setState({
        editorValue: data,
        urlChanged: true,
      });
      this.analyzeLazy();
    } catch (e) {
      this.setState({
        editorValue: `# Error loading ${taskclusterYmlUrl}: ${e.message}`,
      });
    }
  }

  handleAnalyze = () => {
    this.setState({ findings: [] });
    const findings = [];
    const addFinding = (type, sentiment, message, tasks, extra) =>
      findings.push({ type, sentiment, message, tasks, extra });
    let doc;
    let extraContext;
    let schema = 'github-v1';

    try {
      doc = load(this.state.editorValue);
      extraContext = load(this.state.extraContext);
      addFinding('parser', '✅', 'Valid YAML - nice!');
    } catch (e) {
      addFinding('parser', '⛔️', e.message);
    }

    if (!doc) {
      return;
    }

    if (doc.version !== 1) {
      addFinding(
        'version',
        '⛔️',
        'Not using version 1',
        null,
        'Please migrate to version 1'
      );
      schema = 'github-v0';
    } else {
      addFinding('version', '✅', 'Using version 1');
    }

    const validation = ajv.validate(schema, doc);

    if (validation) {
      addFinding('schema', '✅', 'Valid schema, amazing!');
    } else {
      ajv.errors.forEach((error, i) => {
        addFinding(
          `schema-${i}`,
          '⚠️',
          `${error.instancePath} ${error.message} ${JSON.stringify(
            error.params
          )}`
        );
      });
    }

    if (doc?.reporting !== 'checks-v1') {
      addFinding(
        'reporting',
        '⚠️',
        'Not using checks API',
        null,
        'Checks API are more flexible and is recommended'
      );
    } else {
      addFinding('reporting', '✅', 'Using checks API');
    }

    if (doc?.autoCancelPreviousChecks !== true) {
      addFinding(
        'autoCancelPreviousChecks',
        '⚠️',
        'Not using autoCancelPreviousChecks to cancel redundant builds',
        null,
        'This can save resources when changes are pushed frequently for the same PR'
      );
    } else {
      addFinding(
        'autoCancelPreviousChecks',
        '✅',
        'Using autoCancelPreviousChecks to save resources'
      );
    }

    if (!doc?.tasks) {
      addFinding('tasks', '⛔️', 'No tasks defined!');
    }

    const runEvent = (name, payload, tasksFor, action) => {
      const isOkAction =
        !action || ['opened', 'synchronize', 'reopened'].includes(action);

      try {
        const parsed = testJsoneEvent(
          doc,
          extraContext,
          payload,
          tasksFor,
          action
        );
        const tasksCount = parsed?.tasks?.length || 0;
        const suspicious = !isOkAction && tasksCount > 0;

        addFinding(
          `${name}-tasks`,
          suspicious ? '⛔️' : '✅',
          tasksCount === 0
            ? 'no tasks'
            : `${tasksCount} task(s) defined ${
                suspicious ? ', but normally should be 0' : ''
              }`,
          parsed?.tasks
        );
      } catch (e) {
        addFinding(
          name,
          '⛔️',
          [
            e.message,
            e.location ? e.location.join('.') : '',
            e.lineNumber ? `line: ${e.lineNumber}` : '',
            e.columnNumber ? `column: ${e.columnNumber}` : '',
          ].join(' ')
        );
      }
    };

    runEvent('github-push', testPayloads.push, 'github-push');
    runEvent('github-tag-push', testPayloads.tagPush, 'github-push');
    runEvent('github-release', testPayloads.release, 'github-release');
    runEvent(
      'github-pull-request-untrusted.opened',
      testPayloads.pullRequest,
      'pull-request-untrusted',
      'opened'
    );
    [
      'opened',
      'synchronize',
      'reopened',
      // rest is suspicious if produces tasks
      'assigned',
      'auto_merge_disabled',
      'auto_merge_enabled',
      'closed',
      'converted_to_draft',
      'dequeued',
      'edited',
      'enqueued',
      'labeled',
      'ready_for_review',
      'review_requested',
      'review_request_removed',
      'unassigned',
      'unlabeled',
    ].forEach(action =>
      runEvent(
        `github-pull-request.${action}`,
        { ...testPayloads.pullRequest, action },
        'github-pull-request',
        action
      )
    );

    runEvent('custom-task-for-cron', testPayloads.push, 'cron');
    runEvent('custom-task-for-action', testPayloads.push, 'action');

    if (this.state.urlChanged && findings.length > 1) {
      setTimeout(() => scrollToHash(), 100);
    }

    this.setState({ findings, urlChanged: false });
  };

  renderFindings() {
    const { findings } = this.state;

    if (!findings.length) {
      return;
    }

    return (
      <table className={this.props.classes.findingsTable} id="findings">
        <thead>
          <tr>
            <th>?</th>
            <th>Type</th>
            <th>Message</th>
            <th>Extra</th>
          </tr>
        </thead>
        <tbody>
          {findings.map(({ type, sentiment, message, tasks, extra }) => (
            <tr key={type}>
              <td>{sentiment} </td>
              <td>
                <strong>{type}</strong>
              </td>
              <td>{message}</td>
              <td>
                {extra}
                {tasks?.length ? (
                  <details>
                    <summary>Rendered tasks</summary>
                    <pre className={this.props.classes.code}>{dump(tasks)}</pre>
                  </details>
                ) : (
                  ''
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  render() {
    const { classes } = this.props;
    const { taskclusterYmlUrl, isValidUrl, validationMessage } = this.state;

    return (
      <Dashboard title="GitHub .taskcluster.yml debug" disableTitleFormatting>
        <Fragment>
          <Typography className={classes.mainHeading} variant="h6">
            Lint your <code>.taskcluster.yml</code>
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                disableTypography
                primary={
                  <Typography variant="subtitle1">
                    Your .taskcluster.yml
                  </Typography>
                }
              />
              <TextField
                label="Link to .taskcluster.yml"
                name="taskclusterYmlUrl"
                onChange={this.handleTaskclusterYmlUrlChange}
                value={taskclusterYmlUrl}
                className={classes.textField}
                error={!isValidUrl}
                helperText={validationMessage}
              />
            </ListItem>
            <ListItem className={classes.editorListItem}>
              <CodeEditor
                onChange={this.handleEditorChange}
                mode="yaml"
                value={this.state.editorValue}
                className={this.props.classes.codeEditor}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                disableTypography
                primary={
                  <Typography variant="subtitle2">Extra context</Typography>
                }
              />
            </ListItem>
            <ListItem className={classes.contextListItem}>
              <CodeEditor
                onChange={this.handleExtraContextChange}
                mode="yaml"
                value={this.state.extraContext}
                className={this.props.classes.contextEditor}
              />
            </ListItem>
            <ListItem>
              <Button
                spanProps={{ className: classes.analyzeButton }}
                tooltipProps={{ title: 'Analyze' }}
                onClick={this.handleAnalyze}
                variant="contained"
                color="primary">
                Analyze
              </Button>
            </ListItem>
            <ListItem>{this.renderFindings()}</ListItem>
          </List>
        </Fragment>
      </Dashboard>
    );
  }
}