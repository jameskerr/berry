const {
  fs: {writeJson},
  exec: {execFile},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`version check`, () => {
    test(
      `it should pass for basic repositories`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await run(`version`, `check`);
      }),
    );

    test(
      `it should detect that a workspace changed vs master`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await git(`checkout`, `-b`, `my-feature`);

        await writeJson(`${path}/packages/pkg-c/wip.json`, {});

        await expect(run(`version`, `check`)).rejects.toThrow();
      }),
    );

    test(
      `it shouldn't throw if a modified workspace has been bumped`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await git(`checkout`, `-b`, `my-feature`);

        await writeJson(`${path}/packages/pkg-c/wip.json`, {});
        await run(`packages/pkg-c`, `version`, `patch`, `--deferred`);

        await run(`version`, `check`);
      }),
    );

    test(
      `it shouldn't throw if a modified workspace has declined to be bumped`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await git(`checkout`, `-b`, `my-feature`);

        await writeJson(`${path}/packages/pkg-c/wip.json`, {});
        await run(`packages/pkg-c`, `version`, `decline`, `--deferred`);

        await run(`version`, `check`);
      }),
    );

    test(
      `it should detect that a dependent workspace changed vs master`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await git(`checkout`, `-b`, `my-feature`);

        await writeJson(`${path}/packages/pkg-a/wip.json`, {});
        await run(`packages/pkg-a`, `version`, `decline`, `--deferred`);

        await expect(run(`version`, `check`)).rejects.toThrow();
      }),
    );

    test(
      `it shouldn't throw if a dependent workspace has been bumped`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await git(`checkout`, `-b`, `my-feature`);

        await writeJson(`${path}/packages/pkg-a/wip.json`, {});
        await run(`packages/pkg-a`, `version`, `decline`, `--deferred`);
        await run(`packages/pkg-c`, `version`, `patch`, `--deferred`);

        await run(`version`, `check`);
      }),
    );

    test(
      `it shouldn't throw if a dependent workspace has declined to be bumped`,
      makeVersionCheckEnv(async ({path, run, source, git}) => {
        await git(`checkout`, `-b`, `my-feature`);

        await writeJson(`${path}/packages/pkg-a/wip.json`, {});
        await run(`packages/pkg-a`, `version`, `decline`, `--deferred`);
        await run(`packages/pkg-c`, `version`, `decline`, `--deferred`);

        await run(`version`, `check`);
      }),
    );
  });
});

function makeVersionCheckEnv(cb) {
  return makeTemporaryEnv({
    private: true,
    workspaces: [`packages/*`],
  }, async ({path, run, ...rest}) => {
    const git = (...args) => execFile(`git`, args, {cwd: path});

    await writeJson(`${path}/packages/pkg-a/package.json`, {
      name: `pkg-a`,
      version: `1.0.0`,
    });

    await writeJson(`${path}/packages/pkg-b/package.json`, {
      name: `pkg-b`,
      version: `1.0.0`,
    });

    await writeJson(`${path}/packages/pkg-c/package.json`, {
      name: `pkg-c`,
      version: `1.0.0`,
      dependencies: {
        [`pkg-a`]: `workspace:1.0.0`,
        [`pkg-b`]: `workspace:1.0.0`,
      },
    });

    await run(`install`);

    await git(`init`, `.`);

    // Otherwise we can't always commit
    await git(`config`, `user.name`, `John Doe`);
    await git(`config`, `user.email`, `john.doe@example.org`);

    await git(`add`, `.`);
    await git(`commit`, `-m`, `First commit`);

    await cb({path, run, ...rest, git});
  });
}