const { TestEnvironment } = require('jest-environment-node');
const { JSDOM } = require('jsdom');

/**
 * A Node test environment that hands tests the JSDOM class as a global.
 *
 * jsdom is loaded here, by Node itself, rather than with require() inside a
 * test. Jest runs test files in its own module sandbox, and jsdom 31 does not
 * work when loaded there: some of its dependencies are ES modules, and its CSS
 * code then mixes values from two realms and throws inside focus().
 */
class JsdomClassEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.JSDOM = JSDOM;
  }
}

module.exports = JsdomClassEnvironment;
