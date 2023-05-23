const util = require('util');
const exec = util.promisify(require('child_process').execFile);
const got = require('got');
const { readRepoFile, modifyRepoFile, modifyRepoYAML } = require('../../utils');

/**
 * Update the Go version to match everywhere, treating that in `.go-version`
 * as authoritative.
 */
exports.tasks = [{
  title: 'Go Version',
  provides: ['target-go-version'],
  run: async (requirements, utils) => {
    const goVersion = (await readRepoFile('.go-version')).trim();
    const goVersionMajor = goVersion.replace(/^go([0-9]+)\.[0-9]+\.[0-9]+$/, '$1');
    const goVersionMinor = goVersion.replace(/^go[0-9]+\.([0-9]+)\.[0-9]+$/, '$1');
    const goVersionBugfix = goVersion.replace(/^go[0-9]+\.[0-9]+\.([0-9]+)$/, '$1');
    utils.step({ title: 'Checking go version' });

    const errmsg = `'yarn generate' requires ${goVersion}.  Consider using https://github.com/moovweb/gvm.`;
    let version;
    try {
      version = (await exec('go', ['version'])).stdout.split(/\s+/)[2];
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Cannot find \`go\`.  ${errmsg}`);
      }
    }
    if (version !== goVersion) {
      throw new Error(`Found ${version}.  ${errmsg}`);
    }

    utils.step({ title: `Setting go version ${goVersion} in source files` });

    utils.status({ message: 'dev-docs/development-process.md' });
    await modifyRepoFile('dev-docs/development-process.md',
      contents => contents.replace(
        /Go version go[0-9.]+/,
        `Go version ${goVersion}`));

    utils.status({ message: 'dev-docs/node-and-go-upgrades.md' });
    await modifyRepoFile('dev-docs/node-and-go-upgrades.md',
      contents => contents.replace(
        /install go[0-9.]+/,
        `install ${goVersion}`,
      ).replace(
        /use go[0-9.]+/,
        `use ${goVersion}`,
      ));

    utils.status({ message: 'go.mod' });
    await modifyRepoFile('go.mod',
      contents => contents.replace(
        /^go [0-9.]+$/m,
        `go ${goVersionMajor}.${goVersionMinor}`));

    utils.status({ message: 'workers/generic-worker/build.sh' });
    await modifyRepoFile('workers/generic-worker/build.sh',
      contents => contents.replace(
        /go [0-9.]+ or higher/g,
        `go ${goVersionMajor}.${goVersionMinor} or higher`,
      ).replace(
        /GO_MAJOR_VERSION=[0-9]+/,
        `GO_MAJOR_VERSION=${goVersionMajor}`,
      ).replace(
        /MIN_GO_MINOR_VERSION=[0-9]+/,
        `MIN_GO_MINOR_VERSION=${goVersionMinor}`));

    utils.status({ message: 'workers/generic-worker/gw-decision-task/tasks.yml' });
    await modifyRepoFile('workers/generic-worker/gw-decision-task/tasks.yml',
      contents => contents.replace(
        /go [0-9]+\.[0-9]+\.[0-9]+/g,
        `go ${goVersionMajor}.${goVersionMinor}.${goVersionBugfix}`,
      ).replace(
        /gopath[0-9]+\.[0-9]+\.[0-9]+/g,
        `gopath${goVersionMajor}.${goVersionMinor}.${goVersionBugfix}`,
      ).replace(
        /go[0-9]+\.[0-9]+\.[0-9]+/g,
        `${goVersion}`));
    const goDownloadsJson = await got('https://go.dev/dl/?mode=json&include=all', { throwHttpErrors: true }).json();
    const goFilesArr = goDownloadsJson.find(el => el.version === goVersion).files;
    await modifyRepoYAML('workers/generic-worker/gw-decision-task/tasks.yml',
      contents => {
        let goMounts = contents.Mounts[goVersion].content;
        for (const os in goMounts) {
          if(Object.prototype.hasOwnProperty.call(goMounts, os)) {
            for (const arch in goMounts[os]) {
              if(Object.prototype.hasOwnProperty.call(goMounts[os], arch)) {
                const sha256 = goFilesArr.find(file => goMounts[os][arch].url.includes(file.filename)).sha256;
                goMounts[os][arch].sha256 = sha256;
              }
            }
          }
        }
      });
    await modifyRepoFile('workers/generic-worker/gw-decision-task/tasks.yml',
      contents =>
        `###########################################################################
# Values in this file are generated by                                    #
# infrastructure/tooling/src/generate/generators/go-version.js and        #
# infrastructure/tooling/src/generate/generators/golangci-lint-version.js #
# DO NOT CHANGE HERE!                                                     #
###########################################################################
${contents}`,
    );

    utils.status({ message: 'generic-worker.Dockerfile' });
    await modifyRepoFile('generic-worker.Dockerfile',
      contents => contents.replace(
        /FROM golang:[0-9]+\.[0-9]+\.[0-9]+/,
        `FROM golang:${goVersionMajor}.${goVersionMinor}.${goVersionBugfix}`,
      ));
  },
}];
