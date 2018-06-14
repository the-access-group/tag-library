import { render } from '@stencil/core/testing';
import { TernaryGraph } from './tag-ternary-graph';

describe('tag-ternary-graph', () => {
  it('should build', () => {
    expect(new TernaryGraph()).toBeTruthy();
  });

  describe('rendering', () => {
    beforeEach(async () => {
      await render({
        components: [TernaryGraph],
        html: '<tag-ternary-graph></tag-ternary-graph>'
      });
    });
  });
});