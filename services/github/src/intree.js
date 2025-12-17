import TcYaml from './tc-yaml.js';

/**
 * Returns a function that merges an existing taskcluster github config with
 * a pull request message's payload to generate a full task graph config.
 *  params {
 *    config:             '...', A yaml string
 *    payload:            {},    GitHub WebHook message payload
 *    schema:             url,   Url to the taskcluster config schema
 *  }
 **/
export const setup = async function({ cfg, schemaset }) {
  const validate = await schemaset.validator(cfg.taskcluster.rootUrl);

  return function({ config, payload, schema, taskGroupId }) {
    const version = config.version;

    const errors = validate(config, schema[version]);
    if (errors) {
      throw new Error(errors);
    }

    // Extract messages before deleting version and other metadata fields
    const messages = config.messages;

    //
    // We need to toss out the config version number; it's the only
    // field that's not also in graph/task definitions
    delete config.version;
    // Also delete messages as it's not part of the task graph
    delete config.messages;

    const tcyaml = TcYaml.instantiate(version);

    // Perform parameter substitutions. This happens after verification
    // because templating may change with schema version, and parameter
    // functions are used as default values for some fields.
    config = tcyaml.substituteParameters(config, cfg, payload, taskGroupId);

    // Compile individual tasks, filtering any that are not intended
    // for the current github event type. Append taskGroupId while
    // we're at it.
    const result = tcyaml.compileTasks(config, cfg, payload, new Date().toJSON());

    // Attach messages to the result so they can be published to pulse
    if (messages !== undefined && messages.length > 0) {
      // Render messages with json-e just like tasks
      result.messages = tcyaml.renderMessages(messages, cfg, payload, taskGroupId);
    }

    return result;
  };
};

export default { setup };
